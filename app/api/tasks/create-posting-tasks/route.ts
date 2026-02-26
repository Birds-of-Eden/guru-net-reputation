// app/api/tasks/create-posting-tasks/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { type NextRequest, NextResponse } from "next/server";
import type { TaskPriority, TaskStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import { addWorkingDays, calculateTaskDueDate } from "@/utils/working-days";
import { resolveIdealDurationDynamic } from "@/utils/resolve-ideal-duration";
import { getRuntimeTaskDurationConfig } from "@/app/api/settings/task-duration/config";
import { getDefaultCategoryBySlug, normalizeAssetTypeSlug } from "@/lib/asset-types";
import { fetchAssetTypeMap, resolveCategoryFromMap, type AssetTypeRecord } from "@/lib/asset-types.server";

// ---------- Constants ----------
const PREREQ_ASSET_TYPES = [
  "social_site",
  "web2_site",
  "other_asset",
] as const;
const CAT_SOCIAL_ACTIVITY = "Social Activity";
const CAT_BLOG_POSTING = "Blog Posting";
const CAT_GRAPHICS_DESIGN = "Graphics Design";
const CAT_IMAGE_OPTIMIZATION = "Image Optimization";
const CAT_CONTENT_STUDIO = "Content Studio";
const CAT_CONTENT_WRITING = "Content Writing";
const CAT_BACKLINKS = "Backlinks";
const CAT_COMPLETED_COM = "Completed.com";
const CAT_YOUTUBE_VIDEO_OPTIMIZATION = "YouTube Video Optimization";
const CAT_MONITORING = "Monitoring";
const CAT_REVIEW_REMOVAL = "Review Removal";
const CAT_SUMMARY_REPORT = "Summary Report";
const CAT_GUEST_POSTING = "Guest Posting";

// 👉 NEW
const CAT_SOCIAL_COMMUNICATION = "Social Communication";
const WEB2_FIXED_PLATFORMS = ["medium", "tumblr", "wordpress"] as const;

const CATEGORY_BY_ASSET_TYPE: Record<string, string> = {
  social_site: CAT_SOCIAL_ACTIVITY,
  web2_site: CAT_BLOG_POSTING,
  other_asset: CAT_SOCIAL_ACTIVITY,
  graphics_design: CAT_GRAPHICS_DESIGN,
  image_optimization: CAT_IMAGE_OPTIMIZATION,
  content_studio: CAT_CONTENT_STUDIO,
  content_writing: CAT_CONTENT_WRITING,
  backlinks: CAT_BACKLINKS,
  completed_com: CAT_COMPLETED_COM,
  youtube_video_optimization: CAT_YOUTUBE_VIDEO_OPTIMIZATION,
  monitoring: CAT_MONITORING,
  review_removal: CAT_REVIEW_REMOVAL,
  summary_report: CAT_SUMMARY_REPORT,
  guest_posting: CAT_GUEST_POSTING,
};

// --- NEW: Web2 fixed platform metadata (label + default URL)
const PLATFORM_META: Record<
  "medium" | "tumblr" | "wordpress",
  { label: string; url: string }
> = {
  medium: { label: "Medium", url: "https://medium.com/" },
  tumblr: { label: "Tumblr", url: "https://www.tumblr.com/" },
  wordpress: { label: "Wordpress", url: "https://wordpress.com/" },
};

// ---------- Helpers ----------
function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

function normalizeTaskPriority(v: unknown): TaskPriority {
  switch (String(v ?? "").toLowerCase()) {
    case "low":
      return "low";
    case "medium":
      return "medium";
    case "high":
      return "high";
    case "urgent":
      return "urgent";
    default:
      return "medium";
  }
}

function resolveCategoryFromType(
  assetType: string | undefined,
  assetTypeMap: Map<string, AssetTypeRecord>,
  fallbackMap: Record<string, string>
): string {
  return resolveCategoryFromMap(
    assetType ?? "",
    CATEGORY_BY_ASSET_TYPE,
    assetTypeMap,
    fallbackMap,
    CAT_SOCIAL_ACTIVITY
  );
}

function baseNameOf(name: string): string {
  return String(name)
    .replace(/\s*-\s*\d+$/i, "")
    .trim();
}

// Track the highest existing cycle per (category, baseName) so we can resume
// numbering instead of recreating early cycles.
function buildMaxCycleMap(
  tasks: { name: string; category?: { name?: string | null } | null }[],
  allowedCategories: Set<string>
) {
  const map = new Map<string, number>();
  for (const t of tasks) {
    const catName = t.category?.name ?? "";
    if (!allowedCategories.has(catName)) continue;
    const base = baseNameOf(t.name);
    if (!base) continue;
    const match = String(t.name).match(/\s*-\s*(\d+)\s*$/i);
    if (!match) continue; // only count explicit cycles like "Name -1"
    const cycle = Number.parseInt(match[1], 10);
    if (!Number.isFinite(cycle) || cycle <= 0) continue;
    const key = `${catName}::${base}`;
    const prev = map.get(key) ?? 0;
    if (cycle > prev) map.set(key, cycle);
  }
  return map;
}

function getFrequency(opts: {
  required?: number | null | undefined;
  defaultFreq?: number | null | undefined;
}): number {
  const fromRequired = Number(opts.required);
  if (Number.isFinite(fromRequired) && fromRequired! >= 0)
    return Math.floor(fromRequired);
  const fromDefault = Number(opts.defaultFreq);
  if (Number.isFinite(fromDefault) && fromDefault! >= 0)
    return Math.floor(fromDefault);
  return 0;
}

function countByStatus(tasks: { status: TaskStatus }[]) {
  const base: Record<TaskStatus, number> = {
    pending: 0,
    in_progress: 0,
    completed: 0,
    overdue: 0,
    cancelled: 0,
    reassigned: 0,
    qc_approved: 0,
    paused: 0,
    data_entered: 0,
  };
  for (const t of tasks) base[t.status] += 1;
  return base;
}

function safeErr(err: unknown) {
  const anyErr = err as any;
  return {
    name: anyErr?.name ?? null,
    code: anyErr?.code ?? null,
    message: anyErr?.message ?? String(anyErr),
    meta: anyErr?.meta ?? null,
  };
}

function fail(stage: string, err: unknown, http = 500) {
  const e = safeErr(err);
  console.error(`[create-posting-tasks] ${stage} ERROR:`, err);
  return NextResponse.json(
    { message: "Internal Server Error", stage, error: e },
    { status: http }
  );
}

// --- NEW: Helpers to match web2 platform from task name and collect creds from web2 sources
function normalize(str: string) {
  return String(str).toLowerCase().replace(/\s+/g, " ").trim();
}

function matchPlatformFromWeb2Name(
  name: string
): "medium" | "tumblr" | "wordpress" | null {
  const n = normalize(name);
  if (/\bmedium\b/.test(n)) return "medium";
  if (/\btumblr\b/.test(n)) return "tumblr";
  // WordPress/Wordpress/word press—সব ধরার জন্য
  if (/\bwordpress\b/.test(n) || /\bword\s*press\b/.test(n)) return "wordpress";
  return null;
}

/**
 * কেবল web2_site সোর্স টাস্ক থেকেই প্ল্যাটফর্মভিত্তিক পুরো ক্রেডেনশিয়াল টেনে আনবে।
 * শর্ত: username, email, password, completionLink (url) — চারটিই থাকতে হবে।
 */
function collectWeb2PlatformSources(
  srcTasks: {
    name: string;
    username: string | null;
    email: string | null;
    password: string | null;
    completionLink: string | null;
    templateSiteAsset?: { type: string | null } | null;
    idealDurationMinutes?: number | null;
  }[]
) {
  const map = new Map<
    "medium" | "tumblr" | "wordpress",
    {
      username: string;
      email: string;
      password: string;
      url: string;
      label: string;
      idealDurationMinutes?: number | null;
    }
  >();

  for (const t of srcTasks) {
    if (t.templateSiteAsset?.type !== "web2_site") continue;

    const p = matchPlatformFromWeb2Name(t.name);
    if (!p) continue;

    const username = t.username ?? "";
    const email = t.email ?? "";
    const password = t.password ?? "";
    const url = t.completionLink ?? ""; // url হিসেবে completionLink
    const idealDurationMinutes = t.idealDurationMinutes ?? null;

    // চারটিই না থাকলে স্কিপ
    if (!username || !email || !password || !url) continue;

    // প্রথম ম্যাচটাই রাখছি (প্রয়োজনে স্কোরিং/বেস্ট পিক করতে পারেন)
    if (!map.has(p)) {
      map.set(p, {
        username,
        email,
        password,
        url,
        label: PLATFORM_META[p].label,
        idealDurationMinutes,
      });
    }
  }
  return map;
}

// Node 18+ has global crypto.randomUUID()
const makeId = () =>
  `task_${Date.now()}_${
    globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
  }`;

// ---------- GET: preview ----------
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId") ?? undefined;
    const templateIdRaw = searchParams.get("templateId") ?? undefined;
    const onlyType = searchParams.get("onlyType") ?? undefined;

    if (!clientId)
      return NextResponse.json(
        { message: "clientId is required" },
        { status: 400 }
      );

    // Quick DB preflight (surfaces P1001/P1017 immediately)
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (e) {
      return fail("GET.db-preflight", e);
    }

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        packageId: true,
        package: { select: { totalMonths: true } },
      },
    });

    if (!client)
      return NextResponse.json(
        { message: "Client not found" },
        { status: 404 }
      );

    // months = normalized package months (min 1; capped to avoid accidents)
    const packageTotalMonthsRaw = Number(client.package?.totalMonths ?? 1);
    const packageTotalMonths =
      Number.isFinite(packageTotalMonthsRaw) && packageTotalMonthsRaw > 0
        ? Math.min(Math.floor(packageTotalMonthsRaw), 120)
        : 1;

    const templateId =
      templateIdRaw === "none" || templateIdRaw === "" ? null : templateIdRaw;
    const assignment =
      templateIdRaw !== undefined
        ? await prisma.assignment.findFirst({
            where: {
              clientId,
              ...(templateIdRaw !== undefined
                ? { templateId: templateId ?? undefined }
                : {}),
            },
            orderBy: { assignedAt: "desc" },
          select: { id: true, templateId: true },
        })
        : await prisma.assignment.findFirst({
            where: {
              clientId,
              template: {
                packageId: client.packageId ?? undefined,
              },
            },
            orderBy: { assignedAt: "desc" },
            select: { id: true, templateId: true },
          });
    const fallbackAssignment =
      assignment ??
      (await prisma.assignment.findFirst({
        where: { clientId },
        orderBy: { assignedAt: "desc" },
        select: { id: true, templateId: true },
      }));
    if (!fallbackAssignment) {
      return NextResponse.json(
        {
          message:
            "No existing assignment found for this client. Please create one first.",
        },
        { status: 404 }
      );
    }

    const assetTypeMap = await fetchAssetTypeMap();
    const fallbackCategoryMap = getDefaultCategoryBySlug();
    const normalizedOnlyType = onlyType
      ? normalizeAssetTypeSlug(onlyType)
      : undefined;
    const allowedTypes = Array.from(assetTypeMap.keys());
    if (
      normalizedOnlyType &&
      allowedTypes.length > 0 &&
      !allowedTypes.includes(normalizedOnlyType)
    ) {
      return NextResponse.json(
        { message: "Invalid asset type", assetType: normalizedOnlyType },
        { status: 400 }
      );
    }
    const typeFilter = normalizedOnlyType
      ? { type: normalizedOnlyType }
      : allowedTypes.length
        ? { type: { in: allowedTypes as unknown as string[] } }
        : {};

    const sourceTasks = await prisma.task.findMany({
      where: {
        assignmentId: fallbackAssignment.id,
        templateSiteAsset: {
          is: {
            ...typeFilter,
          },
        },
      },
      select: {
        id: true,
        name: true,
        status: true,
        priority: true,
        idealDurationMinutes: true,
        completionLink: true,
        email: true,
        password: true,
        username: true,
        notes: true,
        templateSiteAsset: {
          select: {
            id: true,
            type: true,
            defaultPostingFrequency: true,
            defaultIdealDurationMinutesForPosting: true,
          },
        },
      },
    });

    const templateAssets = fallbackAssignment.templateId
      ? await prisma.templateSiteAsset.findMany({
          where: { templateId: fallbackAssignment.templateId },
          select: {
            id: true,
            name: true,
            type: true,
            defaultPostingFrequency: true,
            defaultIdealDurationMinutesForPosting: true,
          },
        })
      : [];

    const normalizeKey = (name: string, type: string) =>
      `${normalizeAssetTypeSlug(type)}::${String(name)
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim()}`;

    const sourceByKey = new Map(
      sourceTasks.map((t) => {
        const base = baseNameOf(t.name || "").replace(/\s*task\s*$/i, "").trim();
        const type = t.templateSiteAsset?.type ?? "";
        return [normalizeKey(base, type), t];
      })
    );

    const syntheticTasks = templateAssets
      .filter((a) => {
        const base = String(a.name ?? "").trim();
        const key = normalizeKey(base, a.type ?? "");
        return base && !sourceByKey.has(key);
      })
      .map((a) => ({
        id: `synthetic-${a.id}`,
        name: `${String(a.name ?? "").trim()} Task`,
        status: "qc_approved" as TaskStatus,
        priority: "medium" as const,
        idealDurationMinutes: a.defaultIdealDurationMinutesForPosting ?? null,
        completionLink: null,
        email: null,
        password: null,
        username: null,
        notes: null,
        templateSiteAsset: {
          id: a.id,
          type: a.type ?? null,
          defaultPostingFrequency: a.defaultPostingFrequency ?? null,
          defaultIdealDurationMinutesForPosting:
            a.defaultIdealDurationMinutesForPosting ?? null,
        },
      }));

    const augmentedSourceTasks = [...sourceTasks, ...syntheticTasks];

    const countsByStatus = countByStatus(augmentedSourceTasks as any);
    const prereqTasks = augmentedSourceTasks.filter((t) => {
      const type = normalizeAssetTypeSlug(t.templateSiteAsset?.type ?? "");
      return (PREREQ_ASSET_TYPES as readonly string[]).includes(type);
    });
    const allApproved =
      prereqTasks.length > 0 &&
      prereqTasks.every((t) => t.status === "qc_approved");

    const assetIds = Array.from(
      new Set(
        augmentedSourceTasks
          .map((s) => s.templateSiteAsset?.id)
          .filter((v): v is number => typeof v === "number")
      )
    );
    const settings = assetIds.length
      ? await prisma.assignmentSiteAssetSetting.findMany({
          where: {
            assignmentId: fallbackAssignment.id,
            templateSiteAssetId: { in: assetIds },
          },
          select: { templateSiteAssetId: true, requiredFrequency: true },
        })
      : [];
    const requiredByAssetId = new Map<number, number | null | undefined>();
    for (const s of settings)
      requiredByAssetId.set(s.templateSiteAssetId, s.requiredFrequency);

    const tasks = augmentedSourceTasks.map((src) => {
      const assetId = src.templateSiteAsset?.id;
      const freq = getFrequency({
        required: assetId ? requiredByAssetId.get(assetId) : undefined,
        defaultFreq: src.templateSiteAsset?.defaultPostingFrequency,
      });
      const assetType = normalizeAssetTypeSlug(
        src.templateSiteAsset?.type ?? ""
      );
      return {
        id: src.id,
        name: src.name,
        baseName: baseNameOf(src.name),
        status: src.status,
        priority: src.priority,
        assetType,
        // multiply original frequency by package months
        frequency: freq * packageTotalMonths,
        categoryName: resolveCategoryFromType(
          assetType,
          assetTypeMap,
          fallbackCategoryMap
        ),
      };
    });

    // --- NEW: Build Social Communication previews ---

    // social_site + other_asset: প্রতি অ্যাসেটে ১টা করে SC
    const scAssetSources = augmentedSourceTasks.filter((s) => {
      const t = normalizeAssetTypeSlug(s.templateSiteAsset?.type ?? "");
      return t === "social_site" || t === "other_asset";
    });

    const scFromAssets = scAssetSources.map((src) => ({
      id: `${src.id}::sc-asset`,
      name: `${baseNameOf(src.name) || "Social"} - ${CAT_SOCIAL_COMMUNICATION}`,
      baseName: baseNameOf(src.name) || "Social",
      status: src.status,
      priority: src.priority,
      assetType: (normalizeAssetTypeSlug(
        src.templateSiteAsset?.type ?? "other_asset"
      ) || "other_asset") as "social_site" | "other_asset",
      frequency: 1,
      categoryName: CAT_SOCIAL_COMMUNICATION,
    }));

    // ফিক্সড ৩টা web2 প্ল্যাটফর্ম (অবিকল আগের মতোই)
    const scFromWeb2Fixed = WEB2_FIXED_PLATFORMS.map((p) => ({
      id: `sc-web2-${p}`,
      name: `${
        p.charAt(0).toUpperCase() + p.slice(1)
      } - ${CAT_SOCIAL_COMMUNICATION}`,
      baseName: p.charAt(0).toUpperCase() + p.slice(1),
      status: "qc_approved" as TaskStatus,
      priority: "medium" as const,
      assetType: "web2_site" as const,
      frequency: 1,
      categoryName: CAT_SOCIAL_COMMUNICATION,
    }));

    // আগের + নতুন SC প্রিভিউ একসাথে
    const tasksWithSC = [...tasks, ...scFromAssets, ...scFromWeb2Fixed];

    // ----- Accurate preview: account for existing tasks + missing web2 creds -----
    const postingCategories = Array.from(
      new Set(
        sourceTasks.map((t) =>
          resolveCategoryFromType(
            t.templateSiteAsset?.type ?? "",
            assetTypeMap,
            fallbackCategoryMap
          )
        )
      )
    );
    const dedupeCategories = [...postingCategories, CAT_SOCIAL_COMMUNICATION];
    const existingCopies = await prisma.task.findMany({
      where: {
        clientId,
        category: { is: { name: { in: dedupeCategories } } },
      },
      select: { name: true, category: { select: { name: true } } },
    });
    const skipNameSet = new Set(existingCopies.map((t) => t.name));
    const maxCycleMap = buildMaxCycleMap(
      existingCopies,
      new Set(postingCategories)
    );

    let totalWillCreate = 0;

    // Expanded copies (Social Activity / Blog Posting) — resume from last existing cycle
    for (const task of tasks) {
      const key = `${task.categoryName}::${task.baseName}`;
      const start = (maxCycleMap.get(key) ?? 0) + 1;
      const totalCopies = task.frequency;
      if (totalCopies <= 0) continue;
      for (let i = start; i <= totalCopies; i++) {
        const name = `${task.baseName} -${i}`;
        if (!skipNameSet.has(name)) {
          totalWillCreate += 1;
          skipNameSet.add(name);
        }
      }
    }

    // Social Communication from assets
    for (const sc of scFromAssets) {
      if (!skipNameSet.has(sc.name)) {
        totalWillCreate += 1;
        skipNameSet.add(sc.name);
      }
    }

    // Social Communication for fixed web2 platforms (always count; creds optional)
    for (const p of WEB2_FIXED_PLATFORMS) {
      const scName = `${PLATFORM_META[p].label} - ${CAT_SOCIAL_COMMUNICATION}`;
      if (skipNameSet.has(scName)) continue;
      totalWillCreate += 1;
      skipNameSet.add(scName);
    }

    return NextResponse.json({
      message: "Preview of source tasks for copying.",
      assignmentId: fallbackAssignment.id,
      tasks: tasksWithSC,
      countsByStatus,
      allApproved,
      totalWillCreate,
      packageTotalMonths, // added
      runtime: "nodejs",
    });
  } catch (err) {
    return fail("GET.catch", err);
  }
}

// ---------- POST: create (SC dueDate = last social posting cycle) ----------
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const clientId: string | undefined = body?.clientId;
    const templateIdRaw: string | undefined = body?.templateId;
    const onlyType: string | undefined = body?.onlyType;
    const firstCycleDueDateRaw: unknown = body?.firstCycleDueDate;
    // NEW: allow filtering by TemplateSiteAsset ids
    const includeAssetIdsRaw = Array.isArray(body?.includeAssetIds)
      ? body?.includeAssetIds
      : undefined;
    const excludeAssetIdsRaw = Array.isArray(body?.excludeAssetIds)
      ? body?.excludeAssetIds
      : undefined;
    const includeAssetIds = includeAssetIdsRaw
      ?.map((n: any) => Number(n))
      .filter((n: number) => Number.isFinite(n));
    const excludeAssetIds = excludeAssetIdsRaw
      ?.map((n: any) => Number(n))
      .filter((n: number) => Number.isFinite(n));

    if (!clientId)
      return NextResponse.json(
        { message: "clientId is required" },
        { status: 400 }
      );

    if (!firstCycleDueDateRaw) {
      return NextResponse.json(
        { message: "firstCycleDueDate is required" },
        { status: 400 }
      );
    }

    const firstCycleDueDate = new Date(String(firstCycleDueDateRaw));
    if (!Number.isFinite(firstCycleDueDate.getTime())) {
      return NextResponse.json(
        { message: "Invalid firstCycleDueDate" },
        { status: 400 }
      );
    }

    // Treat the user-selected date as Cycle-1 due date.
    // Next cycles follow your cadence: +5 working days per cycle.
    const dueDateFromFirstCycleDueDate = (cycleNumber: number) => {
      const n = Math.max(1, Math.floor(cycleNumber));
      if (n === 1) return new Date(firstCycleDueDate);
      let d = new Date(firstCycleDueDate);
      for (let i = 2; i <= n; i++) {
        d = addWorkingDays(d, 5);
      }
      return d;
    };

    // DB preflight
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (e) {
      return fail("POST.db-preflight", e);
    }

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        packageId: true,
        package: { select: { totalMonths: true } },
      },
    });

    if (!client)
      return NextResponse.json(
        { message: "Client not found" },
        { status: 404 }
      );

    // months = normalized package months (min 1; capped)
    const monthsRaw = Number(client.package?.totalMonths ?? 1);
    const months =
      Number.isFinite(monthsRaw) && monthsRaw > 0
        ? Math.min(Math.floor(monthsRaw), 120)
        : 1;

    const templateId = templateIdRaw === "none" ? null : templateIdRaw;
    const assignment =
      templateIdRaw !== undefined
        ? await prisma.assignment.findFirst({
            where: {
              clientId,
              ...(templateId !== undefined
                ? { templateId: templateId ?? undefined }
                : {}),
            },
            orderBy: { assignedAt: "desc" },
          select: { id: true, templateId: true },
        })
        : await prisma.assignment.findFirst({
            where: {
              clientId,
              template: {
                packageId: client.packageId ?? undefined,
              },
            },
            orderBy: { assignedAt: "desc" },
            select: { id: true, templateId: true },
          });
    const fallbackAssignment =
      assignment ??
      (await prisma.assignment.findFirst({
        where: { clientId },
        orderBy: { assignedAt: "desc" },
        select: { id: true, templateId: true },
      }));
    if (!fallbackAssignment) {
      return NextResponse.json(
        {
          message:
            "No existing assignment found for this client. Please create one first.",
        },
        { status: 404 }
      );
    }

    const assetTypeMap = await fetchAssetTypeMap();
    const fallbackCategoryMap = getDefaultCategoryBySlug();
    const normalizedOnlyType = onlyType
      ? normalizeAssetTypeSlug(onlyType)
      : undefined;
    const allowedTypes = Array.from(assetTypeMap.keys());
    if (
      normalizedOnlyType &&
      allowedTypes.length > 0 &&
      !allowedTypes.includes(normalizedOnlyType)
    ) {
      return NextResponse.json(
        { message: "Invalid asset type", assetType: normalizedOnlyType },
        { status: 400 }
      );
    }
    const typeFilter = normalizedOnlyType
      ? { type: normalizedOnlyType }
      : allowedTypes.length
        ? { type: { in: allowedTypes as unknown as string[] } }
        : {};

    const sourceTasks = await prisma.task.findMany({
      where: {
        assignmentId: fallbackAssignment.id,
        templateSiteAsset: {
          is: {
            ...typeFilter,
            // NEW: asset id include/exclude filters
            ...(includeAssetIds && includeAssetIds.length
              ? { id: { in: includeAssetIds as any } }
              : {}),
            ...(excludeAssetIds && excludeAssetIds.length
              ? { id: { notIn: excludeAssetIds as any } }
              : {}),
          },
        },
      },
      select: {
        id: true,
        name: true,
        status: true,
        priority: true,
        idealDurationMinutes: true,
        completionLink: true,
        email: true,
        password: true,
        username: true,
        notes: true,
        createdAt: true,
        templateSiteAsset: {
          select: {
            id: true,
            type: true,
            defaultPostingFrequency: true,
            defaultIdealDurationMinutesForPosting: true,
          },
        },
      },
    });

    const templateAssets = fallbackAssignment.templateId
      ? await prisma.templateSiteAsset.findMany({
          where: { templateId: fallbackAssignment.templateId },
          select: {
            id: true,
            name: true,
            type: true,
            defaultPostingFrequency: true,
            defaultIdealDurationMinutesForPosting: true,
          },
        })
      : [];

    const normalizeKey = (name: string, type: string) =>
      `${normalizeAssetTypeSlug(type)}::${String(name)
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim()}`;

    const sourceByKey = new Map(
      sourceTasks.map((t) => {
        const base = baseNameOf(t.name || "").replace(/\s*task\s*$/i, "").trim();
        const type = t.templateSiteAsset?.type ?? "";
        return [normalizeKey(base, type), t];
      })
    );

    const syntheticTasks = templateAssets
      .filter((a) => {
        const base = String(a.name ?? "").trim();
        const key = normalizeKey(base, a.type ?? "");
        return base && !sourceByKey.has(key);
      })
      .map((a) => ({
        id: `synthetic-${a.id}`,
        name: `${String(a.name ?? "").trim()} Task`,
        status: "qc_approved" as TaskStatus,
        priority: "medium" as const,
        idealDurationMinutes: a.defaultIdealDurationMinutesForPosting ?? null,
        completionLink: null,
        email: null,
        password: null,
        username: null,
        notes: null,
        createdAt: new Date(),
        templateSiteAsset: {
          id: a.id,
          type: a.type ?? null,
          defaultPostingFrequency: a.defaultPostingFrequency ?? null,
          defaultIdealDurationMinutesForPosting:
            a.defaultIdealDurationMinutesForPosting ?? null,
        },
      }));

    const augmentedSourceTasks = [...sourceTasks, ...syntheticTasks];

    if (!augmentedSourceTasks.length) {
      return NextResponse.json(
        { message: "No source tasks found to copy.", tasks: [] },
        { status: 200 }
      );
    }

    // QC gate
    const notApproved = augmentedSourceTasks.filter((t) => {
      const type = normalizeAssetTypeSlug(t.templateSiteAsset?.type ?? "");
      if (!(PREREQ_ASSET_TYPES as readonly string[]).includes(type)) return false;
      return t.status !== "qc_approved";
    });
    if (notApproved.length) {
      return NextResponse.json(
        {
          message:
            "All source tasks must be 'qc_approved' before creating posting tasks.",
          notApprovedTaskIds: notApproved.map((t) => t.id),
          countsByStatus: countByStatus(sourceTasks as any),
        },
        { status: 400 }
      );
    }

    // --- NEW: Build creds map for Medium/Tumblr/Wordpress strictly from web2 sources
    const web2PlatformCreds = collectWeb2PlatformSources(augmentedSourceTasks as any);

    // per-asset frequency overrides
    const assetIds = Array.from(
      new Set(
        augmentedSourceTasks
          .map((s) => s.templateSiteAsset?.id)
          .filter((v): v is number => typeof v === "number")
      )
    );
    const settings = assetIds.length
      ? await prisma.assignmentSiteAssetSetting.findMany({
          where: {
            assignmentId: fallbackAssignment.id,
            templateSiteAssetId: { in: assetIds },
          },
          select: { templateSiteAssetId: true, requiredFrequency: true },
        })
      : [];
    const requiredByAssetId = new Map<number, number | null | undefined>();
    for (const s of settings)
      requiredByAssetId.set(s.templateSiteAssetId, s.requiredFrequency);

    // Ensure categories WITHOUT relying on unique(name)
    const ensureCategory = async (name: string) => {
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
      } catch (e) {
        const again = await prisma.taskCategory.findFirst({
          where: { name },
          select: { id: true, name: true },
        });
        if (again) return again;
        throw e;
      }
    };

    const postingCategories = Array.from(
      new Set(
        augmentedSourceTasks.map((src) =>
          resolveCategoryFromType(
            src.templateSiteAsset?.type ?? "",
            assetTypeMap,
            fallbackCategoryMap
          )
        )
      )
    );
    const categoryNames = [...postingCategories, CAT_SOCIAL_COMMUNICATION];
    const ensured = await Promise.all(
      categoryNames.map((name) => ensureCategory(name))
    );
    const categoryIdByName = new Map<string, string>(
      ensured.map((c) => [c.name, c.id])
    );

    // Expand copies: (per-asset frequency) × (package months)
    type PostingSource = {
      src: (typeof sourceTasks)[number];
      base: string;
      catName: string;
      totalCopies: number;
    };
    const postingSources: PostingSource[] = [];

    // NEW: Social Activity সিরিজের প্রতিটি base-এর last cycle dueDate ক্যাশ
    const lastCycleDueByBase = new Map<string, Date>();

    for (const src of augmentedSourceTasks) {
      const assetType = normalizeAssetTypeSlug(
        src.templateSiteAsset?.type ?? ""
      );
      const assetId = src.templateSiteAsset?.id;

      const freq = getFrequency({
        required: assetId ? requiredByAssetId.get(assetId) : undefined,
        defaultFreq: src.templateSiteAsset?.defaultPostingFrequency,
      });

      const catName = resolveCategoryFromType(
        assetType,
        assetTypeMap,
        fallbackCategoryMap
      );
      const base = baseNameOf(src.name);

      // total copies = freq * months (0 means skip)
      const totalCopies = freq * months;
      if (totalCopies <= 0) continue;
      postingSources.push({ src, base, catName, totalCopies });

      // NEW: কেবল Social Activity-এর জন্য last cycle dueDate ক্যাশ করো
    }

    // De-dup by name within target cats (3 categories)
    const dedupeCategories = [...postingCategories, CAT_SOCIAL_COMMUNICATION];
    const existingCopies = await prisma.task.findMany({
      where: {
        clientId,
        category: {
          is: {
            name: { in: dedupeCategories },
          },
        },
      },
      select: { name: true, category: { select: { name: true } } },
    });
    const existingNameSet = new Set(existingCopies.map((t) => t.name));
    const skipNameSet = new Set(existingNameSet);
    const maxCycleMap = buildMaxCycleMap(
      existingCopies,
      new Set(postingCategories)
    );

    // NEW: compute last social due date using the highest cycle (existing + new)
    for (const item of postingSources) {
      if (item.catName !== CAT_SOCIAL_ACTIVITY) continue;
      const key = `${item.catName}::${item.base}`;
      const effectiveCycles = Math.max(
        item.totalCopies,
        maxCycleMap.get(key) ?? 0
      );
      const lastDue = dueDateFromFirstCycleDueDate(Math.max(1, effectiveCycles));
      lastCycleDueByBase.set(item.base, lastDue);
    }

    const overridePriority = body?.priority
      ? normalizeTaskPriority(body?.priority)
      : undefined;

    type TaskCreateData = {
      id: string;
      name: string;
      status: TaskStatus;
      priority: TaskPriority;
      idealDurationMinutes?: number | null;
      dueDate: string;
      completionLink?: string | null;
      email?: string | null;
      password?: string | null;
      username?: string | null;
      notes?: string | null;
      assignmentId: string;
      clientId: string;
      categoryId: string;
    };
    const payloads: TaskCreateData[] = [];

    // 1) Original two categories (resume from last existing cycle)
    for (const item of postingSources) {
      const src = item.src;
      const catId = categoryIdByName.get(item.catName)!;
      const key = `${item.catName}::${item.base}`;
      const start = (maxCycleMap.get(key) ?? 0) + 1;
      const totalCopies = item.totalCopies;
      if (totalCopies <= 0) continue;

      for (let cycle = start; cycle <= totalCopies; cycle++) {
        const name = `${item.base} -${cycle}`;
        if (skipNameSet.has(name)) continue;

        const dueDate = dueDateFromFirstCycleDueDate(cycle);

        payloads.push({
          id: makeId(),
          name,
          status: "pending",
          priority: overridePriority ?? src.priority,
          idealDurationMinutes:
            (src.templateSiteAsset?.defaultIdealDurationMinutesForPosting &&
            src.templateSiteAsset.defaultIdealDurationMinutesForPosting > 0
              ? src.templateSiteAsset.defaultIdealDurationMinutesForPosting
              : null) ??
            resolveIdealDurationDynamic(
              name,
              item.catName as "Blog Posting" | "Social Activity",
              getRuntimeTaskDurationConfig()
            ),
          dueDate: dueDate.toISOString(),
          completionLink: src.completionLink ?? undefined,
          email: src.email ?? undefined,
          password: src.password ?? undefined,
          username: src.username ?? undefined,
          notes: src.notes ?? undefined,
          assignmentId: fallbackAssignment.id,
          clientId: clientId,
          categoryId: catId,
        });

        skipNameSet.add(name);
      }
    }

    // Social Communication from assets (social_site + other_asset), 1 per asset
    for (const src of augmentedSourceTasks) {
      const t = normalizeAssetTypeSlug(src.templateSiteAsset?.type ?? "");
      if (t !== "social_site" && t !== "other_asset") continue;

      const base = baseNameOf(src.name) || "Social";
      const scName = `${base} - Social Communication`;
      if (skipNameSet.has(scName)) continue;

      // NEW: ওই base-এর last social cycle due date নাও
      let dueDate = lastCycleDueByBase.get(base);
      if (!dueDate) {
        // very rare fallback: আগে ক্যাশ না থাকলে এখানেই হিসাব করে নাও
        const assetId = src.templateSiteAsset?.id;
        const freq = getFrequency({
          required: assetId ? requiredByAssetId.get(assetId) : undefined,
          defaultFreq: src.templateSiteAsset?.defaultPostingFrequency,
        });
        const totalCopies = Math.max(1, freq * months);
        dueDate = dueDateFromFirstCycleDueDate(totalCopies);
      }

      const catId = categoryIdByName.get(CAT_SOCIAL_COMMUNICATION)!;
      payloads.push({
        id: makeId(),
        name: scName,
        status: "pending",
        priority: overridePriority ?? src.priority,
        idealDurationMinutes:
          (src.templateSiteAsset?.defaultIdealDurationMinutesForPosting &&
          src.templateSiteAsset.defaultIdealDurationMinutesForPosting > 0
            ? src.templateSiteAsset.defaultIdealDurationMinutesForPosting
            : null) ??
          resolveIdealDurationDynamic(
            scName,
            "Social Activity",
            getRuntimeTaskDurationConfig()
          ),
        dueDate: dueDate.toISOString(), // EXACT last social posting due date
        completionLink: src.completionLink ?? undefined,
        email: src.email ?? undefined,
        password: src.password ?? undefined,
        username: src.username ?? undefined,
        notes: src.notes ?? undefined,
        assignmentId: fallbackAssignment.id,
        clientId: clientId,
        categoryId: catId,
      });

      skipNameSet.add(scName);
    }

    // NEW: সব Social Activity বেসের মধ্যে overall last social due date
    const maxLastSocialDue =
      Array.from(lastCycleDueByBase.values())
        .sort((a, b) => a.getTime() - b.getTime())
        .pop() ?? new Date(firstCycleDueDate);

    // --- REPLACE: Fixed Web2 SC creation (creds optional; always create unless duplicate)
    for (const p of ["medium", "tumblr", "wordpress"] as const) {
      const scName = `${PLATFORM_META[p].label} - Social Communication`;
      if (skipNameSet.has(scName)) continue;

      // Use creds if available; otherwise create with empty fields
      const creds = web2PlatformCreds.get(p);

      const catId = categoryIdByName.get(CAT_SOCIAL_COMMUNICATION)!;
      payloads.push({
        id: makeId(),
        name: scName,
        status: "pending",
        priority: overridePriority ?? "medium",
        dueDate: maxLastSocialDue.toISOString(),

        // Optional web2 creds (may be undefined)
        username: creds?.username ?? undefined,
        email: creds?.email ?? undefined,
        password: creds?.password ?? undefined,
        completionLink: creds?.url ?? undefined, // url
        idealDurationMinutes:
          creds?.idealDurationMinutes ??
          resolveIdealDurationDynamic(
            scName,
            "Social Activity",
            getRuntimeTaskDurationConfig()
          ),

        assignmentId: fallbackAssignment.id,
        clientId: clientId,
        categoryId: catId,
      });

      skipNameSet.add(scName);
    }

    if (!payloads.length) {
      return NextResponse.json(
        {
          message:
            "All copies already exist under 'Social Activity' / 'Blog Posting' / 'Social Communication'.",
          created: 0,
          skipped: existingNameSet.size,
          assignmentId: fallbackAssignment.id,
          tasks: [],
        },
        { status: 200 }
      );
    }

    // Batch insert tasks using createMany with chunks of 1000
    const BATCH_SIZE = 300;
    const batches = chunk(payloads, BATCH_SIZE);
    let totalCreated = 0;

    for (const batch of batches) {
      const result = await prisma.task.createMany({
        data: batch,
        skipDuplicates: true,
      });
      totalCreated += result.count;
    }

    // Fetch the created tasks for response
    const createdTasks = await prisma.task.findMany({
      where: {
        id: { in: payloads.map((p) => p.id) },
      },
      select: {
        id: true,
        name: true,
        status: true,
        priority: true,
        createdAt: true,
        dueDate: true,
        idealDurationMinutes: true,
        completionLink: true,
        email: true,
        password: true,
        username: true,
        notes: true,
        assignment: { select: { id: true } },
        category: { select: { id: true, name: true } },
        templateSiteAsset: {
          select: { id: true, name: true, type: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(
      {
        message: `Created ${totalCreated} task(s) across Social Activity, Blog Posting, and Social Communication.`,
        created: totalCreated,
        skipped: Array.from(skipNameSet).length,
        assignmentId: fallbackAssignment.id,
        tasks: createdTasks,
        runtime: "nodejs",
      },
      { status: 201 }
    );
  } catch (err) {
    return fail("POST.catch", err);
  }
}
