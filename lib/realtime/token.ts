// lib/realtime/token.ts
// Short-lived HMAC token used only for the WebSocket handshake.
// Shared by the Next.js API route (issuer) and the WebSocket hub (verifier).
import { createHmac, timingSafeEqual } from "crypto";

export type RealtimeUser = {
  id: string;
  name: string | null;
  image: string | null;
  role: string | null;
};

type TokenPayload = RealtimeUser & { exp: number };

const TOKEN_TTL_SECONDS = 60;

function getSecret(): string {
  const secret =
    process.env.REALTIME_SECRET || process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("[realtime] Set AUTH_SECRET, NEXTAUTH_SECRET or REALTIME_SECRET");
  }
  return secret;
}

function sign(data: string): string {
  return createHmac("sha256", getSecret()).update(data).digest("base64url");
}

export function createRealtimeToken(user: RealtimeUser): string {
  const payload: TokenPayload = {
    id: user.id,
    name: user.name ?? null,
    image: user.image ?? null,
    role: user.role ?? null,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifyRealtimeToken(token: string | null | undefined): RealtimeUser | null {
  if (!token || typeof token !== "string") return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = Buffer.from(sign(body));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as TokenPayload;
    if (!payload?.id || typeof payload.exp !== "number") return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return { id: payload.id, name: payload.name, image: payload.image, role: payload.role };
  } catch {
    return null;
  }
}

/** Secret for the loopback publish endpoint (used only when the hub lives in another process). */
export function getPublishSecret(): string {
  return sign("realtime-internal-publish");
}
