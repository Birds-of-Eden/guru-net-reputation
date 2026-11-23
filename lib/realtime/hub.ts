// lib/realtime/hub.ts
// Self-hosted WebSocket hub (replaces Pusher). Runs inside server.ts.
//
// Wire protocol (JSON):
//   client -> server: { t: "sub", ch } | { t: "unsub", ch } | { t: "ping" }
//   server -> client: { t: "ev", ch, ev, d } | { t: "sub_err", ch, reason } | { t: "pong" }
//
// Presence channels (prefix "presence-") emit:
//   presence:subscription_succeeded  d = Member[]
//   presence:member_added            d = Member
//   presence:member_removed          d = { id }
import type { IncomingMessage } from "http";
import type { Duplex } from "stream";
import { WebSocketServer, WebSocket } from "ws";
import { verifyRealtimeToken, type RealtimeUser } from "./token";

export type Member = { id: string; info: { name: string | null; image: string | null } };

export type Authorizer = (user: RealtimeUser, channel: string) => Promise<boolean>;

type Client = WebSocket & {
  user: RealtimeUser;
  channels: Set<string>;
  isAlive: boolean;
};

export type RealtimeHub = {
  trigger: (channels: string | string[], event: string, data: unknown) => void;
  handleUpgrade: (req: IncomingMessage, socket: Duplex, head: Buffer) => void;
  stats: () => { connections: number; channels: number };
  close: () => void;
};

const MAX_CHANNELS_PER_CLIENT = 200;
const MAX_MESSAGE_BYTES = 4 * 1024;
const HEARTBEAT_MS = 30_000;

export function createRealtimeHub(authorize: Authorizer): RealtimeHub {
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES });
  const channels = new Map<string, Set<Client>>();
  // presence: channel -> userId -> { member, connections }
  const presence = new Map<string, Map<string, { member: Member; count: number }>>();

  const send = (client: Client, msg: unknown) => {
    if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(msg));
  };

  const broadcast = (channel: string, event: string, data: unknown, except?: Client) => {
    const subs = channels.get(channel);
    if (!subs?.size) return;
    const frame = JSON.stringify({ t: "ev", ch: channel, ev: event, d: data });
    for (const c of subs) {
      if (c !== except && c.readyState === WebSocket.OPEN) c.send(frame);
    }
  };

  const join = (client: Client, channel: string) => {
    if (client.channels.has(channel)) {
      // Re-subscribe: resend presence snapshot so the client UI is consistent
      if (channel.startsWith("presence-")) {
        const members = Array.from(presence.get(channel)?.values() ?? []).map((p) => p.member);
        send(client, { t: "ev", ch: channel, ev: "presence:subscription_succeeded", d: members });
      }
      return;
    }
    client.channels.add(channel);
    if (!channels.has(channel)) channels.set(channel, new Set());
    channels.get(channel)!.add(client);

    if (channel.startsWith("presence-")) {
      if (!presence.has(channel)) presence.set(channel, new Map());
      const roster = presence.get(channel)!;
      const existing = roster.get(client.user.id);
      if (existing) {
        existing.count += 1;
      } else {
        const member: Member = {
          id: client.user.id,
          info: { name: client.user.name, image: client.user.image },
        };
        roster.set(client.user.id, { member, count: 1 });
        broadcast(channel, "presence:member_added", member, client);
      }
      const members = Array.from(roster.values()).map((p) => p.member);
      send(client, { t: "ev", ch: channel, ev: "presence:subscription_succeeded", d: members });
    }
  };

  const leave = (client: Client, channel: string) => {
    if (!client.channels.delete(channel)) return;
    const subs = channels.get(channel);
    subs?.delete(client);
    if (subs && subs.size === 0) channels.delete(channel);

    if (channel.startsWith("presence-")) {
      const roster = presence.get(channel);
      const entry = roster?.get(client.user.id);
      if (roster && entry) {
        entry.count -= 1;
        if (entry.count <= 0) {
          roster.delete(client.user.id);
          broadcast(channel, "presence:member_removed", { id: client.user.id });
        }
        if (roster.size === 0) presence.delete(channel);
      }
    }
  };

  wss.on("connection", (ws: WebSocket, _req: IncomingMessage, user: RealtimeUser) => {
    const client = ws as Client;
    client.user = user;
    client.channels = new Set();
    client.isAlive = true;

    // Every connection automatically receives its own user + role channels
    join(client, `user-${user.id}`);
    if (user.role) join(client, `role-${user.role}`);

    client.on("pong", () => {
      client.isAlive = true;
    });

    client.on("message", async (raw) => {
      let msg: any;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (msg?.t === "ping") {
        send(client, { t: "pong" });
        return;
      }
      const ch = typeof msg?.ch === "string" ? msg.ch.slice(0, 200) : "";
      if (!ch) return;

      if (msg.t === "sub") {
        if (client.channels.size >= MAX_CHANNELS_PER_CLIENT) {
          send(client, { t: "sub_err", ch, reason: "too_many_channels" });
          return;
        }
        let ok = false;
        try {
          ok = await authorize(client.user, ch);
        } catch (err) {
          console.error("[realtime] authorize failed:", err);
        }
        if (client.readyState !== WebSocket.OPEN) return;
        if (!ok) {
          send(client, { t: "sub_err", ch, reason: "forbidden" });
          return;
        }
        join(client, ch);
      } else if (msg.t === "unsub") {
        // Personal channels stay attached for the lifetime of the socket
        if (ch === `user-${client.user.id}` || ch === `role-${client.user.role}`) return;
        leave(client, ch);
      }
    });

    client.on("close", () => {
      for (const ch of Array.from(client.channels)) leave(client, ch);
    });
    client.on("error", () => {
      /* close handler cleans up */
    });
  });

  // Drop dead connections (laptop sleep, network loss) so presence stays accurate
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      const c = ws as Client;
      if (!c.isAlive) {
        c.terminate();
        continue;
      }
      c.isAlive = false;
      try {
        c.ping();
      } catch {
        /* ignore */
      }
    }
  }, HEARTBEAT_MS);
  heartbeat.unref?.();

  return {
    trigger(chs, event, data) {
      for (const ch of Array.isArray(chs) ? chs : [chs]) broadcast(ch, event, data);
    },
    handleUpgrade(req, socket, head) {
      const url = new URL(req.url || "/", "http://localhost");
      const user = verifyRealtimeToken(url.searchParams.get("token"));
      if (!user) {
        socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
        socket.destroy();
        return;
      }
      wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req, user));
    },
    stats: () => ({ connections: wss.clients.size, channels: channels.size }),
    close() {
      clearInterval(heartbeat);
      for (const ws of wss.clients) ws.terminate();
      wss.close();
    },
  };
}
