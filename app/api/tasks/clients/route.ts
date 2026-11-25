// app/api/tasks/clients/route.ts

import { type NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const ASSET_CREATION_TYPES = new Set([
  "social_site",
  "web2_site",
  "other_asset",
]);
const POSTING_CATEGORIES = new Set(["Social Activity", "Blog Posting"]);
const POSTING_COMPLETE_STATUSES = new Set(["completed", "qc_approved"]);

// GET /api/tasks/clients - Get all clients with task stats
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const packageId = searchParams.get("packageId");
  const includeTasks = searchParams.get("includeTasks") === "true";

  // OPTIMIZATION (Prisma select projection): fetch only lightweight client fields + package name.
  const clients = await prisma.client.findMany({
    where: {
      packageId: packageId || undefined,
    },
    select: {
      id: true,
      name: true,
      company: true,
      status: true,
      avatar: true,
      package: { select: { name: true } },
      amId: true,
      createdAt: true,
      accountManager: { select: { id: true, name: true, email: true } },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });

  if (clients.length === 0) {
    return NextResponse.json({ clients: [] });
  }

  const clientIds = clients.map((c) => c.id);

  // OPTIMIZATION: select plain foreign keys and resolve them from small lookup
  // tables, instead of letting Prisma resolve 2-3 relations for every task row
  // (this endpoint reads every task of every client). Output shape is unchanged.
  const [rawTasks, categoryRows, assetRows] = await Promise.all([
    prisma.task.findMany({
      where: { clientId: { in: clientIds } },
      select: {
        id: true,
        name: true,
        status: true,
        dueDate: true,
        clientId: true,
        templateSiteAssetId: true,
        categoryId: true,
        assignedToId: includeTasks,
      },
    }),
    prisma.taskCategory.findMany({ select: { id: true, name: true } }),
    prisma.templateSiteAsset.findMany({ select: { id: true, type: true } }),
  ]);

  const categoryNameById = new Map(categoryRows.map((c) => [c.id, c.name]));
  const assetTypeById = new Map(assetRows.map((a) => [a.id, a.type]));

  const assigneeById = new Map<string, { name: string | null; email: string }>();
  if (includeTasks) {
    const assigneeIds = Array.from(
      new Set(rawTasks.map((t) => t.assignedToId).filter((id): id is string => !!id))
    );
    if (assigneeIds.length) {
      const users = await prisma.user.findMany({
        where: { id: { in: assigneeIds } },
        select: { id: true, name: true, email: true },
      });
      for (const u of users) assigneeById.set(u.id, { name: u.name, email: u.email });
    }
  }

  const tasks = rawTasks.map((t) => {
    const categoryName = t.categoryId ? categoryNameById.get(t.categoryId) : undefined;
    const assetType =
      t.templateSiteAssetId != null ? assetTypeById.get(t.templateSiteAssetId) : undefined;
    return {
      id: t.id,
      name: t.name,
      status: t.status,
      dueDate: t.dueDate,
      clientId: t.clientId,
      templateSiteAsset: assetType !== undefined ? { type: assetType } : null,
      category: categoryName !== undefined ? { name: categoryName } : null,
      ...(includeTasks
        ? { assignedTo: (t.assignedToId && assigneeById.get(t.assignedToId)) || null }
        : {}),
    };
  });

  type Bucket = {
    categories: Record<string, { total: number; completed: number }>;
    assetTypes: Record<string, { total: number; completed: number }>;
    postingCategories: Record<string, { total: number; completed: number }>;
    totalAssetCreation: number;
    completedAssetCreation: number;
    totalPosting: number;
    completedPosting: number;
    totalAll: number;
    createdTasks?: {
      id: string;
      name: string | null;
      status: string;
      dueDate: Date | null;
      assignedTo?: { name: string | null; email: string | null };
      category?: { name: string | null };
    }[];
  };

  // OPTIMIZATION (single-pass aggregation): build stats map per client in one iteration.
  const buckets = new Map<string, Bucket>();
  for (const client of clients) {
    buckets.set(client.id, {
      categories: {},
      assetTypes: {},
      postingCategories: {},
      totalAssetCreation: 0,
      completedAssetCreation: 0,
      totalPosting: 0,
      completedPosting: 0,
      totalAll: 0,
      createdTasks: includeTasks ? [] : undefined,
    });
  }

  for (const task of tasks) {
    const bucket = buckets.get(task.clientId);
    if (!bucket) continue;
    bucket.totalAll += 1;

    const categoryName = task.category?.name ?? null;
    const assetType = task.templateSiteAsset?.type ?? null;

    if (bucket.createdTasks) {
      bucket.createdTasks.push({
        id: task.id,
        name: task.name,
        status: task.status,
        dueDate: task.dueDate,
        assignedTo: (task as any).assignedTo ?? undefined,
        category: task.category ? { name: task.category.name } : undefined,
      });
    }

    if (assetType && ASSET_CREATION_TYPES.has(assetType)) {
      bucket.totalAssetCreation += 1;
      if (task.status === "qc_approved") {
        bucket.completedAssetCreation += 1;
      }

      if (categoryName) {
        bucket.categories[categoryName] ??= { total: 0, completed: 0 };
        bucket.categories[categoryName].total += 1;
        if (task.status === "qc_approved") {
          bucket.categories[categoryName].completed += 1;
        }
      }

      bucket.assetTypes[assetType] ??= { total: 0, completed: 0 };
      bucket.assetTypes[assetType].total += 1;
      if (task.status === "qc_approved") {
        bucket.assetTypes[assetType].completed += 1;
      }
    }

    if (categoryName && POSTING_CATEGORIES.has(categoryName)) {
      bucket.totalPosting += 1;
      if (POSTING_COMPLETE_STATUSES.has(task.status)) {
        bucket.completedPosting += 1;
      }
      bucket.postingCategories[categoryName] ??= {
        total: 0,
        completed: 0,
      };
      bucket.postingCategories[categoryName].total += 1;
      if (POSTING_COMPLETE_STATUSES.has(task.status)) {
        bucket.postingCategories[categoryName].completed += 1;
      }
    }
  }

  const clientsWithTaskStats = clients.map((client) => {
    const bucket = buckets.get(client.id)!;

    // Ready when every asset-creation type that HAS tasks is fully QC approved.
    // A type with 0 tasks (e.g. no Other Asset in the template) has nothing to
    // approve, so it is skipped. At least one asset-creation task must exist.
    const isReadyForTaskCreation =
      bucket.totalAssetCreation > 0 &&
      ["social_site", "web2_site", "other_asset"].every((assetType) => {
        const stats = bucket.assetTypes[assetType];
        return !stats || stats.total === 0 || stats.completed === stats.total;
      });

    const baseStats: any = {
      categories: bucket.categories,
      assetTypes: bucket.assetTypes,
      isReadyForTaskCreation,
      totalTasks: bucket.totalAssetCreation,
      completedTasks: bucket.completedAssetCreation,
      posting: {
        categories: bucket.postingCategories,
        totalPostingTasks: bucket.totalPosting,
        completedPostingTasks: bucket.completedPosting,
        isAllPostingCompleted:
          bucket.totalPosting > 0 && bucket.totalPosting === bucket.completedPosting,
      },
    };

    if (includeTasks && bucket.createdTasks) {
      baseStats.createdTasks = bucket.createdTasks;
    }

    return {
      id: client.id,
      name: client.name ?? null,
      company: client.company ?? null,
      status: client.status ?? null,
      package: client.package ? { name: client.package.name } : null,
      avatar: client.avatar ?? null,
      amId: client.amId ?? null,
      createdAt: client.createdAt,
      totalTaskCount: bucket.totalAll,
      accountManager: client.accountManager
        ? {
            id: client.accountManager.id,
            name: client.accountManager.name,
            email: client.accountManager.email,
          }
        : null,
      postingTasksCreated: bucket.totalPosting > 0,
      existingPostingTasksCount: bucket.totalPosting,
      taskStats: baseStats,
    };
  });

  return NextResponse.json({ clients: clientsWithTaskStats });
}

// POST /api/tasks/clients - Create new client
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      name,
      birthdate,
      company,
      designation,
      location,
      websites,
      companywebsite,
      companyaddress,
      biography,
      imageDrivelink,
      avatar,
      progress,
      status,
      packageId,
      startDate,
      dueDate,
      socialLinks = [],
    } = body;

    const normalizePlatform = (input: unknown): string => {
      const raw = String(input ?? "").trim();
      return raw || "OTHER";
    };

    const client = await prisma.client.create({
      data: {
        name,
        birthdate: birthdate ? new Date(birthdate) : undefined,
        company,
        designation,
        location,
        websites,
        companywebsite,
        companyaddress,
        biography,
        imageDrivelink,
        avatar,
        progress,
        status,
        packageId,
        startDate: startDate ? new Date(startDate) : undefined,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        socialMedias: {
          create: Array.isArray(socialLinks)
            ? socialLinks
                .filter((l: any) => l && l.platform && l.url)
                .map((l: any) => ({
                  platform: normalizePlatform(l.platform) as any,
                  url: l.url as string,
                  username: l.username ?? null,
                  email: l.email ?? null,
                  phone: l.phone ?? null,
                  password: l.password ?? null,
                  notes: l.notes ?? null,
                }))
            : [],
        },
      } as any,
    });

    return NextResponse.json(client, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
