import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { PeriodType, TaskPriority, TaskStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getAuthUser } from "@/lib/getAuthUser";
import { resolveCategoryName } from "@/lib/asset-types.server";
import {
  getDefaultCategoryBySlug,
  normalizeAssetTypeSlug,
} from "@/lib/asset-types";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authUser = await getAuthUser();
  if (!authUser?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const role = String(
    typeof authUser.role === "string" ? authUser.role : authUser.role?.name ?? "",
  )
    .trim()
    .toLowerCase();

  if (!["admin", "manager", "am", "am_ceo"].includes(role)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { id: clientId } = await params;
  const CATEGORY_NAME_BY_TYPE = getDefaultCategoryBySlug();

  try {
    const result = await prisma.$transaction(async (tx) => {
      const client = await tx.client.findUnique({
        where: { id: clientId },
        include: {
          assignments: {
            orderBy: { assignedAt: "desc" },
            include: {
              template: {
                include: { sitesAssets: true },
              },
              tasks: {
                where: {
                  status: {
                    notIn: [TaskStatus.cancelled],
                  },
                },
                select: {
                  id: true,
                  templateSiteAssetId: true,
                },
              },
              siteAssetSettings: {
                select: { id: true, templateSiteAssetId: true },
              },
            },
          },
        },
      });

      if (!client) {
        throw new Error("CLIENT_NOT_FOUND");
      }

      const latestAssignment = client.assignments[0] ?? null;
      const pendingTemplateId =
        typeof (client.client_field_06 as any)?.pendingTemplateId === "string"
          ? String((client.client_field_06 as any).pendingTemplateId).trim()
          : "";

      const template =
        latestAssignment?.template ??
        (pendingTemplateId
          ? await tx.template.findUnique({
              where: { id: pendingTemplateId },
              include: { sitesAssets: true },
            })
          : null);

      const updatedClient = await tx.client.update({
        where: { id: clientId },
        data: {
          status: "active",
          progress: client.progress ?? 0,
          client_field_06:
            client.client_field_06 &&
            typeof client.client_field_06 === "object" &&
            !Array.isArray(client.client_field_06)
              ? {
                  ...(client.client_field_06 as Record<string, unknown>),
                  pendingTemplateId: null,
                  pendingTemplateSelectedAt: null,
                  publishedAt: new Date().toISOString(),
                }
              : {
                  pendingTemplateId: null,
                  pendingTemplateSelectedAt: null,
                  publishedAt: new Date().toISOString(),
                },
        },
      });

      let updatedTemplate = null;
      let assignmentId = latestAssignment?.id ?? null;
      let createdTasks = 0;
      let createdSettings = 0;

      if (template) {
        updatedTemplate = await tx.template.update({
          where: { id: template.id },
          data: { status: "approved" },
        });
      }

      if (template && !latestAssignment) {
        const createdAssignment = await tx.assignment.create({
          data: {
            id: randomUUID(),
            clientId,
            templateId: template.id,
            status: "active",
            assignedAt: new Date(),
          },
        });
        assignmentId = createdAssignment.id;
      } else if (latestAssignment) {
        await tx.assignment.update({
          where: { id: latestAssignment.id },
          data: {
            status: "active",
            ...(template && !latestAssignment.templateId
              ? { templateId: template.id }
              : {}),
          },
        });
      }

      if (template && assignmentId) {
        const assetTypeRows = await tx.assetType.findMany({
          select: {
            slug: true,
            label: true,
            isActive: true,
            sortOrder: true,
            categoryName: true,
          },
        });
        const assetTypes = new Map(
          assetTypeRows.map((row) => [
            row.slug,
            {
              id: row.slug,
              slug: row.slug,
              label: row.label,
              isActive: row.isActive,
              sortOrder: row.sortOrder,
              categoryName: row.categoryName ?? null,
            },
          ]),
        );

        const categoryNames = new Set<string>(Object.values(CATEGORY_NAME_BY_TYPE));
        for (const t of assetTypes.values()) {
          if (t.categoryName) categoryNames.add(t.categoryName);
        }

        await Promise.all(
          Array.from(categoryNames).map((name) =>
            tx.taskCategory.upsert({
              where: { name },
              create: { name },
              update: {},
            }),
          ),
        );

        const categories = await tx.taskCategory.findMany({
          select: { id: true, name: true },
        });
        const categoryIdByName = new Map(categories.map((c) => [c.name, c.id]));

        const existingTaskAssetIds = new Set(
          (latestAssignment?.tasks ?? [])
            .map((task) => task.templateSiteAssetId)
            .filter((id): id is number => typeof id === "number"),
        );

        const existingSettingAssetIds = new Set(
          (latestAssignment?.siteAssetSettings ?? []).map((s) => s.templateSiteAssetId),
        );

        const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        const taskPayloads = template.sitesAssets
          .filter((asset) => !existingTaskAssetIds.has(asset.id))
          .map((asset) => {
            const categoryName = resolveCategoryName(
              normalizeAssetTypeSlug(asset.type),
              assetTypes,
              CATEGORY_NAME_BY_TYPE,
            );
            const categoryId = categoryIdByName.get(categoryName) ?? null;

            return {
              id: randomUUID(),
              name: `${asset.name} Task`,
              assignmentId,
              clientId,
              templateSiteAssetId: asset.id,
              categoryId,
              dueDate,
              status: TaskStatus.pending,
              priority: TaskPriority.medium,
              idealDurationMinutes: asset.defaultIdealDurationMinutes ?? 30,
            };
          });

        const settingPayloads = template.sitesAssets
          .filter((asset) => !existingSettingAssetIds.has(asset.id))
          .map((asset) => ({
            assignmentId,
            templateSiteAssetId: asset.id,
            requiredFrequency: asset.defaultPostingFrequency ?? null,
            period: PeriodType.monthly,
            idealDurationMinutes: asset.defaultIdealDurationMinutes ?? null,
          }));

        if (taskPayloads.length > 0) {
          await tx.task.createMany({ data: taskPayloads });
          createdTasks = taskPayloads.length;
        }

        if (settingPayloads.length > 0) {
          await tx.assignmentSiteAssetSetting.createMany({
            data: settingPayloads,
          });
          createdSettings = settingPayloads.length;
        }
      }

      await tx.activityLog.create({
        data: {
          id: randomUUID(),
          entityType: "client",
          entityId: clientId,
          userId: authUser.id,
          action: "publish",
          details: {
            clientStatus: "active",
            templateId: updatedTemplate?.id ?? template?.id ?? null,
            templateStatus: updatedTemplate?.status ?? template?.status ?? null,
            assignmentId,
            createdTasks,
            createdSettings,
          },
        },
      });

      return {
        client: updatedClient,
        template: updatedTemplate,
        assignmentId,
        createdTasks,
        createdSettings,
      };
    });

    return NextResponse.json(
      {
        message: "Client published successfully",
        ...result,
      },
      { status: 200 },
    );
  } catch (error: any) {
    if (error?.message === "CLIENT_NOT_FOUND") {
      return NextResponse.json({ message: "Client not found" }, { status: 404 });
    }

    console.error("Client publish error:", error);
    return NextResponse.json(
      { message: "Failed to publish client" },
      { status: 500 },
    );
  }
}
