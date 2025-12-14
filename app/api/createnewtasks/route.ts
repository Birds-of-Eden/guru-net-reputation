// app/api/createnewtasks/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { type NextRequest, NextResponse } from "next/server";
import type { TaskPriority, TaskStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import { resolveIdealDurationDynamic } from "@/utils/resolve-ideal-duration";
import { getRuntimeTaskDurationConfig } from "@/app/api/settings/task-duration/route";

const ALLOWED_ASSET_TYPES = [
  "social_site",
  "web2_site",
  "other_asset",
] as const;
const CAT_SOCIAL_ACTIVITY = "Social Activity";
const CAT_BLOG_POSTING = "Blog Posting";

// Node 18+ has global crypto.randomUUID()
const makeId = () =>
  `task_${Date.now()}_${
    globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
  }`;

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
  console.error(`[create-manual-tasks] ${stage} ERROR:`, err);
  return NextResponse.json(
    { message: "Internal Server Error", stage, error: e },
    { status: http }
  );
}

// Determine category name based on asset type (strict posting logic)
function resolveCategoryFromType(assetType?: string): string {
  if (!assetType) return CAT_SOCIAL_ACTIVITY;
  if (assetType === "social_site") return CAT_SOCIAL_ACTIVITY;
  if (assetType === "web2_site" || assetType === "other_asset") {
    return CAT_BLOG_POSTING;
  }
  return CAT_SOCIAL_ACTIVITY;
}

// POST: create manual tasks
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const clientId: string | undefined = body?.clientId;
    const dueDateRaw: string | undefined = body?.dueDate;
    const siteAssetTypesRaw: string[] | undefined = body?.siteAssetTypes;
    
    console.log("[create-manual-tasks] Incoming:", {
      clientId,
      dueDateRaw,
      siteAssetTypesRaw,
    });

    // Validation
    if (!clientId) {
      return NextResponse.json(
        { message: "clientId is required" },
        { status: 400 }
      );
    }

    if (!dueDateRaw) {
      return NextResponse.json(
        { message: "dueDate is required" },
        { status: 400 }
      );
    }

    if (!siteAssetTypesRaw || siteAssetTypesRaw.length === 0) {
      return NextResponse.json(
        { message: "At least one site asset type must be selected" },
        { status: 400 }
      );
    }

    const baseDueDate = new Date(dueDateRaw);

    if (Number.isNaN(baseDueDate.getTime())) {
      return NextResponse.json(
        { message: "Invalid dueDate format" },
        { status: 400 }
      );
    }

    const siteAssetTypes = Array.from(
      new Set(
        siteAssetTypesRaw.filter((type): type is (typeof ALLOWED_ASSET_TYPES)[number] =>
          ALLOWED_ASSET_TYPES.includes(type as any)
        )
      )
    );

    if (siteAssetTypes.length === 0) {
      return NextResponse.json(
        {
          message:
            "Invalid site asset types. Allowed types: social_site, web2_site, other_asset.",
        },
        { status: 400 }
      );
    }

    // DB preflight
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (e) {
      return fail("POST.db-preflight", e);
    }

    // Verify client exists
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        name: true,
      },
    });

    if (!client) {
      return NextResponse.json(
        { message: "Client not found" },
        { status: 404 }
      );
    }

    // Find assignment for this client
    const assignment = await prisma.assignment.findFirst({
      where: { clientId },
      orderBy: { assignedAt: "desc" },
      select: { id: true, templateId: true },
    });

    if (!assignment) {
      return NextResponse.json(
        {
          message:
            "No existing assignment found for this client. Please create an assignment first.",
        },
        { status: 404 }
      );
    }

    // Ensure category helper (matches posting tasks logic)
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

    // Ensure posting categories exist
    const [socialCategory, blogCategory] = await Promise.all([
      ensureCategory(CAT_SOCIAL_ACTIVITY),
      ensureCategory(CAT_BLOG_POSTING),
    ]);

    const categoryIdByName = new Map<string, string>([
      [socialCategory.name, socialCategory.id],
      [blogCategory.name, blogCategory.id],
    ]);

    // Load template assets for selected types
    if (!assignment.templateId) {
      return NextResponse.json(
        { message: "Assignment has no templateId; cannot resolve template assets" },
        { status: 400 }
      );
    }

    const templateAssets = await prisma.templateSiteAsset.findMany({
      where: {
        templateId: assignment.templateId,
        type: { in: siteAssetTypes as any },
      },
      select: {
        id: true,
        name: true,
        type: true,
        defaultIdealDurationMinutes: true,
      },
    });

    console.log("[create-manual-tasks] Template assets fetched:", templateAssets.length);

    if (!templateAssets.length) {
      return NextResponse.json(
        {
          message: "No template site assets found for the selected posting types.",
          created: 0,
          tasks: [],
        },
        { status: 200 }
      );
    }

    // Build payloads with proper category mapping
    const payloads: Array<{
      id: string;
      name: string;
      status: TaskStatus;
      priority: TaskPriority;
      dueDate: string;
      assignment: { connect: { id: string } };
      client: { connect: { id: string } };
      category: { connect: { id: string } };
      templateSiteAsset: { connect: { id: number } };
      idealDurationMinutes?: number | null;
    }> = [];

    for (const asset of templateAssets) {
      // Determine category based on asset type (matches posting tasks)
      const categoryName = resolveCategoryFromType(asset.type as string);
      const categoryId = categoryIdByName.get(categoryName);

      if (!categoryId) {
        console.warn(`[create-manual-tasks] Category not found for: ${categoryName}`);
        continue;
      }

      // Find existing tasks for this asset to determine next number
      const label = asset.name || asset.type || "Task";
      const prefix = `${label} -`;
      
      const existingForAsset = await prisma.task.findMany({
        where: {
          assignmentId: assignment.id,
          templateSiteAssetId: asset.id,
          name: { startsWith: prefix },
        },
        select: { name: true },
      });

      const nums = existingForAsset
        .map((t) => {
          const m = t.name.match(/-(\d+)\s*$/);
          return m ? Number(m[1]) : null;
        })
        .filter((n): n is number => typeof n === "number" && !Number.isNaN(n));
      
      const next = nums.length ? Math.max(...nums) + 1 : 1;
      const taskName = `${label} -${next}`;

      console.log("[create-manual-tasks] Creating task:", {
        assetId: asset.id,
        assetType: asset.type,
        categoryName,
        taskName,
      });

      // Resolve ideal duration dynamically (matches posting tasks)
      const idealDuration = resolveIdealDurationDynamic(
        taskName,
        categoryName as "Blog Posting" | "Social Activity",
        getRuntimeTaskDurationConfig()
      );

      payloads.push({
        id: makeId(),
        name: taskName,
        status: "pending" as TaskStatus,
        priority: "medium" as TaskPriority,
        dueDate: baseDueDate.toISOString(),
        assignment: { connect: { id: assignment.id } },
        client: { connect: { id: clientId } },
        category: { connect: { id: categoryId } },
        templateSiteAsset: { connect: { id: asset.id } },
        idealDurationMinutes: idealDuration ?? asset.defaultIdealDurationMinutes ?? undefined,
      });
    }

    console.log("[create-manual-tasks] Payload count:", payloads.length);

    if (payloads.length === 0) {
      return NextResponse.json(
        { message: "No tasks to create", created: 0, tasks: [] },
        { status: 200 }
      );
    }

    // Create tasks in a transaction
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
              assignment: { select: { id: true } },
              category: { select: { id: true, name: true } },
              templateSiteAsset: { select: { id: true, name: true, type: true } },
            },
          })
        )
      )
    );

    console.log("[create-manual-tasks] Created:", created.length);

    return NextResponse.json(
      {
        message: `Created ${created.length} manual posting task(s)`,
        created: created.length,
        skipped: 0,
        assignmentId: assignment.id,
        tasks: created,
        runtime: "nodejs",
      },
      { status: 201 }
    );
  } catch (err) {
    console.log("[create-manual-tasks] Error:", err);
    return fail("POST.catch", err);
  }
}
