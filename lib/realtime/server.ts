// lib/realtime/server.ts
// Server-side publish API used by route handlers (replaces pusherServer).
//
//   await realtime.trigger("presence-conversation-123", "message:new", payload)
//   realtime.toUsers(["u1", "u2"], "chat:changed", {})
//
// The hub lives on globalThis (set by server.ts). If route code ever runs in a
// different process, we fall back to the hub's loopback publish endpoint.
import type { RealtimeHub } from "./hub";
import { getPublishSecret } from "./token";

const g = globalThis as unknown as { __realtimeHub?: RealtimeHub };

let warned = false;

async function publish(channels: string[], event: string, data: unknown) {
  if (!channels.length) return;
  const hub = g.__realtimeHub;
  if (hub) {
    hub.trigger(channels, event, data);
    return;
  }

  // Cross-process fallback (loopback only)
  const port = process.env.PORT || "3000";
  try {
    const res = await fetch(`http://127.0.0.1:${port}/__realtime/publish`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-realtime-secret": getPublishSecret(),
      },
      body: JSON.stringify({ channels, event, data }),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`publish ${res.status}`);
  } catch (err) {
    if (!warned) {
      warned = true;
      console.warn(
        "[realtime] Hub not reachable — start the app with `npm run dev` / `npm start` (server.ts).",
        (err as Error)?.message
      );
    }
  }
}

export const realtime = {
  /** Same signature as pusher.trigger(channel, event, data). Never throws. */
  async trigger(channels: string | string[], event: string, data: unknown) {
    try {
      await publish(Array.isArray(channels) ? channels : [channels], event, data);
    } catch (err) {
      console.error("[realtime] trigger failed:", err);
    }
  },

  async toUsers(userIds: Iterable<string>, event: string, data: unknown = {}) {
    const unique = Array.from(new Set(Array.from(userIds).filter(Boolean)));
    await this.trigger(
      unique.map((id) => `user-${id}`),
      event,
      data
    );
  },

  async toRoles(roles: string[], event: string, data: unknown = {}) {
    await this.trigger(
      roles.map((r) => `role-${r}`),
      event,
      data
    );
  },
};
