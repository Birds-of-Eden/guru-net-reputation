// GET /api/notifications

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

const buildTargetPath = (
  role: string | null | undefined,
  notification: { id: number; taskId?: string | null },
  task?: { clientId?: string | null; client?: { name?: string | null } | null }
) => {
  const basePath = roleBasePath(role);
  if (notification.taskId && task?.clientId) {
    const params = new URLSearchParams();
    params.set("clientId", task.clientId);
    if (task.client?.name) {
      params.set("clientName", task.client.name);
    }
    params.set("taskId", notification.taskId);
    const taskPath =
      role === "agent" ? `${basePath}/agent_tasks` : `${basePath}/tasks`;
    return `${taskPath}?${params.toString()}`;
  }

  return `${basePath}/notifications/${notification.id}`;
};

export async function GET(req: Request) {
  // session
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

  // params
  const u = new URL(req.url);
  const page = Number.parseInt(u.searchParams.get("page") || "1");
  const limit = Number.parseInt(u.searchParams.get("limit") || "20");
  const onlyUnread = u.searchParams.get("onlyUnread") === "1"; // backward compat
  const isReadParam = u.searchParams.get("isRead"); // "true" | "false" | null
  const type = u.searchParams.get("type"); // "general" | "performance" | "frequency_missed"
  const q = u.searchParams.get("q")?.trim();
  const dateFrom = u.searchParams.get("from");
  const dateTo = u.searchParams.get("to");
  const sort = (u.searchParams.get("sort") === "asc" ? "asc" : "desc") as
    | "asc"
    | "desc";

  // Calculate offset for pagination
  const skip = (page - 1) * limit;

  // where condition
  const where: any = { userId: user.id };
  if (onlyUnread) where.isRead = false;
  if (isReadParam === "true") where.isRead = true;
  if (isReadParam === "false") where.isRead = false;
  if (type && ["general", "performance", "frequency_missed"].includes(type))
    where.type = type;
  if (q) where.message = { contains: q, mode: "insensitive" };
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = new Date(dateFrom);
    if (dateTo) {
      const to = new Date(dateTo);
      // include entire day
      to.setHours(23, 59, 59, 999);
      where.createdAt.lte = to;
    }
  }

  const totalCount = await prisma.notification.count({ where });

  const data = await prisma.notification.findMany({
    where,
    orderBy: { createdAt: sort },
    skip,
    take: limit,
    include: {
      task: {
        select: {
          clientId: true,
          client: { select: { name: true } },
        },
      },
    },
  });

  const notifications = data.map((n) => {
    const targetPath = buildTargetPath(user?.role, n, n.task ?? undefined);
    const { task: _task, ...rest } = n;
    return { ...rest, targetPath };
  });

  const totalPages = Math.ceil(totalCount / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  return NextResponse.json({
    success: true,
    notifications,
    pagination: {
      currentPage: page,
      totalPages,
      totalCount,
      hasNextPage,
      hasPrevPage,
      limit,
    },
  });
}
