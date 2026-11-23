// app/api/realtime/token/route.ts
// Issues a short-lived token for the WebSocket handshake.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/getAuthUser";
import { createRealtimeToken } from "@/lib/realtime/token";

export async function GET() {
  const me = await getAuthUser();
  if (!me?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const token = createRealtimeToken({
    id: me.id,
    name: me.name ?? null,
    image: me.image ?? null,
    role: me.role ?? null,
  });

  return NextResponse.json(
    { token },
    { headers: { "Cache-Control": "no-store" } }
  );
}
