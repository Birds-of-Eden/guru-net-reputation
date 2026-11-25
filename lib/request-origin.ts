// lib/request-origin.ts
// Resolve the public origin of the CURRENT request, so links / self-fetches
// work on whatever host the app was opened from (localhost:3000, a Cloudflare
// tunnel, or the production domain) instead of a value baked in at build time.

type HeaderGetter = { get(name: string): string | null };

const first = (v: string | null) => (v ? v.split(",")[0].trim() : "");

export function getRequestOrigin(h: HeaderGetter): string {
  const host =
    first(h.get("x-forwarded-host")) ||
    first(h.get("host")) ||
    `localhost:${process.env.PORT || 3000}`;

  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(host);
  const proto = first(h.get("x-forwarded-proto")) || (isLocal ? "http" : "https");

  return `${proto}://${host}`.replace(/\/$/, "");
}
