// GET /api/am/notifications/[id]

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const roleBasePath = (role?: string | null) => {
  switch (role) {
    case "admin":
      return "/admin";
    case "manager":
      return "/manager";
    case "agent":
      return "/agent";
    case "qc":
      return "/qc";
    case "am":
      return "/am";
    case "am_ceo":
      return "/am_ceo";
    case "data_entry":
      return "/data_entry";
    case "client":
      return "/client";
    case "user":
    default:
      return "/client";
  }
};

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const url = new URL("/api/auth/me", req.url);
  const sesRes = await fetch(url, {
    headers: { cookie: req.headers.get("cookie") ?? "" },
    cache: "no-store",
  });
  if (!sesRes.ok)
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const { user } = await sesRes.json();
  if (!user?.id)
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isFinite(id))
    return NextResponse.json({ message: "Invalid id" }, { status: 400 });

  const notification = await prisma.notification.findFirst({
    where: {
      id,
      task: { client: { amId: user.id } },
    },
  });

  if (!notification)
    return NextResponse.json({ message: "Not found" }, { status: 404 });

  const basePath = roleBasePath(user?.role);
  return NextResponse.json({
    success: true,
    notification: { ...notification, targetPath: `${basePath}/notifications/${notification.id}` },
  });
}
