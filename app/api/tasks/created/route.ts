// app/api/tasks/created/route.ts

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { startOfDay, endOfDay, isValid, parseISO } from "date-fns";

const CAT_SOCIAL_ACTIVITY = "Social Activity";
const CAT_BLOG_POSTING = "Blog Posting";

function asPositiveInt(v: string | null, def: number, cap: number) {
  const n = Number(v ?? "");
  if (Number.isFinite(n) && n > 0) return Math.min(Math.floor(n), cap);
  return def;
}

function parseDate(d: string | null) {
  if (!d) return null;
  const parsed = parseISO(d);
  return isValid(parsed) ? parsed : null;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const clientId = searchParams.get("clientId") ?? undefined;
    const assignedToId = searchParams.get("assignedToId") ?? undefined;

    const status = searchParams.get("status") ?? undefined;   // pending | in_progress | ... | qc_approved | all
    const priority = searchParams.get("priority") ?? undefined; // low | medium | high | urgent | all
    const category = searchParams.get("category") ?? undefined; // Social Activity | Blog Posting | all
    const q = (searchParams.get("q") ?? "").trim();

    const sort = (searchParams.get("sort") ?? "dueAsc").toLowerCase();
    const deep = (searchParams.get("deep") ?? "0") === "1";
    const cycleHeadersOnly =
      (searchParams.get("cycleHeadersOnly") ?? "").toLowerCase() === "true";
    const cycleKeyParam = searchParams.get("cycleKey");

    const startDateRaw = parseDate(searchParams.get("startDate"));
    const endDateRaw = parseDate(searchParams.get("endDate"));
    const cycleDate =
      cycleKeyParam && cycleKeyParam !== "No Due Date"
        ? parseDate(cycleKeyParam)
        : null;

    const limit = asPositiveInt(searchParams.get("limit"), 500, 5000);

    // ----- Base WHERE: allow all categories (filter below if provided) -----
    const where: any = {};

    // ----- Scalar filters -----
    if (clientId) where.clientId = clientId;
    if (assignedToId) where.assignedToId = assignedToId;

    if (status && status !== "all") where.status = status;
    if (priority && priority !== "all") where.priority = priority;

    if (category && category !== "all") {
      where.category = { is: { name: category } };
    }

    // ----- Date range (on dueDate) -----
    if (cycleKeyParam === "No Due Date") {
      where.dueDate = null;
    } else if (cycleDate) {
      where.dueDate = {
        gte: startOfDay(cycleDate),
        lte: endOfDay(cycleDate),
      };
    } else if (startDateRaw || endDateRaw) {
      where.dueDate = {
        ...(startDateRaw ? { gte: startOfDay(startDateRaw) } : {}),
        ...(endDateRaw ? { lte: endOfDay(endDateRaw) } : {}),
      };
    }

    // ----- Full-text-ish search -----
    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { notes: { contains: q, mode: "insensitive" } },
        { username: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { completionLink: { contains: q, mode: "insensitive" } },
      ];
    }

    // ----- Sort -----
    const orderBy =
      sort === "dueDesc"
        ? [{ dueDate: "desc" as const }, { createdAt: "desc" as const }]
        : sort === "createdDesc"
        ? [{ createdAt: "desc" as const }]
        : // default: dueAsc
          [{ dueDate: "asc" as const }, { createdAt: "desc" as const }];

    // ----- Final orderBy for cycle-specific queries -----
    const orderByFinal = cycleKeyParam
      ? [{ dueDate: "asc" as const }, { createdAt: "asc" as const }]
      : orderBy;

    // ----- Relation slices (deep vs light) -----
    const relationSlice = deep ? {} : { take: 3 };
    const select = {
      // Scalars
      id: true,
      name: true,
      status: true,
      priority: true,
      dueDate: true,
      createdAt: true,
      updatedAt: true,
      completedAt: true,

      idealDurationMinutes: true,
      actualDurationMinutes: true,
      performanceRating: true,

      completionLink: true,
      email: true,
      password: true,
      username: true,
      notes: true,
      reassignNotes: true,

      assignmentId: true,
      clientId: true,
      categoryId: true,
      assignedToId: true,
      templateSiteAssetId: true,

      // Relations needed by UI
      category: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true, email: true, image: true } },
      client: {
        select: {
          id: true,
          name: true,
          company: true,
          avatar: true,
          status: true,
          package: { select: { id: true, name: true } },
        },
      },
      templateSiteAsset: {
        select: { id: true, type: true, name: true, url: true, description: true },
      },

      // Recent activity (limited unless deep=1)
      comments: {
        orderBy: { date: "desc" as const },
        ...relationSlice,
        select: {
          id: true,
          text: true,
          date: true,
          author: { select: { id: true, name: true, email: true, image: true } },
        },
      },
      reports: {
        orderBy: { date: "desc" as const },
        ...relationSlice,
        select: {
          id: true,
          text: true,
          severity: true,
          date: true,
          author: { select: { id: true, name: true, email: true, image: true } },
        },
      },
      notifications: {
        orderBy: { createdAt: "desc" as const },
        ...relationSlice,
        select: {
          id: true,
          type: true,
          message: true,
          isRead: true,
          createdAt: true,
          user: { select: { id: true, name: true, email: true } },
        },
      },
    } as const;

    if (cycleHeadersOnly) {
      const sqlClauses: Prisma.Sql[] = [];
      if (clientId) sqlClauses.push(Prisma.sql`"clientId" = ${clientId}`);
      if (assignedToId)
        sqlClauses.push(Prisma.sql`"assignedToId" = ${assignedToId}`);
      if (status && status !== "all")
        sqlClauses.push(Prisma.sql`"status" = ${status}`);
      if (priority && priority !== "all")
        sqlClauses.push(Prisma.sql`"priority" = ${priority}`);
      if (category && category !== "all")
        sqlClauses.push(
          Prisma.sql`"categoryId" IN (SELECT "id" FROM "TaskCategory" WHERE "name" = ${category})`
        );

      if (cycleKeyParam === "No Due Date") {
        sqlClauses.push(Prisma.sql`"dueDate" IS NULL`);
      } else if (cycleDate) {
        const cycleDateStr = cycleDate.toISOString().slice(0, 10);
        sqlClauses.push(Prisma.sql`DATE("dueDate") = ${cycleDateStr}`);
      } else {
        if (startDateRaw)
          sqlClauses.push(Prisma.sql`"dueDate" >= ${startOfDay(startDateRaw)}`);
        if (endDateRaw)
          sqlClauses.push(Prisma.sql`"dueDate" <= ${endOfDay(endDateRaw)}`);
      }

      if (q) {
        const pattern = `%${q}%`;
        sqlClauses.push(
          Prisma.sql`("name" ILIKE ${pattern} OR "notes" ILIKE ${pattern} OR "username" ILIKE ${pattern} OR "email" ILIKE ${pattern} OR "completionLink" ILIKE ${pattern})`
        );
      }

      const whereSql =
        sqlClauses.length > 0
          ? Prisma.sql`WHERE ${Prisma.join(sqlClauses, " AND ")}`
          : Prisma.sql``;

      const cycles = await prisma.$queryRaw<
        { cycleKey: string; label: string; count: number }[]
      >(
        Prisma.sql`
          SELECT
            COALESCE(TO_CHAR(DATE("dueDate"), 'YYYY-MM-DD'), 'No Due Date') AS "cycleKey",
            COALESCE(TO_CHAR(DATE("dueDate"), 'Mon DD, YYYY'), 'No Due Date') AS "label",
            COUNT(*)::int AS "count"
          FROM "Task"
          ${whereSql}
          GROUP BY COALESCE(TO_CHAR(DATE("dueDate"), 'YYYY-MM-DD'), 'No Due Date'), COALESCE(TO_CHAR(DATE("dueDate"), 'Mon DD, YYYY'), 'No Due Date')
          ORDER BY (COALESCE(TO_CHAR(DATE("dueDate"), 'YYYY-MM-DD'), 'No Due Date') = 'No Due Date'), COALESCE(TO_CHAR(DATE("dueDate"), 'YYYY-MM-DD'), 'No Due Date')
        `
      );

      return NextResponse.json({
        cycles,
        tasks: [],
        summary: {
          total: cycles.reduce((a, c) => a + c.count, 0),
          countsByStatus: {},
          countsByPriority: {},
          countsByCategory: {},
        },
      });
    }

    // ----- Query -----
    const tasks = await prisma.task.findMany({
      where,
      orderBy: orderByFinal,
      select,
      // No limit when fetching specific cycle - get all tasks for that cycle
    });

    // ----- Summary (based on returned slice, like your UI expects) -----
    const countsByStatus = tasks.reduce<Record<string, number>>((acc, t) => {
      acc[t.status] = (acc[t.status] ?? 0) + 1;
      return acc;
    }, {});
    const countsByPriority = tasks.reduce<Record<string, number>>((acc, t) => {
      acc[t.priority] = (acc[t.priority] ?? 0) + 1;
      return acc;
    }, {});
    const countsByCategory = tasks.reduce<Record<string, number>>((acc, t) => {
      const c = t.category?.name ?? "Uncategorized";
      acc[c] = (acc[c] ?? 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({
      tasks,
      summary: {
        total: tasks.length,
        countsByStatus,
        countsByPriority,
        countsByCategory,
      },
      meta: {
        limit,
        deep,
        sort,
        appliedFilters: {
          clientId: clientId ?? null,
          assignedToId: assignedToId ?? null,
          status: status ?? null,
          priority: priority ?? null,
          category: category ?? null,
          q: q || null,
          startDate: startDateRaw ? startOfDay(startDateRaw) : null,
          endDate: endDateRaw ? endOfDay(endDateRaw) : null,
        },
      },
    });
  } catch (err: any) {
    console.error("GET /api/tasks/created error:", err);
    return NextResponse.json(
      { message: "Internal Server Error", error: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
