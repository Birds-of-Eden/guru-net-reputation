// app/api/tasks/migration-posting-tasks/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import type { TaskPriority, TaskStatus } from "@prisma/client";
import { calculateTaskDueDate, extractCycleNumber } from "@/utils/working-days";
import { getDefaultCategoryBySlug, normalizeAssetTypeSlug } from "@/lib/asset-types";
import {
  fetchAssetTypeMap,
  resolveCategoryFromMap,
  type AssetTypeRecord,
} from "@/lib/asset-types.server";

const CAT_SOCIAL_ACTIVITY = "Social Activity";
const CAT_BLOG_POSTING = "Blog Posting";
const CAT_SOCIAL_COMMUNICATION = "Social Communication";
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

const WEB2_FIXED_PLATFORMS = ["medium", "tumblr", "wordpress"] as const;

const PLATFORM_META: Record<
  "medium" | "tumblr" | "wordpress",
  { label: string; url: string }
> = {
  medium: { label: "Medium", url: "https://medium.com/" },
  tumblr: { label: "Tumblr", url: "https://www.tumblr.com/" },
  wordpress: { label: "Wordpress", url: "https://wordpress.com/" },
};

const makeId = () =>
  `task_${Date.now()}_${
    globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
  }`;

// --- added helpers (for naming & dedupe) ---
function stripTaskSuffix(s: string) {
  return String(s).replace(/\s*task\s*$/i, "").trim();
}
function normalizeForDedupe(s: string) {
  return stripTaskSuffix(String(s).replace(/\s*-\s*\d+$/i, "").trim())
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
// --- end added helpers ---

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

function resolveCategoryFromType(
  assetType: string | undefined | null,
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

// Make baseNameOf strip trailing "-<n>" AND trailing "Task"
function baseNameOf(name: string): string {
  return stripTaskSuffix(String(name).replace(/\s*-\s*\d+$/i, "").trim());
}

function getFrequency(opts: {
  required?: number | null | undefined;
  defaultFreq?: number | null | undefined;
}): number {
  const a = Number(opts.required);
  if (Number.isFinite(a) && a > 0) return Math.floor(a);
  const b = Number(opts.defaultFreq);
  if (Number.isFinite(b) && b > 0) return Math.floor(b);
  return 1;
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
  console.error(`[migration-posting-tasks] ${stage} ERROR:`, err);
  return NextResponse.json(
    { message: "Internal Server Error", stage, error: e },
    { status: http }
  );
}

function normalize(s: string) {
  return String(s).toLowerCase().replace(/\s+/g, " ").trim();
}
function matchPlatformFromWeb2Name(
  name: string
): "medium" | "tumblr" | "wordpress" | null {
  const n = normalize(name);
  if (/\bmedium\b/.test(n)) return "medium";
  if (/\btumblr\b/.test(n)) return "tumblr";
  if (/\bwordpress\b/.test(n) || /\bword\s*press\b/.test(n)) return "wordpress";
  return null;
}

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
    const url = t.completionLink ?? "";
    const idealDurationMinutes = t.idealDurationMinutes ?? null;
    if (!username || !email || !password || !url) continue;
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

// ---------- POST ----------
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const clientId: string | undefined = body?.clientId;
    const templateIdRaw: string | undefined = body?.templateId;
    const onlyType: string | undefined = body?.onlyType;

    const includeAssetIdsRaw = Array.isArray(body?.includeAssetIds)
      ? body?.includeAssetIds
      : undefined;
    // NOTE: Callers are expected to send only the asset IDs that need new posting tasks
    // (e.g., assets that are new to the client). This endpoint does not detect “new vs common”
    // and will attempt creation for whatever IDs it receives (dedupe still protects against dupes).
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

    await prisma.$queryRaw`SELECT 1`;

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, package: { select: { totalMonths: true } } },
    });
    if (!client)
      return NextResponse.json(
        { message: "Client not found" },
        { status: 404 }
      );

    const monthsRaw = Number(client.package?.totalMonths ?? 1);
    const months =
      Number.isFinite(monthsRaw) && monthsRaw > 0
        ? Math.min(Math.floor(monthsRaw), 120)
        : 1;

    const templateId = templateIdRaw === "none" ? null : templateIdRaw;
    const assignment = await prisma.assignment.findFirst({
      where: {
        clientId,
        ...(templateId !== undefined
          ? { templateId: templateId ?? undefined }
          : {}),
      },
      orderBy: { assignedAt: "desc" },
      select: { id: true },
    });
    if (!assignment) {
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
    const normalizedOnlyType = onlyType ? normalizeAssetTypeSlug(onlyType) : undefined;
    const allowedTypes = Array.from(assetTypeMap.keys());
    const typeFilter = normalizedOnlyType
      ? { type: normalizedOnlyType }
      : allowedTypes.length
        ? { type: { in: allowedTypes as unknown as string[] } }
        : {};

    const sourceTasks = await prisma.task.findMany({
      where: {
        assignmentId: assignment.id,
        templateSiteAsset: {
          is: {
            ...typeFilter,
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
          select: { id: true, type: true, defaultPostingFrequency: true },
        },
      },
    });
    if (!sourceTasks.length) {
      return NextResponse.json(
        { message: "No source tasks found to copy.", tasks: [] },
        { status: 200 }
      );
    }

    // 👇 NO QC GATE — sources may be any status
    const countsByStatus = countByStatus(sourceTasks as any);

    const web2PlatformCreds = collectWeb2PlatformSources(sourceTasks as any);

    // per-asset required frequency overrides
    const assetIds = Array.from(
      new Set(
        sourceTasks
          .map((s) => s.templateSiteAsset?.id)
          .filter((v): v is number => typeof v === "number")
      )
    );
    const settings = assetIds.length
      ? await prisma.assignmentSiteAssetSetting.findMany({
          where: {
            assignmentId: assignment.id,
            templateSiteAssetId: { in: assetIds },
          },
          select: { templateSiteAssetId: true, requiredFrequency: true },
        })
      : [];
    const requiredByAssetId = new Map<number, number | null | undefined>();
    for (const s of settings)
      requiredByAssetId.set(s.templateSiteAssetId, s.requiredFrequency);

    // ensure posting categories
    async function ensureCategory(name: string) {
      const found = await prisma.taskCategory.findFirst({
        where: { name },
        select: { id: true, name: true },
      });
      if (found) return found;
      try {
        const created = await prisma.taskCategory.create({
          data: { name },
          select: { id: true, name: true },
        });
        if (created) return created;
      } catch {}
      const refetched = await prisma.taskCategory.findFirst({
        where: { name },
        select: { id: true, name: true },
      });
      if (refetched) return refetched;
      throw new Error(`Task category ${name} not found`);
    }

    const postingCategories = Array.from(
      new Set(
        sourceTasks.map((src) =>
          resolveCategoryFromType(
            src.templateSiteAsset?.type,
            assetTypeMap,
            fallbackCategoryMap
          )
        )
      )
    );
    const categoryNames = [...postingCategories, CAT_SOCIAL_COMMUNICATION];
    const ensured = await Promise.all(categoryNames.map((n) => ensureCategory(n)));
    const categoryIdByName = new Map<string, string>(
      ensured.map((c) => [c.name, c.id])
    );

    // expand copies
    const expandedCopies: {
      src: (typeof sourceTasks)[number];
      name: string;
      catName: string;
    }[] = [];
    const lastCycleDueByBase = new Map<string, Date>();

    for (const src of sourceTasks) {
      const assetType = src.templateSiteAsset?.type;
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

      const totalCopies = Math.max(1, freq * months);
      for (let i = 1; i <= totalCopies; i++) {
        // <-- Ensure " Task" suffix on posting copies
        expandedCopies.push({ src, catName, name: `${base} Task -${i}` });
      }

      if (catName === CAT_SOCIAL_ACTIVITY) {
        const anchor = src.createdAt || new Date();
        const lastDue = calculateTaskDueDate(anchor, totalCopies);
        lastCycleDueByBase.set(base, lastDue);
      }
    }

    // Social Communication names (append " Task")
    const scNamesFromAssets = sourceTasks
      .filter((s) => {
        const t = s.templateSiteAsset?.type;
        return t === "social_site" || t === "other_asset";
      })
      .map(
        (s) =>
          `${baseNameOf(s.name) || "Social"} - ${CAT_SOCIAL_COMMUNICATION} Task`
      );

    const scNamesFromWeb2 = WEB2_FIXED_PLATFORMS.map(
      (p) =>
        `${
          p.charAt(0).toUpperCase() + p.slice(1)
        } - ${CAT_SOCIAL_COMMUNICATION} Task`
    );

    // dedupe by normalized name and normalized (name + assetId)
    const namesToCheck = Array.from(
      new Set([
        ...expandedCopies.map((e) => e.name),
        ...scNamesFromAssets,
        ...scNamesFromWeb2,
      ])
    );

    console.log(
      `[MIGRATION-POSTING-DEDUPE] Checking ${namesToCheck.length} potential posting tasks`
    );

    // Only dedupe against posting categories (not creation tasks).
    const POSTING_CATEGORY_NAMES = new Set([
      CAT_SOCIAL_ACTIVITY,
      CAT_BLOG_POSTING,
      CAT_SOCIAL_COMMUNICATION,
    ]);

    // Pull existing posting tasks across the entire CLIENT (not just assignment)
    const existingCopies = await prisma.task.findMany({
      where: {
        clientId: clientId,
        category: { is: { name: { in: Array.from(POSTING_CATEGORY_NAMES) } } },
      },
      select: {
        name: true,
        templateSiteAssetId: true,
        category: { select: { name: true } },
      },
    });

    console.log(
      `[MIGRATION-POSTING-DEDUPE] Found ${existingCopies.length} existing posting tasks in client`
    );

    const skipNameBaseSet = new Set(
      existingCopies.map((t) => normalizeForDedupe(t.name || ""))
    );
    const skipPairBase = new Set(
      existingCopies.map((t) => {
        const base = normalizeForDedupe(t.name || "");
        return `${t.templateSiteAssetId ?? "none"}::${base}`;
      })
    );

    console.log(
      `[MIGRATION-POSTING-DEDUPE] Skip name bases:`,
      skipNameBaseSet.size
    );
    console.log(
      `[MIGRATION-POSTING-DEDUPE] Skip pair bases:`,
      skipPairBase.size
    );

    const overridePriority = body?.priority
      ? normalizeTaskPriority(body?.priority)
      : undefined;

    type TaskCreate = Parameters<typeof prisma.task.create>[0]["data"];
    const payloads: TaskCreate[] = [];

    // 1) Social Activity / Blog Posting copies (all pending)
    for (const item of expandedCopies) {
      const src = item.src;

      const baseName = normalizeForDedupe(item.name);
      const pairKey = `${src.templateSiteAsset?.id ?? "none"}::${baseName}`;
      
      if (skipNameBaseSet.has(baseName) || skipPairBase.has(pairKey)) {
        console.log(`[MIGRATION-POSTING-DEDUPE] Skipping posting task: ${item.name} - duplicate found`);
        continue;
      }

      const catId = categoryIdByName.get(item.catName)!;
      const n = extractCycleNumber(item.name);
      const cycleNumber = Number.isFinite(n) && n > 0 ? n : 1;

      const anchor = new Date();
      const dueDate = calculateTaskDueDate(anchor, cycleNumber);

      payloads.push({
        id: makeId(),
        name: item.name, // already has " Task -<n>"
        status: "pending", // posting tasks are pending
        priority: overridePriority ?? src.priority,
        idealDurationMinutes: src.idealDurationMinutes ?? undefined,
        dueDate: dueDate.toISOString(),
        completionLink: src.completionLink ?? undefined,
        email: src.email ?? undefined,
        password: src.password ?? undefined,
        username: src.username ?? undefined,
        notes: src.notes ?? undefined,
        assignment: { connect: { id: assignment.id } },
        client: { connect: { id: clientId } },
        category: { connect: { id: catId } },
        ...(src.templateSiteAsset?.id
          ? { templateSiteAsset: { connect: { id: src.templateSiteAsset.id } } }
          : {}),
      } as TaskCreate);
    }

    // 2) Social Communication (per social/other asset) — pending
    for (const src of sourceTasks) {
      const t = src.templateSiteAsset?.type;
      if (t !== "social_site" && t !== "other_asset") continue;

      const base = baseNameOf(src.name) || "Social";
      const scName = `${base} - ${CAT_SOCIAL_COMMUNICATION} Task`;
      const scBase = normalizeForDedupe(scName);
      const pairKey = `${src.templateSiteAsset?.id ?? "none"}::${scBase}`;
      if (skipNameBaseSet.has(scBase) || skipPairBase.has(pairKey)) {
        console.log(`[MIGRATION-POSTING-DEDUPE] Skipping social communication task: ${scName} - duplicate found`);
        continue;
      }

      let dueDate = lastCycleDueByBase.get(base);
      if (!dueDate) {
        const assetId = src.templateSiteAsset?.id;
        const freq = getFrequency({
          required: assetId ? requiredByAssetId.get(assetId) : undefined,
          defaultFreq: src.templateSiteAsset?.defaultPostingFrequency,
        });
        const totalCopies = Math.max(1, freq * months);
        const anchor = src.createdAt || new Date();
        dueDate = calculateTaskDueDate(anchor, totalCopies);
      }

      const catId = categoryIdByName.get(CAT_SOCIAL_COMMUNICATION)!;
      payloads.push({
        id: makeId(),
        name: scName,
        status: "pending",
        priority: overridePriority ?? src.priority,
        idealDurationMinutes: src.idealDurationMinutes ?? undefined,
        dueDate: dueDate.toISOString(),
        completionLink: src.completionLink ?? undefined,
        email: src.email ?? undefined,
        password: src.password ?? undefined,
        username: src.username ?? undefined,
        notes: src.notes ?? undefined,
        assignment: { connect: { id: assignment.id } },
        client: { connect: { id: clientId } },
        category: { connect: { id: catId } },
        ...(src.templateSiteAsset?.id
          ? { templateSiteAsset: { connect: { id: src.templateSiteAsset.id } } }
          : {}),
      } as TaskCreate);
    }

    // 3) Social Communication for fixed web2 platforms — pending, only if creds/url present
    const maxLastSocialDue =
      Array.from(lastCycleDueByBase.values())
        .sort((a, b) => a.getTime() - b.getTime())
        .pop() ?? calculateTaskDueDate(new Date(), 1);

    for (const p of WEB2_FIXED_PLATFORMS) {
      const scName = `${PLATFORM_META[p].label} - ${CAT_SOCIAL_COMMUNICATION} Task`;
      const scBase = normalizeForDedupe(scName);
      
      if (skipNameBaseSet.has(scBase)) {
        console.log(`[MIGRATION-POSTING-DEDUPE] Skipping web2 social communication task: ${scName} - duplicate found`);
        continue;
      }

      const creds = web2PlatformCreds.get(p);
      if (!creds) continue;

      const catId = categoryIdByName.get(CAT_SOCIAL_COMMUNICATION)!;
      payloads.push({
        id: makeId(),
        name: scName,
        status: "pending",
        priority: overridePriority ?? "medium",
        dueDate: maxLastSocialDue.toISOString(),
        username: creds.username,
        email: creds.email,
        password: creds.password,
        completionLink: creds.url,
        idealDurationMinutes: creds.idealDurationMinutes ?? undefined,
        assignment: { connect: { id: assignment.id } },
        client: { connect: { id: clientId } },
        category: { connect: { id: catId } },
      } as TaskCreate);
    }

    if (!payloads.length) {
      return NextResponse.json(
        {
          message:
            "All copies already exist under 'Social Activity' / 'Blog Posting' / 'Social Communication'.",
          created: 0,
          skipped: existingCopies.length,
          assignmentId: assignment.id,
          tasks: [],
        },
        { status: 200 }
      );
    }

    console.log(`[MIGRATION-POSTING-DEDUPE] Creating ${payloads.length} new posting tasks`);

    const created = await prisma.$transaction((tx) =>
      Promise.all(
        payloads.map((data) =>
          tx.task.create({
            data,
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
          })
        )
      )
    );

    return NextResponse.json(
      {
        message: `Created ${created.length} task(s) across Social Activity, Blog Posting, and Social Communication.`,
        created: created.length,
        skipped: existingCopies.length,
        assignmentId: assignment.id,
        tasks: created,
        runtime: "nodejs",
      },
      { status: 201 }
    );
  } catch (err) {
    return fail("POST.catch", err);
  }
}
