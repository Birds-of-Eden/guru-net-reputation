// Shared helpers for client detail API handlers
import prisma from "@/lib/prisma";
import type { TaskStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";

export function coerceSocialMedia(input: any): any[] | undefined {
  if (input === undefined) return undefined;
  if (Array.isArray(input)) return input;
  return [];
}

export async function computeClientProgress(clientId: string) {
  const grouped = await prisma.task.groupBy({
    by: ["status"],
    where: { clientId },
    _count: { _all: true },
  });

  const base: Record<TaskStatus, number> = {
    pending: 0,
    in_progress: 0,
    paused: 0,
    completed: 0,
    overdue: 0,
    cancelled: 0,
    reassigned: 0,
    qc_approved: 0,
    data_entered: 0,
  };

  for (const row of grouped) {
    base[row.status] = row._count._all;
  }

  const total =
    base.pending +
    base.in_progress +
    base.completed +
    base.overdue +
    base.cancelled +
    base.reassigned +
    base.qc_approved;

  const progress = total > 0 ? Math.round((base.completed / total) * 100) : 0;

  return {
    progress,
    taskCounts: {
      total,
      completed: base.completed,
      pending: base.pending,
      in_progress: base.in_progress,
      overdue: base.overdue,
      cancelled: base.cancelled,
      reassigned: base.reassigned,
      qc_approved: base.qc_approved,
    },
  };
}

export async function recalcAndStoreClientProgress(clientId: string) {
  const { progress, taskCounts } = await computeClientProgress(clientId);
  const result = await prisma.client.updateMany({
    where: { id: clientId },
    data: { progress },
  });
  if (result.count === 0) {
    console.warn(
      `recalcAndStoreClientProgress: No client found to update for id=${clientId}`
    );
  }
  return { progress, taskCounts };
}

export async function assertIsAMOrNull(amId: string | null | undefined) {
  if (!amId) return;
  const am = await prisma.user.findUnique({
    where: { id: amId },
    include: { role: true },
  });
  if (!am || am.role?.name !== "am") {
    throw new Error("amId is not an Account Manager (role 'am').");
  }
}

export function buildClientSelect(compact: boolean): Prisma.ClientSelect {
  const base: Prisma.ClientSelect = {
    id: true,
    name: true,
    email: true,
    phone: true,
    avatar: true,
    company: true,
    designation: true,
    location: true,
    birthdate: true,
    gender: true,
    websites: true,
    companywebsite: true,
    companyaddress: true,
    biography: true,
    imageDrivelink: true,
    status: true,
    progress: true,
    startDate: true,
    dueDate: true,
    password: true,
    recoveryEmail: true,
    articleTopics: true,
    otherField: true,
    socialMedia: true,
    packageId: true,
    amId: true,
    createdAt: true,
    updatedAt: true,
    package: {
      select: {
        id: true,
        name: true,
        totalMonths: true,
      },
    },
    accountManager: {
      select: {
        id: true,
        name: true,
        email: true,
        role: {
          select: { id: true, name: true },
        },
      },
    },
  };

  if (!compact) {
    // ⚡ OPTIMIZATION: Limit tasks to 500 for faster loading
    // Clients with 500+ tasks will load the first 500 by creation date
    // This prevents massive data transfers and database strain
    base.tasks = {
      select: {
        id: true,
        name: true,
        status: true,
        priority: true,
        dueDate: true,
        createdAt: true,
        completedAt: true,
        completionLink: true,
        taskCompletionJson: true,
        idealDurationMinutes: true,
        categoryId: true,
        templateSiteAssetId: true,
        assignedToId: true,
        category: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        templateSiteAsset: {
          select: {
            id: true,
            name: true,
            type: true,
            url: true,
          },
        },
        assignedTo: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 500, // ⚡ Limit to 500 most recent tasks
    };

    base.teamMembers = {
      select: {
        agent: {
          select: { id: true, name: true, email: true },
        },
        team: {
          select: { id: true, name: true },
        },
      },
    };
  }

  return base;
}

export const makeId = () =>
  `task_${Date.now()}_${
    globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
  }`;

export const norm = (s: string | null | undefined) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

export const keyOf = (a: {
  name: string | null | undefined;
  type: string | null | undefined;
}) => `${norm(a.type)}::${norm(a.name)}`;

export function stripTaskSuffix(s: string) {
  return String(s)
    .replace(/\s*task\s*$/i, "")
    .trim();
}

export function normalizeForDedupe(s: string) {
  return stripTaskSuffix(
    String(s)
      .replace(/\s*-\s*\d+$/i, "")
      .trim()
  )
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export const CATEGORY_BY_ASSET_TYPE: Record<string, string> = {
  social_site: "Social Asset Creation",
  web2_site: "Web 2.0 Asset Creation",
  other_asset: "Additional Asset Creation",
  image_optimization: "Image Optimization",
  graphics_design: "Graphics Design",
  content_studio: "Content Studio",
  content_writing: "Content Writing",
  backlinks: "Backlinks",
  completed_com: "Completed Communication",
  youtube_video_optimization: "YouTube Video Optimization",
  monitoring: "Monitoring",
  review_removal: "Review Removal",
  summary_report: "Summary Report",
  guest_posting: "Guest Posting",
};

export async function ensureCategoryByName(name: string) {
  const found = await prisma.taskCategory.findFirst({
    where: { name },
    select: { id: true, name: true },
  });
  if (found) return found;
  try {
    return await prisma.taskCategory.create({
      data: { name },
      select: { id: true, name: true },
    });
  } catch {
    return await prisma.taskCategory.findFirst({
      where: { name },
      select: { id: true, name: true },
    });
  }
}

