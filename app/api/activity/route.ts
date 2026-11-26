// app/api/activity/route.ts
//
// GET  /api/activity             → paginated, filterable activity feed
//      ?q=&action=a,b&entityType=Client&entityId=&userId=&from=&to=&source=system|event
//      &page=1&limit=25
// GET  /api/activity?facets=1    → filter options + today's stats
// GET  /api/activity?format=csv  → CSV export of the current filter (max 5000 rows)
// POST /api/activity             → record a hand-written event (always as the signed-in user)

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAccess } from "@/lib/api-guard";
import { writeEventLog } from "@/lib/audit/server";
import { pathLabel, type Change } from "@/lib/audit/diff";

const VIEW_RULE = { permissions: ["view_activity_logs"] };

function buildWhere(sp: URLSearchParams) {
  const and: any[] = [];
  const q = sp.get("q")?.trim();
  const actions = (sp.get("action") || "").split(",").map((s) => s.trim()).filter((s) => s && s !== "all");
  const entityType = sp.get("entityType")?.trim();
  const entityId = sp.get("entityId")?.trim();
  const userId = sp.get("userId")?.trim();
  const source = sp.get("source")?.trim();
  const from = sp.get("from");
  const to = sp.get("to");

  if (actions.length) and.push({ action: { in: actions } });
  if (entityType && entityType !== "all") and.push({ entityType: { equals: entityType, mode: "insensitive" } });
  if (entityId) and.push({ entityId });
  if (userId === "system") and.push({ userId: null });
  else if (userId && userId !== "all") and.push({ userId });
  if (source === "system") and.push({ details: { path: ["source"], equals: "system" } });
  if (source === "event") {
    and.push({ OR: [{ details: { equals: null } }, { NOT: { details: { path: ["source"], equals: "system" } } }] });
  }
  const ts: any = {};
  if (from && !Number.isNaN(Date.parse(from))) ts.gte = new Date(from);
  if (to && !Number.isNaN(Date.parse(to))) ts.lte = new Date(to);
  if (ts.gte || ts.lte) and.push({ timestamp: ts });
  if (q) {
    and.push({
      OR: [
        { activitylog_field_01: { contains: q, mode: "insensitive" } },
        { activitylog_field_02: { contains: q, mode: "insensitive" } },
        { entityType: { contains: q, mode: "insensitive" } },
        { entityId: { contains: q, mode: "insensitive" } },
        { action: { contains: q, mode: "insensitive" } },
        { user: { name: { contains: q, mode: "insensitive" } } },
        { user: { email: { contains: q, mode: "insensitive" } } },
      ],
    });
  }
  return and.length ? { AND: and } : {};
}

const USER_SELECT = { id: true, name: true, email: true, image: true, role: { select: { name: true } } };

async function facets() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const weekAgo = new Date(Date.now() - 7 * 864e5);

  const [entityTypes, actions, actors, todayByAction, total, todayActors] = await Promise.all([
    prisma.activityLog.groupBy({ by: ["entityType"], _count: { _all: true }, orderBy: { _count: { entityType: "desc" } } }),
    prisma.activityLog.groupBy({ by: ["action"], _count: { _all: true }, orderBy: { _count: { action: "desc" } } }),
    prisma.activityLog.groupBy({
      by: ["userId"],
      where: { timestamp: { gte: weekAgo } },
      _count: { _all: true },
      orderBy: { _count: { userId: "desc" } },
      take: 100,
    }),
    prisma.activityLog.groupBy({ by: ["action"], where: { timestamp: { gte: startOfDay } }, _count: { _all: true } }),
    prisma.activityLog.count(),
    prisma.activityLog.groupBy({ by: ["userId"], where: { timestamp: { gte: startOfDay }, userId: { not: null } } }),
  ]);

  const ids = actors.map((a) => a.userId).filter(Boolean) as string[];
  const users = ids.length ? await prisma.user.findMany({ where: { id: { in: ids } }, select: USER_SELECT }) : [];
  const userMap = new Map(users.map((u) => [u.id, u]));

  const today = Object.fromEntries(todayByAction.map((r) => [r.action, r._count._all]));
  const todayTotal = todayByAction.reduce((s, r) => s + r._count._all, 0);

  return {
    success: true,
    entityTypes: entityTypes.map((e) => ({ value: e.entityType, count: e._count._all })),
    actions: actions.map((a) => ({ value: a.action, count: a._count._all })),
    users: actors
      .filter((a) => a.userId && userMap.has(a.userId))
      .map((a) => ({ ...userMap.get(a.userId!)!, count: a._count._all })),
    stats: {
      total,
      today: todayTotal,
      todayCreates: today.create ?? 0,
      todayUpdates: today.update ?? 0,
      todayDeletes: today.delete ?? 0,
      todayActiveUsers: todayActors.length,
    },
  };
}

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : typeof v === "string" ? v : JSON.stringify(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function summaryOf(log: any): string {
  return log.activitylog_field_01 || log.details?.summary || `${log.action} ${log.entityType}`;
}

export async function GET(request: Request) {
  const me = await requireAccess(VIEW_RULE);
  if (me instanceof NextResponse) return me;

  try {
    const sp = new URL(request.url).searchParams;
    if (sp.get("facets") === "1") return NextResponse.json(await facets());

    const where = buildWhere(sp);

    if (sp.get("format") === "csv") {
      const logs = await prisma.activityLog.findMany({
        where,
        orderBy: { timestamp: "desc" },
        include: { user: { select: { name: true, email: true } } },
        take: 5000,
      });
      const header = ["Time (UTC)", "User", "Email", "Action", "Entity", "Entity ID", "Record", "Summary", "Changes", "IP", "Page"];
      const lines = logs.map((l: any) => {
        const changes: Change[] = Array.isArray(l.details?.changes) ? l.details.changes : [];
        const changeText = changes
          .map((c) => `${pathLabel(c.path)}: ${JSON.stringify(c.before ?? null)} → ${JSON.stringify(c.after ?? null)}`)
          .join(" | ");
        return [
          l.timestamp.toISOString(),
          l.user?.name ?? (l.userId ? "" : "System"),
          l.user?.email ?? "",
          l.action,
          l.entityType,
          l.entityId,
          l.activitylog_field_02 ?? l.details?.label ?? "",
          summaryOf(l),
          changeText,
          l.details?.request?.ip ?? "",
          l.details?.request?.page ?? "",
        ].map(csvCell).join(",");
      });
      const body = "﻿" + [header.join(","), ...lines].join("\r\n");
      return new NextResponse(body, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="activity-log-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    const page = Math.max(1, Number.parseInt(sp.get("page") || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(sp.get("limit") || "25", 10) || 25));

    const [totalCount, logs] = await Promise.all([
      prisma.activityLog.count({ where }),
      prisma.activityLog.findMany({
        where,
        orderBy: { timestamp: "desc" },
        include: { user: { select: USER_SELECT } },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(totalCount / limit));
    return NextResponse.json({
      success: true,
      logs: logs.map((l: any) => ({
        id: l.id,
        entityType: l.entityType,
        entityId: l.entityId,
        userId: l.userId,
        action: l.action,
        timestamp: l.timestamp,
        details: l.details,
        summary: summaryOf(l),
        label: l.activitylog_field_02 ?? l.details?.label ?? null,
        changeCount: l.activitylog_field_03 ?? (Array.isArray(l.details?.changes) ? l.details.changes.length : 0),
        user: l.user,
      })),
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        limit,
      },
    });
  } catch (error: any) {
    console.error("Error fetching activity logs:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch activity logs", message: error?.message },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  // Any signed-in user may record events, but only ever as themselves
  const me = await requireAccess();
  if (me instanceof NextResponse) return me;

  try {
    const body = await request.json().catch(() => ({}));
    const entityType = String(body?.entityType || "").slice(0, 100);
    const entityId = String(body?.entityId || "").slice(0, 200);
    const action = String(body?.action || "").slice(0, 100);
    if (!entityType || !entityId || !action) {
      return NextResponse.json(
        { success: false, message: "entityType, entityId and action are required" },
        { status: 400 },
      );
    }

    const changes: Change[] = Array.isArray(body?.changes)
      ? body.changes
          .filter((c: any) => c && Array.isArray(c.path) && ["added", "removed", "changed"].includes(c.kind))
          .slice(0, 500)
          .map((c: any) => ({ path: c.path.map(String), kind: c.kind, before: c.before, after: c.after }))
      : [];

    const label = typeof body?.label === "string" ? body.label.slice(0, 200) : null;
    const summary =
      typeof body?.summary === "string" && body.summary.trim()
        ? body.summary.trim().slice(0, 500)
        : `${action.replace(/_/g, " ")} · ${entityType}${label ? ` "${label}"` : ""}`;

    const log = await writeEventLog(prisma, {
      entityType,
      entityId,
      action,
      summary,
      label,
      changes,
      details: body?.details ?? null,
    });

    return NextResponse.json({ success: true, log: { id: log.id } });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: "Failed to create activity log", message: error?.message || String(error) },
      { status: 500 },
    );
  }
}
