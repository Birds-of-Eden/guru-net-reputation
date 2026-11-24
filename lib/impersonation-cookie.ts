// lib/impersonation-cookie.ts
// Signed value for the "impersonation-role" cookie.
//
// The proxy (middleware) cannot query the database, so it reads the
// impersonated user's role from this cookie. Unsigned, any user could set
// "impersonation-role=admin" themselves and open admin pages. The value is now
// "<role>.<hmac(origin|target|role)>", verified with the auth secret.
// Uses Web Crypto so it works in both the proxy and Node route handlers.

function secret(): string {
  const s = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET / NEXTAUTH_SECRET is not set");
  return s;
}

function toBase64Url(bytes: ArrayBuffer): string {
  let bin = "";
  for (const b of new Uint8Array(bytes)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return toBase64Url(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

export async function signImpersonationRole(originId: string, targetId: string, role: string) {
  const sig = await hmac(`${originId}|${targetId}|${role}`);
  return `${role}.${sig}`;
}

/** Returns the role if the cookie value is authentic for this origin/target, else null. */
export async function verifyImpersonationRole(
  value: string | undefined,
  originId: string,
  targetId: string
): Promise<string | null> {
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const role = value.slice(0, dot);
  const given = value.slice(dot + 1);
  const expected = await hmac(`${originId}|${targetId}|${role}`);
  if (given.length !== expected.length) return null;
  let diff = 0;
  for (let i = 0; i < given.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0 ? role : null;
}
