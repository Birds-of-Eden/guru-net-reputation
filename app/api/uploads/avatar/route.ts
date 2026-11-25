// app/api/uploads/avatar/route.ts
// POST multipart/form-data { file } → stores the image on disk and returns its URL.
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

const AVATAR_DIR =path.join(process.cwd(), "storage", "avatars");

/** Check magic bytes so a renamed non-image can't be stored */
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

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Image must be 5MB or smaller" }, { status: 413 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const type = sniffType(buf);
    if (!type) {
      return NextResponse.json(
        { error: "Only JPG, PNG, WEBP or GIF images are allowed" },
        { status: 415 },
      );
    }

    const name = `${randomUUID()}.${EXT_BY_TYPE[type]}`;
    await mkdir(AVATAR_DIR, { recursive: true });
    await writeFile(path.join(AVATAR_DIR, name), buf);

    return NextResponse.json({ url: `/api/uploads/avatar/${name}` });
  } catch (error: any) {
    console.error("Avatar upload failed:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
