// lib/realtime/client.ts
// Browser WebSocket client (replaces pusher-js). Pusher-like API:
//
//   const ch = realtimeClient.subscribe("presence-conversation-123");
//   ch.bind("message:new", handler);
//   ch.unbind("message:new", handler);
//   realtimeClient.unsubscribe("presence-conversation-123");
//
// - One shared socket per tab, connected lazily on first use
// - Auto-reconnect with backoff; channels are re-subscribed after reconnect
// - Subscriptions are ref-counted (safe with React StrictMode / multiple components)
// - "realtime:reconnected" fires on every channel after a reconnect so UIs can refetch
"use client";

type Handler = (data: any) => void;

const PERSONAL = "__personal";
/** Channels starting with "__" exist only in the browser (never sent to the server). */
const isLocal = (name: string) => name.startsWith("__");

export type ConnectionState = "idle" | "connecting" | "connected" | "disconnected";

class Channel {
  private handlers = new Map<string, Set<Handler>>();
  constructor(public readonly name: string) {}

  bind(event: string, handler: Handler) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(handler);
    return this;
  }

  unbind(event?: string, handler?: Handler) {
    if (!event) this.handlers.clear();
    else if (!handler) this.handlers.delete(event);
    else this.handlers.get(event)?.delete(handler);
    return this;
  }

  /** @internal */
  emit(event: string, data: any) {
    this.handlers.get(event)?.forEach((h) => {
      try {
        h(data);
      } catch (err) {
        console.error(`[realtime] handler error (${this.name} ${event})`, err);
      }
    });
  }
}

class RealtimeClient {
  private ws: WebSocket | null = null;
  private channels = new Map<string, { channel: Channel; refs: number }>();
  private state: ConnectionState = "idle";
  private stateListeners = new Set<(s: ConnectionState) => void>();
  private retry = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private hasConnectedBefore = false;
  private started = false;

  private setState(s: ConnectionState) {
    if (this.state === s) return;
    this.state = s;
    this.stateListeners.forEach((l) => l(s));
  }

  getState() {
    return this.state;
  }

  onStateChange(listener: (s: ConnectionState) => void) {
    this.stateListeners.add(listener);
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  /**
   * Local pseudo-channel that receives every event sent to this user's
   * personal ("user-<id>") and role ("role-<role>") channels, which the
   * server joins automatically on connect.
   */
  personal() {
    return this.subscribe(PERSONAL);
  }

  subscribe(name: string): Channel {
    let entry = this.channels.get(name);
    if (!entry) {
      entry = { channel: new Channel(name), refs: 0 };
      this.channels.set(name, entry);
    }
    entry.refs += 1;
    if (entry.refs === 1 && !isLocal(name)) this.sendRaw({ t: "sub", ch: name });
    this.start();
    return entry.channel;
  }

  unsubscribe(name: string) {
    const entry = this.channels.get(name);
    if (!entry) return;
    entry.refs -= 1;
    if (entry.refs <= 0) {
      this.channels.delete(name);
      if (!isLocal(name)) this.sendRaw({ t: "unsub", ch: name });
    }
  }

  private start() {
    if (this.started || typeof window === "undefined") return;
    this.started = true;
    window.addEventListener("online", () => this.reconnectNow());
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") this.reconnectNow();
    });
    void this.connect();
  }

  private reconnectNow() {
    if (this.state === "connected" || this.state === "connecting") return;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.retry = 0;
    void this.connect();
  }

  private scheduleReconnect(delayOverride?: number) {
    if (this.reconnectTimer) return;
    const delay = delayOverride ?? Math.min(15_000, 500 * 2 ** this.retry) + Math.random() * 500;
    this.retry += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, delay);
  }

  private socketUrl(token: string) {
    const base =
      process.env.NEXT_PUBLIC_REALTIME_URL ||
      `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/realtime`;
    return `${base}${base.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`;
  }

  private async connect() {
    if (this.state === "connecting" || this.state === "connected") return;
    this.setState("connecting");

    let token: string | null = null;
    try {
      const res = await fetch("/api/realtime/token", { cache: "no-store", credentials: "include" });
      if (res.status === 401) {
        // Not signed in (yet) — check again later
        this.setState("disconnected");
        this.scheduleReconnect(30_000);
        return;
      }
      if (res.ok) token = (await res.json())?.token ?? null;
    } catch {
      /* network error */
    }
    if (!token) {
      this.setState("disconnected");
      this.scheduleReconnect();
      return;
    }

    let ws: WebSocket;
    try {
      ws = new WebSocket(this.socketUrl(token));
    } catch {
      this.setState("disconnected");
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;

    ws.onopen = () => {
      this.retry = 0;
      this.setState("connected");
      for (const name of this.channels.keys()) {
        if (!isLocal(name)) this.sendRaw({ t: "sub", ch: name });
      }
      if (this.pingTimer) clearInterval(this.pingTimer);
      this.pingTimer = setInterval(() => this.sendRaw({ t: "ping" }), 25_000);
      if (this.hasConnectedBefore) {
        // Events may have been missed while offline
        for (const { channel } of this.channels.values()) channel.emit("realtime:reconnected", {});
      }
      this.hasConnectedBefore = true;
    };

    ws.onmessage = (e) => {
      let msg: any;
      try {
        msg = JSON.parse(typeof e.data === "string" ? e.data : "");
      } catch {
        return;
      }
      if (msg?.t === "ev") {
        this.channels.get(msg.ch)?.channel.emit(msg.ev, msg.d);
        if (typeof msg.ch === "string" && (msg.ch.startsWith("user-") || msg.ch.startsWith("role-"))) {
          this.channels.get(PERSONAL)?.channel.emit(msg.ev, msg.d);
        }
      } else if (msg?.t === "sub_err") {
        console.warn(`[realtime] subscribe to ${msg.ch} rejected: ${msg.reason}`);
      }
    };

    ws.onclose = () => {
      if (this.ws === ws) this.ws = null;
      if (this.pingTimer) clearInterval(this.pingTimer);
      this.pingTimer = null;
      this.setState("disconnected");
      this.scheduleReconnect();
    };

    ws.onerror = () => {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    };
  }

  private sendRaw(msg: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }
}

const g = globalThis as unknown as { __realtimeClient?: RealtimeClient };

export const realtimeClient: RealtimeClient =
  g.__realtimeClient ?? (g.__realtimeClient = new RealtimeClient());

export type { Channel };
