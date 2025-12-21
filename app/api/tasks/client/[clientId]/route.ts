// app/api/tasks/client/[clientId]/route.ts
import { type NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

type Counts = {
  total: number;
  pending: number;
  in_progress: number;
  completed: number;
  overdue: number;
  cancelled: number;
  reassigned: number;
  qc_approved: number;
};

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const EMPTY_COUNTS: Counts = {
  total: 0,
  pending: 0,
  in_progress: 0,
  completed: 0,
  overdue: 0,
  cancelled: 0,
  reassigned: 0,
  qc_approved: 0,
};

const TASK_SELECT = {
  id: true,
  name: true,
  priority: true,
  status: true,
  dueDate: true,
  idealDurationMinutes: true,
  actualDurationMinutes: true,
  performanceRating: true,
  completionLink: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
  email: true,
  username: true,
  password: true,
  notes: true,
  reassignNotes: true,
  qcReview: true,
  qcTotalScore: true,
  clientId: true,
  categoryId: true,
  templateSiteAssetId: true,
  assignment: {
    select: {
      id: true,
      client: { select: { id: true, name: true, avatar: true } },
      template: { select: { id: true, name: true } },
    },
  },
  client: { select: { id: true, name: true, avatar: true } },
  templateSiteAsset: {
    select: {
      id: true,
      name: true,
      type: true,
      url: true,
    },
  },
  category: { select: { id: true, name: true } },
  assignedTo: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      image: true,
    },
  },
} as const;

function parseNumberParam(value: string | null, fallback: number, max: number) {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.min(Math.floor(parsed), max);
  }
  return fallback;
}

function parseExcludedCategories(req: NextRequest): string[] {
  const raw = req.nextUrl.searchParams.get("excludeCategories") ?? "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function excludeCategoriesWhere(excluded: string[]) {
  if (!excluded.length) return null;
  return {
    NOT: {
      category: {
        is: {
          name: { in: excluded },
        },
      },
    },
  } as const;
}

function normalizeStatusCounts(grouped: Array<{ status: string; _count: { _all: number } }>, total: number): Counts {
  const counts: Counts = { ...EMPTY_COUNTS, total };
  for (const row of grouped) {
    const key = row.status as keyof Counts;
    if (key in counts) {
      counts[key] = row._count._all;
    }
  }
  return counts;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
    const { searchParams } = req.nextUrl;

    const agentId = searchParams.get("agentId");
    if (!clientId) {
      return NextResponse.json(
        { error: "clientId is required" },
        { status: 400 }
      );
    }

    const page = parseNumberParam(searchParams.get("page"), 1, Number.MAX_SAFE_INTEGER);
    const pageSize = parseNumberParam(searchParams.get("pageSize"), DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");
    const search = (searchParams.get("search") ?? "").trim();
    const taskId = searchParams.get("taskId");
    const excludedCategories = parseExcludedCategories(req);

    const baseClientFilter = {
      OR: [{ clientId }, { assignment: { clientId } }],
    };

    if (taskId) {
      const task = await prisma.task.findFirst({
        where: {
          id: taskId,
          ...baseClientFilter,
          ...(agentId ? { assignedToId: agentId } : {}),
        },
        select: TASK_SELECT,
      });

      const tasks = task ? [task] : [];
      const total = tasks.length;
      const counts = task
        ? normalizeStatusCounts([{ status: task.status, _count: { _all: 1 } }], total)
        : { ...EMPTY_COUNTS };

      return NextResponse.json({
        tasks,
        page: 1,
        pageSize: 1,
        total,
        totalPages: 1,
        hasMore: false,
        counts,
      });
    }

    const filters: any[] = [baseClientFilter];
    if (agentId) {
      filters.push({ assignedToId: agentId });
    }

    const categoryFilter = excludeCategoriesWhere(excludedCategories);
    if (categoryFilter) filters.push(categoryFilter);

    if (status && status !== "all") {
      filters.push({ status });
    }
    if (priority && priority !== "all") {
      filters.push({ priority });
    }
    if (search) {
      filters.push({
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { completionLink: { contains: search, mode: "insensitive" } },
          { category: { is: { name: { contains: search, mode: "insensitive" } } } },
          { templateSiteAsset: { is: { name: { contains: search, mode: "insensitive" } } } },
        ],
      });
    }

    const where = { AND: filters };
    const skip = (page - 1) * pageSize;

    const [tasks, groupedStatusCounts, total] = await Promise.all([
      prisma.task.findMany({
        where,
        select: TASK_SELECT,
        orderBy: [
          { status: "asc" },
          { priority: "desc" },
          { dueDate: "asc" },
          { createdAt: "desc" },
        ],
        skip,
        take: pageSize,
      }),
      prisma.task.groupBy({
        by: ["status"],
        where,
        _count: { _all: true },
      }),
      prisma.task.count({ where }),
    ]);

    const counts = normalizeStatusCounts(groupedStatusCounts, total);
    const hasMore = skip + tasks.length < total;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return NextResponse.json({
      tasks,
      page,
      pageSize,
      total,
      totalPages,
      hasMore,
      counts,
    });
  } catch (error: any) {
    console.error("Error fetching client tasks (paginated):", error);
    return NextResponse.json(
      { error: "Failed to fetch client tasks", message: error?.message },
      { status: 500 }
    );
  }
}
