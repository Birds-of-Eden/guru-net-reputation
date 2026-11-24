// app/api/utils/validate-url/route.ts
import { NextRequest, NextResponse } from "next/server";
import dns from "node:dns/promises";
import net from "node:net";
import { requireStaff } from "@/lib/api-guard";

export const runtime = "nodejs"; // needed for dns/net

const MAX_REDIRECTS = 5;

function isPrivateIPv4(ip: string) {
  const [a, b] = ip.split(".").map((n) => parseInt(n, 10));
  if (a === 0 || a === 10 || a === 127) return true; // this-net, private, loopback
  if (a === 169 && b === 254) return true; // link-local incl. cloud metadata 169.254.169.254
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12
  if (a === 192 && b === 168) return true; // 192.168/16
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
  if (a >= 224) return true; // multicast / reserved
  return false;
}

function isPrivateIp(ip: string) {
  if (net.isIPv4(ip)) return isPrivateIPv4(ip);
  const v6 = ip.toLowerCase();
  if (v6 === "::" || v6 === "::1") return true;
  const mapped = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/); // IPv4-mapped
  if (mapped) return isPrivateIPv4(mapped[1]);
  if (/^f[cd]/.test(v6)) return true; // unique local fc00::/7
  if (/^fe[89ab]/.test(v6)) return true; // link-local fe80::/10
  if (/^ff/.test(v6)) return true; // multicast
  return false;
}

/** Rejects URLs that point at this server or the internal network (SSRF guard). */
async function checkPublicUrl(url: URL): Promise<string | null> {
  if (!/^https?:$/.test(url.protocol)) return "URL must start with http:// or https://";
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost")) {
    return "Local/loopback URLs are not allowed.";
  }
  if (net.isIP(host)) {
    return isPrivateIp(host) ? "Private network URLs are not allowed." : null;
  }
  try {
    const addresses = await dns.lookup(host, { all: true });
    if (addresses.some((a) => isPrivateIp(a.address))) {
      return "Private network URLs are not allowed.";
    }
  } catch {
    return "URL is not reachable (network/DNS/timeout).";
  }
  return null;
}

async function isReachable(raw: string): Promise<{ ok: boolean; reason?: string }> {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false, reason: "Enter a valid URL (e.g., https://example.com)" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000); // 5s timeout

  const commonOpts: RequestInit = {
    // Follow redirects manually so every hop is checked against the SSRF guard
    redirect: "manual",
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      accept: "*/*",
    },
    cache: "no-store",
    signal: controller.signal,
  };

  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const blocked = await checkPublicUrl(url);
      if (blocked) return { ok: false, reason: blocked };

      let res = await fetch(url, { ...commonOpts, method: "HEAD" });
      if (res.status === 405 || res.status === 501) {
        res = await fetch(url, { ...commonOpts, method: "GET" });
      }

      const location = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && location) {
        url = new URL(location, url);
        continue;
      }

      const ok =
        (res.status >= 200 && res.status < 400) ||
        res.status === 401 || // protected is fine (exists)
        res.status === 403;
      return ok ? { ok: true } : { ok: false, reason: `URL responded with status ${res.status}.` };
    }
    return { ok: false, reason: "Too many redirects." };
  } catch {
    return { ok: false, reason: "URL is not reachable (network/DNS/timeout)." };
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(req: NextRequest) {
  const __access = await requireStaff();
  if (__access instanceof NextResponse) return __access;
  const url = req.nextUrl.searchParams.get("url") || "";
  const result = await isReachable(url);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
