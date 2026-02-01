export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { type NextRequest, NextResponse } from "next/server";
import type { TaskPriority, TaskStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getDefaultCategoryBySlug, normalizeAssetTypeSlug } from "@/lib/asset-types";
import { fetchAssetTypeMap, resolveCategoryFromMap } from "@/lib/asset-types.server";

// ================== CONSTANTS ==================
type AssetTypeSlug = string;

const CAT_SOCIAL_ACTIVITY = "Social Activity";
const CAT_BLOG_POSTING = "Blog Posting";
const CAT_SOCIAL_COMMUNICATION = "Social Communication";
const CAT_CONTENT_WRITING = "Content Writing";
const CAT_GUEST_POSTING = "Guest Posting";
const CAT_BACKLINKS = "Backlinks";
const CAT_REVIEW_REMOVAL = "Review Removal";
const CAT_SUMMARY_REPORT = "Summary Report";

const WEB2_FIXED_PLATFORMS = ["medium", "tumblr", "wordpress"] as const;
const PLATFORM_META: Record<
  (typeof WEB2_FIXED_PLATFORMS)[number],
  { label: string; url: string }
> = {
  medium: { label: "Medium", url: "https://medium.com/" },
  tumblr: { label: "Tumblr", url: "https://www.tumblr.com/" },
  wordpress: { label: "Wordpress", url: "https://wordpress.com/" },
};

// ================== SMALL UTILS ==================
const makeId = () =>
  `task_${Date.now()}_${
    globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
  }`;

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
  web2_site: CAT_BLOG_POSTING,
  social_site: CAT_SOCIAL_ACTIVITY,
  content_writing: CAT_CONTENT_WRITING,
  guest_posting: CAT_GUEST_POSTING,
  backlinks: CAT_BACKLINKS,
  review_removal: CAT_REVIEW_REMOVAL,
  summary_report: CAT_SUMMARY_REPORT,
  other_asset: CAT_SOCIAL_ACTIVITY,
};

function baseNameOf(name: string): string {
  return String(name)
    .replace(/\s*-\s*\d+$/i, "")
    .trim();
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
  console.error(`[create-dataentry-posting-tasks] ${stage} ERROR:`, err);
  return NextResponse.json(
    { message: "Internal Server Error", stage, error: e },
    { status: http }
  );
}

// ================== WORKING-DAY HELPERS ==================
// Saturday = 6, Sunday = 0
function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function dateOnly(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function toLocalMiddayISOString(d: Date): string {
  const local = new Date(d);
  local.setHours(12, 0, 0, 0);
  return local.toISOString();
}

function addDays(startDate: Date, days: number): Date {
  const copy = new Date(startDate);
  copy.setDate(copy.getDate() + days);
  return dateOnly(copy);
}

function addWorkingDays(startDate: Date, workingDays: number): Date {
  const result = dateOnly(startDate);
  let daysToAdd = workingDays;
  while (daysToAdd > 0) {
    result.setDate(result.getDate() + 1);
    if (!isWeekend(result)) {
      daysToAdd--;
    }
  }
  return dateOnly(result);
}
// 👇 Inclusive month count: counts the start month and end month if any overlap
function monthsBetweenInclusive(d1: Date, d2: Date): number {
  const a = new Date(d1.getFullYear(), d1.getMonth(), 1);
  const b = new Date(d2.getFullYear(), d2.getMonth(), 1);
  const diff = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  return Math.max(diff + 1, 0);
}
function normalizeStr(str: string) {
  return String(str).toLowerCase().replace(/\s+/g, " ").trim();
}
function matchPlatformFromWeb2Name(
  name: string
): "medium" | "tumblr" | "wordpress" | null {
  const n = normalizeStr(name);
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

// ================== ASSIGNEE PICKER (unchanged) ==================
async function findTopAgentForClient(clientId: string) {
  try {
    const agentTaskCounts = await prisma.task.groupBy({
      by: ["assignedToId"],
      where: { clientId, assignedToId: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 1,
    });

    if (agentTaskCounts.length > 0 && agentTaskCounts[0].assignedToId) {
      const topAgentId = agentTaskCounts[0].assignedToId!;
      const agent = await prisma.user.findUnique({
        where: { id: topAgentId },
        select: { id: true, name: true, email: true },
      });
      if (agent) return agent;
    }

    const availableAgent = await prisma.user.findFirst({
      where: { role: { name: { in: ["agent", "data_entry", "staff"] } } },
      select: { id: true, name: true, email: true },
      orderBy: { createdAt: "asc" },
    });

    return availableAgent;
  } catch (error) {
    console.error("Error finding top agent:", error);
    return null;
  }
}

// ================== POST ==================
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const clientId: string | undefined = body?.clientId;
    const templateIdRaw: string | undefined = body?.templateId;
    const onlyType: string | undefined = body?.onlyType;
    const overridePriority = body?.priority
      ? normalizeTaskPriority(body?.priority)
      : undefined;

    if (!clientId) {
      return NextResponse.json(
        { message: "clientId is required" },
        { status: 400 }
      );
    }

    // DB preflight
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (e) {
      return fail("POST.db-preflight", e);
    }

    // Assignee (this API creates up to today → you auto-assign data_entry at UI — keep select here too if needed)
    const topAgent = await findTopAgentForClient(clientId);
    // (We don't use topAgent here for assignment; your UI distributes to data_entry. Keeping it only for response context.)

    // Client dates
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, startDate: true, dueDate: true },
    });

    if (!client) return NextResponse.json({ message: "Client not found" }, { status: 404 });
    if (!client.startDate)
      return NextResponse.json({ message: "Client start date is required" }, { status: 400 });
    if (!client.dueDate)
      return NextResponse.json({ message: "Client due date is required" }, { status: 400 });

    const startDate = dateOnly(new Date(client.startDate));
    const dueDate = dateOnly(new Date(client.dueDate));

    const todayOnly = dateOnly(new Date());
    const cutoff = todayOnly <= dueDate ? todayOnly : dueDate;

    const assetTypeMap = await fetchAssetTypeMap();
    const fallbackCategoryMap = getDefaultCategoryBySlug();
    const resolveCategoryFromType = (assetType?: string | null) =>
      resolveCategoryFromMap(
        assetType ?? "",
        CATEGORY_BY_ASSET_TYPE,
        assetTypeMap,
        fallbackCategoryMap,
        CAT_SOCIAL_ACTIVITY
      );

    // Assignment
    const templateId = templateIdRaw === "none" ? null : templateIdRaw;
    const assignment = await prisma.assignment.findFirst({
      where: {
        clientId,
        ...(templateId !== undefined ? { templateId: templateId ?? undefined } : {}),
      },
      orderBy: { assignedAt: "desc" },
      select: { id: true },
    });
    if (!assignment) {
      return NextResponse.json(
        { message: "No existing assignment found for this client." },
        { status: 404 }
      );
    }

    const normalizedOnlyType = onlyType ? normalizeAssetTypeSlug(onlyType) : undefined;
    const allowedTypes = Array.from(assetTypeMap.keys());
    const typeFilter = normalizedOnlyType
      ? { type: normalizedOnlyType }
      : allowedTypes.length
        ? { type: { in: allowedTypes } }
        : {};

    // Source (qc_approved only) + type filter
    const sourceTasks = await prisma.task.findMany({
      where: {
        assignmentId: assignment.id,
        status: "qc_approved",
        templateSiteAsset: {
          is: {
            ...typeFilter,
          },
        },
      },
      select: {
        id: true,
        name: true,
        priority: true,
        idealDurationMinutes: true,
        completionLink: true,
        email: true,
        password: true,
        username: true,
        notes: true,
        templateSiteAsset: {
          select: { id: true, type: true, name: true, defaultPostingFrequency: true },
        },
      },
    });

    if (!sourceTasks.length) {
      return NextResponse.json(
        { message: "No qc_approved source tasks found to copy.", created: 0, tasks: [] },
        { status: 200 }
      );
    }

    // Ensure categories
    const ensureCategory = async (name: string) => {
      const found = await prisma.taskCategory.findFirst({ where: { name }, select: { id: true, name: true } });
      if (found) return found;
      try {
        return await prisma.taskCategory.create({ data: { name }, select: { id: true, name: true } });
      } catch {
        const again = await prisma.taskCategory.findFirst({ where: { name }, select: { id: true, name: true } });
        if (again) return again;
        throw new Error(`Failed to ensure category: ${name}`);
      }
    };

    const categoryNames = new Set<string>();
    for (const src of sourceTasks) {
      categoryNames.add(resolveCategoryFromType(src.templateSiteAsset?.type));
    }
    categoryNames.add(CAT_SOCIAL_COMMUNICATION);

    const ensured = await Promise.all(
      Array.from(categoryNames).map((n) => ensureCategory(n))
    );
    const categoryIdByName = new Map<string, string>(ensured.map((c) => [c.name, c.id] as const));

    // Web2 creds for SC (kept same)
    const web2PlatformCreds = collectWeb2PlatformSources(sourceTasks as any);

    const CUSTOM_SCHEDULE_OFFSETS: Record<string, number[]> = {
      [CAT_CONTENT_WRITING]: [30, 60, 90],
      [CAT_BACKLINKS]: [30, 60],
      [CAT_REVIEW_REMOVAL]: [30, 60, 90],
      [CAT_SUMMARY_REPORT]: [30, 60, 90],
      [CAT_GUEST_POSTING]: [30, 60, 90],
    };

    // 👇 NEW: per-month capped schedule builder (first = +15WD, then +7WD), cut at `cutoff`
    function* cadenceDates(from: Date) {
      let cur = addWorkingDays(from, 15);
      yield cur;
      while (true) {
        cur = addWorkingDays(cur, 7);
        yield cur;
      }
    }

    type FutureItem = {
      src: (typeof sourceTasks)[number];
      catName: string;
      base: string;
      name: string;
      dueDate: Date;
      seqIndex: number;
    };

    const future: FutureItem[] = [];

    for (const src of sourceTasks) {
      const catName = resolveCategoryFromType(src.templateSiteAsset?.type);
      const base = baseNameOf(src.name);

      const customOffsets = CUSTOM_SCHEDULE_OFFSETS[catName];
      if (customOffsets) {
        const customDates = customOffsets
          .map((offset) => addDays(startDate, offset))
          .filter((date) => date.getTime() <= cutoff.getTime() && date.getTime() <= dueDate.getTime());

        customDates.forEach((dueDateForTask, idx) => {
          future.push({
            src,
            catName,
            base,
            name: `${base} -${idx + 1}`,
            dueDate: dueDateForTask,
            seqIndex: idx + 1,
          });
        });
        continue;
      }

      const freqPerMonthRaw = src.templateSiteAsset?.defaultPostingFrequency ?? 0;
      const freqPerMonth = Math.max(0, Number(freqPerMonthRaw) || 0);
      if (freqPerMonth === 0) continue;

      // মোট লাগবে: inclusive month count × freqPerMonth
      const totalMonths = monthsBetweenInclusive(startDate, dueDate);
      const totalNeeded = totalMonths * freqPerMonth;

      // প্রতি মাসে cap ধরে, cutoff পর্যন্ত fill
      const perMonthCount = new Map<string, number>(); // "YYYY-MM" -> count for THIS src
      let accepted = 0;

      for (const d of cadenceDates(startDate)) {
        const dOnly = dateOnly(d);
        if (dOnly.getTime() > cutoff.getTime()) break; // এই API cutoff পর্যন্তই বানাবে

        const key = `${dOnly.getFullYear()}-${String(dOnly.getMonth() + 1).padStart(2, "0")}`;
        const used = perMonthCount.get(key) ?? 0;

        if (used < freqPerMonth) {
          perMonthCount.set(key, used + 1);
          accepted++;

          // নাম্বারিং: ক্যাম্পেইন স্টার্ট থেকে ধারাবাহিক -1, -2, ...
          // seqIndex = already accepted overall for this src
          const seqIndex = accepted;
          future.push({
            src,
            catName,
            base,
            name: `${base} -${seqIndex}`,
            dueDate: dOnly,
            seqIndex,
          });

          if (accepted >= totalNeeded) break; // theoretical guard; practically cutoff-এ থামবে
        }
      }
      // নোট: যদি accepted < totalNeeded হয়, বাকি অংশ remain-tasks API dueDate-এর পর extend করে পূরণ করবে।
    }

    if (future.length === 0) {
      return NextResponse.json(
        {
          message: "No occurrences fall within the requested window (start+15WD to cutoff).",
          created: 0,
          cutoff,
          scheduleCount: 0,
        },
        { status: 200 }
      );
    }

    // Skip duplicates
    const namesToCheck = Array.from(new Set(future.map((f) => f.name)));
    const existingTasks = namesToCheck.length
      ? await prisma.task.findMany({
          where: {
            assignmentId: assignment.id,
            name: { in: namesToCheck },
            category: { name: { in: Array.from(categoryNames) } },
          },
          select: { name: true },
        })
      : [];
    const skipNameSet = new Set(existingTasks.map((t) => t.name));

    // Create payloads
    type TaskCreate = Parameters<typeof prisma.task.create>[0]["data"];
    const payloads: TaskCreate[] = [];

    for (const item of future) {
      if (skipNameSet.has(item.name)) continue;
      const catId = categoryIdByName.get(item.catName);
      if (!catId) continue;

      payloads.push({
        id: makeId(),
        name: item.name,
        status: "pending" as TaskStatus,
        priority: overridePriority ?? item.src.priority,
        idealDurationMinutes: item.src.idealDurationMinutes ?? undefined,
        dueDate: toLocalMiddayISOString(item.dueDate),
        completionLink: item.src.completionLink ?? undefined,
        email: item.src.email ?? undefined,
        password: item.src.password ?? undefined,
        username: item.src.username ?? undefined,
        notes: item.src.notes ?? undefined,
        assignment: { connect: { id: assignment.id } },
        client: { connect: { id: clientId } },
        category: { connect: { id: catId } },
        // ⛳️ আপনি UI থেকে data_entry এ অ্যাসাইন করছেন; এখানে assign করছি না
      });
    }

    // Social Communication (optional): latestDue = সর্বশেষ তৈরি ডিউডেট (এই রান)
    const createdDates = future
      .filter((f) => !skipNameSet.has(f.name))
      .map((f) => f.dueDate.getTime());
    const latestDue = createdDates.length
      ? new Date(Math.max(...createdDates))
      : cutoff;

    const socialBases = Array.from(
      new Set(
        sourceTasks
          .filter((s) => s.templateSiteAsset?.type === "social_site")
          .map((s) => baseNameOf(s.name) || "Social")
      )
    );

    const scNames = socialBases.map((b) => `${b} - ${CAT_SOCIAL_COMMUNICATION}`);
    const web2SCNames = WEB2_FIXED_PLATFORMS
      .filter((p) => web2PlatformCreds.get(p))
      .map((p) => `${PLATFORM_META[p].label} - ${CAT_SOCIAL_COMMUNICATION}`);

    const scExisting = await prisma.task.findMany({
      where: {
        assignmentId: assignment.id,
        name: { in: [...scNames, ...web2SCNames] },
        category: { name: CAT_SOCIAL_COMMUNICATION },
      },
      select: { name: true },
    });
    const scSkip = new Set(scExisting.map((t) => t.name));
    const scCatId = categoryIdByName.get(CAT_SOCIAL_COMMUNICATION);

    if (scCatId) {
      // per-base SC
      for (const base of socialBases) {
        const scName = `${base} - ${CAT_SOCIAL_COMMUNICATION}`;
        if (scSkip.has(scName)) continue;
        const src = sourceTasks.find(
          (s) => s.templateSiteAsset?.type === "social_site" && baseNameOf(s.name) === base
        );
        payloads.push({
          id: makeId(),
          name: scName,
          status: "pending",
          priority: overridePriority ?? (src?.priority ?? "medium"),
          dueDate: latestDue.toISOString(),
          completionLink: src?.completionLink ?? undefined,
          email: src?.email ?? undefined,
          password: src?.password ?? undefined,
          username: src?.username ?? undefined,
          notes: src?.notes ?? undefined,
          assignment: { connect: { id: assignment.id } },
          client: { connect: { id: clientId } },
          category: { connect: { id: scCatId } },
        });
      }

      // Web2 fixed SC
      for (const p of WEB2_FIXED_PLATFORMS) {
        const creds = web2PlatformCreds.get(p);
        if (!creds) continue;
        const scName = `${PLATFORM_META[p].label} - ${CAT_SOCIAL_COMMUNICATION}`;
        if (scSkip.has(scName)) continue;

        payloads.push({
          id: makeId(),
          name: scName,
          status: "pending",
          priority: overridePriority ?? "medium",
          dueDate: latestDue.toISOString(),
          username: creds.username,
          email: creds.email,
          password: creds.password,
          completionLink: creds.url,
          idealDurationMinutes: creds.idealDurationMinutes ?? undefined,
          assignment: { connect: { id: assignment.id } },
          client: { connect: { id: clientId } },
          category: { connect: { id: scCatId } },
        });
      }
    }

    if (payloads.length === 0) {
      return NextResponse.json(
        {
          message: "All scheduled tasks already exist for this window.",
          created: 0,
          cutoff,
          scheduleCount: 0,
          tasks: [],
        },
        { status: 200 }
      );
    }

    const created = await prisma.$transaction(
      payloads.map((data) =>
        prisma.task.create({
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
            assignedTo: { select: { id: true, name: true, email: true } },
            assignment: { select: { id: true } },
            category: { select: { id: true, name: true } },
            templateSiteAsset: { select: { id: true, name: true, type: true } },
          },
        })
      )
    );

    return NextResponse.json(
      {
        message: `Created ${created.length} task(s) up to cutoff with per-month caps.`,
        created: created.length,
        cutoff,
        scheduleCount: created.length, // count actually created
        assignedTo: null, // UI assigns to data_entry after creation
        assignmentId: assignment.id,
        cadence: "first at startDate + 15 working days, then every +7 working days (per-month capped)",
        tasks: created,
      },
      { status: 201 }
    );
  } catch (err) {
    return fail("POST.catch", err);
  }
}
