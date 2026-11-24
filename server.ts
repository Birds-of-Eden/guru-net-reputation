// server.ts
// Custom Node server: Next.js + self-hosted WebSocket hub on the same port.
//
//   npm run dev     -> tsx server.ts
//   npm start       -> tsx server.ts --prod   (after `npm run build`)
//
// WebSocket endpoint: ws(s)://<host>/realtime?token=...
const isProd = process.argv.includes("--prod") || process.env.NODE_ENV === "production";
(process.env as Record<string, string>).NODE_ENV = isProd ? "production" : "development";

async function main() {
  const { createServer } = await import("http");
  const { default: next } = await import("next");
  const { createRealtimeHub } = await import("./lib/realtime/hub");
  const { authorizeChannel } = await import("./lib/realtime/authorize");
  const { getPublishSecret } = await import("./lib/realtime/token");

  const port = Number(process.env.PORT) || 3000;
  const hostname = process.env.HOSTNAME || "0.0.0.0";

  const app = next({ dev: !isProd, hostname, port });
  const handle = app.getRequestHandler();
  await app.prepare();
  const nextUpgrade = app.getUpgradeHandler();

  const hub = createRealtimeHub(authorizeChannel);
  (globalThis as any).__realtimeHub = hub;

  const server = createServer(async (req, res) => {
    // Loopback-only publish endpoint (used if route code runs in another process)
    if (req.url === "/__realtime/publish") {
      const remote = req.socket.remoteAddress || "";
      const isLoopback = ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(remote);
      if (
        req.method !== "POST" ||
        !isLoopback ||
        req.headers["x-realtime-secret"] !== getPublishSecret()
      ) {
        res.statusCode = 403;
        res.end();
        return;
      }
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
        if (body.length > 1_000_000) req.destroy();
      });
      req.on("end", () => {
        try {
          const { channels, event, data } = JSON.parse(body);
          hub.trigger(channels, event, data);
          res.statusCode = 204;
        } catch {
          res.statusCode = 400;
        }
        res.end();
      });
      return;
    }

    if (req.url === "/__realtime/health") {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: true, ...hub.stats() }));
      return;
    }

    try {
      await handle(req, res);
    } catch (err) {
      console.error("[server] request error", req.url, err);
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  });

  // Single upgrade router.
  // NOTE: Next's getRequestHandler() auto-attaches its OWN "upgrade" listener to
  // this server on the first HTTP request (next/dist/server/next.js
  // setupWebSocketHandler). That listener would also receive /realtime
  // connections and destroy them (instant close 1006 -> endless reconnects),
  // and would double-handle HMR. So we intercept "upgrade" at emit level and
  // route every upgrade exactly once; extra listeners never see it.
  const routeUpgrade = (req: any, socket: any, head: any) => {
    const pathname = (req.url || "").split("?")[0];
    if (pathname === "/realtime") {
      hub.handleUpgrade(req, socket, head);
      return;
    }
    // Next.js HMR (dev) and any other upgrade requests
    nextUpgrade(req, socket, head);
  };
  const originalEmit = server.emit.bind(server) as (event: string, ...args: any[]) => boolean;
  (server as any).emit = (event: string, ...args: any[]) => {
    if (event === "upgrade") {
      const [req, socket, head] = args;
      routeUpgrade(req, socket, head);
      return true;
    }
    return originalEmit(event, ...args);
  };

  server.listen(port, hostname, () => {
    console.log(
      `> Ready on http://${hostname === "0.0.0.0" ? "localhost" : hostname}:${port} ` +
        `(${isProd ? "production" : "development"}) — WebSocket at /realtime`
    );
  });

  const shutdown = () => {
    hub.close();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  console.error("[server] failed to start", err);
  process.exit(1);
});
