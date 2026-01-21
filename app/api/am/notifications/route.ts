// GET /api/am/notifications

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
  // Get current session user (AM)
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

  // Params
  const u = new URL(req.url);
  const onlyUnread = u.searchParams.get("onlyUnread") === "1"; // backward compat
  const isReadParam = u.searchParams.get("isRead"); // "true" | "false" | null
  const type = u.searchParams.get("type");
  const q = u.searchParams.get("q")?.trim();
  const dateFrom = u.searchParams.get("from");
  const dateTo = u.searchParams.get("to");
  const take = Number(u.searchParams.get("take") || 50);
  const limit = Number(u.searchParams.get("limit") || take); // Support both take and limit
  const page = Number(u.searchParams.get("page") || 1);
  const cursorId = u.searchParams.get("cursorId");
  const sort = (u.searchParams.get("sort") === "asc" ? "asc" : "desc") as
    | "asc"
    | "desc";

  // where condition: notifications of tasks whose client is managed by this AM
  const where: any = {
    task: {
      client: {
        amId: user.id,
      },
    },
  };
  if (onlyUnread) where.isRead = false;
  if (isReadParam === "true") where.isRead = true;
  if (isReadParam === "false") where.isRead = false;
  if (type && ["general", "performance", "frequency_missed"].includes(type))
    where.type = type as any;
  if (q) where.message = { contains: q, mode: "insensitive" };
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = new Date(dateFrom);
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      where.createdAt.lte = to;
    }
  }

  // Calculate pagination
  const skip = (page - 1) * limit;
  
  // Get total count for pagination
  const totalCount = await prisma.notification.count({ where });
  
  // Get notifications with pagination
  const notifications = await prisma.notification.findMany({
    where,
    orderBy: { createdAt: sort },
    take: limit,
    skip,
    ...(cursorId ? { skip: 1, cursor: { id: Number(cursorId) } } : {}),
    include: {
      task: {
        select: {
          clientId: true,
          client: { select: { name: true } },
        },
      },
    },
  });

  const notificationsWithTarget = notifications.map((n) => {
    const targetPath = buildTargetPath(user?.role, n, n.task ?? undefined);
    const { task: _task, ...rest } = n;
    return { ...rest, targetPath };
  });

  // Calculate pagination info
  const totalPages = Math.ceil(totalCount / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  const response = {
    notifications: notificationsWithTarget,
    pagination: {
      currentPage: page,
      totalPages,
      totalCount,
      hasNextPage,
      hasPrevPage,
      limit,
    },
  };

  return NextResponse.json(response);
}
