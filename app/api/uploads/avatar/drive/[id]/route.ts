// app/api/uploads/avatar/drive/[id]/route.ts
// Serves a Google Drive image through our own server.
//
// Browsers hot-linking drive.google.com/thumbnail get redirected to
// lh3.googleusercontent.com, which often answers 429 (Too Many Requests), so
// avatars stored as Drive links fail to show. Server-side fetches work, so we
// fetch once, cache the bytes on disk and serve them from our origin.
//
// Safe from SSRF: the upstream host is fixed and the id is strictly validated.
import { NextResponse } from "next/server";
import { mkdir, readFile, stat, writeFile } from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CACHE_DIR = path.join(process.cwd(), "storage", "avatars", "drive");
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // re-fetch weekly
const MAX_BYTES = 5 * 1024 * 1024;
const DRIVE_ID = /^[a-zA-Z0-9_-]{10,128}$/;

function sniffType(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return "image/png";
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP")
    return "image/webp";
  if (buf.subarray(0, 4).toString("ascii") === "GIF8") return "image/gif";
  return null;
}

function imageResponse(buf: Buffer, type: string, maxAge: number) {
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": type,
      "Cache-Control": `public, max-age=${maxAge}`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function fetchFromDrive(id: string): Promise<Buffer | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(
      `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w800`,
      { signal: controller.signal, redirect: "follow", cache: "no-store" },
    );
    if (!res.ok) return null;
    const len = Number(res.headers.get("content-length") || 0);
    if (len > MAX_BYTES) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_BYTES || !sniffType(buf)) return null; // HTML = not shared publicly
    return buf;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!DRIVE_ID.test(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const cacheFile = path.join(CACHE_DIR, id);

  // Fresh cache hit
  let cached: Buffer | null = null;
  try {
    const info = await stat(cacheFile);
    cached = await readFile(cacheFile);
    const type = sniffType(cached);
    if (type && Date.now() - info.mtimeMs < CACHE_TTL_MS) {
      return imageResponse(cached, type, 86400);
    }
  } catch {
    /* not cached yet */
  }

  const fresh = await fetchFromDrive(id);
  if (fresh) {
    try {
      await mkdir(CACHE_DIR, { recursive: true });
      await writeFile(cacheFile, fresh);
    } catch (e) {
      console.error("Drive avatar cache write failed:", e);
    }
    return imageResponse(fresh, sniffType(fresh)!, 86400);
  }

  // Upstream failed: serve a stale copy if we have one
  const staleType = cached ? sniffType(cached) : null;
  if (cached && staleType) return imageResponse(cached, staleType, 300);

  return NextResponse.json(
    { error: "Image unavailable. Share the Drive file as 'Anyone with the link'." },
    { status: 404 },
  );
}
