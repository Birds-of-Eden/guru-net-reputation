// app/api/uploads/avatar/[file]/route.ts
// Serves uploaded avatar images from storage/avatars (outside /public, because
// Next.js only serves /public files that existed at build time).
import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const AVATAR_DIR = path.join(process.cwd(), "storage", "avatars");
const SAFE_NAME = /^[a-f0-9-]{36}\.(jpg|png|webp|gif)$/;
const TYPE_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ file: string }> },
) {
  const { file } = await params;
  if (!SAFE_NAME.test(file)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  try {
    const data = await readFile(path.join(AVATAR_DIR, file));
    const ext = file.split(".").pop()!;
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": TYPE_BY_EXT[ext],
        // File names are random UUIDs and never overwritten → cache forever
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
