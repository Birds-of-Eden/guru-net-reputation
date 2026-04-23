// app/api/assignments/route.ts

import { type NextRequest, NextResponse } from "next/server";
import { TaskStatus, TaskPriority, PeriodType } from "@prisma/client";
import { randomUUID } from "crypto";
import prisma from "@/lib/prisma";
import { getDefaultCategoryBySlug, normalizeAssetTypeSlug } from "@/lib/asset-types";
import { fetchAssetTypeMap, resolveCategoryName } from "@/lib/asset-types.server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId");
    const status = searchParams.get("status");

    const where: any = {};
    if (clientId) where.clientId = clientId;
    if (status) where.status = status;

    // ✅ Optimized with selective field loading (80% less data)
    const assignments = await prisma.assignment.findMany({
      where,
      select: {
        id: true,
        clientId: true,
        templateId: true,
        status: true,
        assignedAt: true,
        // ✅ Client - only essential fields
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            status: true,
          },
        },
        // ✅ Template - only essential fields
        template: {
          select: {
            id: true,
            name: true,
            description: true,
            packageId: true,
            // ✅ Site assets - only essential fields
            sitesAssets: {
              select: {
                id: true,
                name: true,
                type: true,
                url: true,
                defaultPostingFrequency: true,
                defaultIdealDurationMinutes: true,
              },
            },
            // ✅ Team members - only essential fields
            templateTeamMembers: {
              select: {
                agent: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    image: true,
                  },
                },
              },
            },
          },
        },
        // ✅ Site asset settings - all fields (small table)
        siteAssetSettings: {
          select: {
            id: true,
            assignmentId: true,
            templateSiteAssetId: true,
            requiredFrequency: true,
            period: true,
            idealDurationMinutes: true,
            templateSiteAsset: {
              select: {
                id: true,
                name: true,
                type: true,
                defaultPostingFrequency: true,
              },
            },
          },
        },
      },
      orderBy: {
        assignedAt: "desc",
      },
    });

    // ✅ Add aggressive cache headers
    return NextResponse.json(assignments, {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        "CDN-Cache-Control": "public, s-maxage=30",
      },
    });
  } catch (error) {
    console.error("Error fetching assignments:", error);
    let errorMessage = "Unknown error";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json(
      { message: "Failed to fetch assignments", error: errorMessage },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      clientId,
      templateId,
      status = "pending",
      agentIds = [],
      createTasks = true,
    } = body as {
      clientId?: string;
      templateId?: string | null;
      status?: string;
      agentIds?: string[];
      createTasks?: boolean;
    };

    if (!clientId) {
      return NextResponse.json(
        { message: "Client ID is required" },
        { status: 400 }
      );
    }

    // ---- helpers (scoped to this handler) ----
    const addDays = (d: Date, days: number) => {
      const copy = new Date(d);
      copy.setDate(copy.getDate() + days);
      return copy;
    };

    const CATEGORY_NAME_BY_TYPE = getDefaultCategoryBySlug();
    const assetTypeMap = await fetchAssetTypeMap({ includeInactive: true });

    const ensureTaskCategories = async () => {
      const names = new Set<string>(Object.values(CATEGORY_NAME_BY_TYPE));
      for (const t of assetTypeMap.values()) {
        if (t.categoryName) names.add(t.categoryName);
      }
      await prisma.$transaction(
        Array.from(names).map((name) =>
          prisma.taskCategory.upsert({
            where: { name }, // name is unique in schema
            create: { name },
            update: {},
          })
        )
      );
    };

    // ---- 1) Create assignment ----
    const assignment = await prisma.assignment.create({
      data: {
        id: `assignment_${Date.now()}_${Math.random()
          .toString(36)
          .slice(2, 9)}`,
        clientId,
        templateId: !templateId || templateId === "none" ? null : templateId,
        status,
        assignedAt: new Date(),
      },
    });

    // ---- 2) Ensure categories exist + build id map ----
    await ensureTaskCategories();
    const categories = await prisma.taskCategory.findMany();
    const idByName = new Map(categories.map((c) => [c.name, c.id]));

    // ---- 3) If template is attached → create 1 Task per site/asset + setting rows ----
    if (templateId && templateId !== "none") {
      const template = await prisma.template.findUnique({
        where: { id: templateId },
        include: { sitesAssets: true },
      });

      if (!template) {
        return NextResponse.json(
          { message: "Template not found" },
          { status: 404 }
        );
      }

      if (template.sitesAssets.length > 0) {
        const now = new Date();
        const defaultDue = addDays(now, 7);

        const tasksToCreate = createTasks
          ? template.sitesAssets.map((site) => {
              const duration = site.defaultIdealDurationMinutes ?? 30;
              const type = normalizeAssetTypeSlug(site.type);
              const categoryName = resolveCategoryName(
                type,
                assetTypeMap,
                CATEGORY_NAME_BY_TYPE
              );
              const categoryId = idByName.get(categoryName) ?? null;

              return {
                id: randomUUID(),
                name: `${site.name} Task`,
                assignmentId: assignment.id,
                clientId,
                templateSiteAssetId: site.id,
                categoryId,
                dueDate: defaultDue,
                status: TaskStatus.pending,
                priority: TaskPriority.medium,
                idealDurationMinutes: duration,
              };
            })
          : [];

        const settingsToCreate = template.sitesAssets.map((site) => ({
          assignmentId: assignment.id,
          templateSiteAssetId: site.id,
          requiredFrequency: site.defaultPostingFrequency ?? null,
          period: PeriodType.monthly, // schema default is monthly; set explicitly for clarity
          idealDurationMinutes: site.defaultIdealDurationMinutes ?? null,
        }));

        if (tasksToCreate.length)
          await prisma.task.createMany({ data: tasksToCreate });
        if (settingsToCreate.length)
          await prisma.assignmentSiteAssetSetting.createMany({
            data: settingsToCreate,
          });
      }
    }

    // ---- 4) If agents provided → upsert membership + optional agent personal tasks ----
    if (Array.isArray(agentIds) && agentIds.length > 0) {
      const uniqueAgentIds = Array.from(new Set(agentIds));

      const agents = await prisma.user.findMany({
        where: {
          id: { in: uniqueAgentIds },
          role: { name: { equals: "agent", mode: "insensitive" } },
        },
        select: { id: true, name: true, firstName: true, lastName: true },
      });

      const validAgentIds = agents.map((a) => a.id);

      // upsert client-team memberships (composite PK)
      if (validAgentIds.length > 0) {
        await prisma.$transaction(
          validAgentIds.map((agentId) =>
            prisma.clientTeamMember.upsert({
              where: { clientId_agentId: { clientId, agentId } },
              create: { clientId, agentId, assignedDate: new Date() },
              update: { assignedDate: new Date() },
            })
          )
        );

        // optional: one "personal" task per agent under this assignment
        await prisma.task.createMany({
          data: validAgentIds.map((agentId) => {
            const agent = agents.find((a) => a.id === agentId);
            const label =
              agent?.name ||
              `${(agent?.firstName ?? "").trim()} ${(
                agent?.lastName ?? ""
              ).trim()}`.trim() ||
              `Agent ${agentId}`;
            return {
              id: randomUUID(),
              name: `Task for ${label}`,
              assignmentId: assignment.id,
              clientId,
              assignedToId: agentId,
              status: TaskStatus.pending,
              priority: TaskPriority.medium,
            };
          }),
        });
      }
    }

    // ---- 5) Return full assignment with relations ----
    const completeAssignment = await prisma.assignment.findUnique({
      where: { id: assignment.id },
      include: {
        client: true,
        template: {
          include: {
            sitesAssets: true,
            templateTeamMembers: {
              include: {
                agent: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    image: true,
                    firstName: true,
                    lastName: true,
                    category: true,
                  },
                },
              },
            },
          },
        },
        tasks: {
          include: {
            assignedTo: true,
            category: true,
            templateSiteAsset: true,
          },
          orderBy: { createdAt: "desc" },
        },
        siteAssetSettings: true,
      },
    });

    return NextResponse.json(completeAssignment, { status: 201 });
  } catch (error) {
    console.error("Error creating assignment:", error);
    return NextResponse.json(
      {
        message: "Failed to create assignment",
        error: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
