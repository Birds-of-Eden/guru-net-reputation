// app/api/templates/[id]/route.ts

import { type NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { diffChanges } from "@/utils/audit"; // না থাকলে নিচের লোকাল fallback ব্যবহার করো
import { normalizeAssetTypeSlug } from "@/lib/asset-types";
import { fetchAssetTypeMap } from "@/lib/asset-types.server";
import { getAuthUser } from "@/lib/getAuthUser";
import { normalizeTemplateStatus } from "@/lib/template-status";

const sanitizeTemplate = (t: any) => {
  if (!t) return t;
  return {
    id: t.id,
    name: t.name,
    description: t.description ?? null,
    status: t.status ?? null,
    packageId: t.packageId ?? null,
    counts: t._count
      ? {
          sitesAssets: t._count.sitesAssets ?? 0,
          templateTeamMembers: t._count.templateTeamMembers ?? 0,
          assignments: t._count.assignments ?? 0,
        }
      : undefined,
  };
};

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: templateId } = await params;
    const body = await request.json();
    const currentUser = await getAuthUser();
    const currentUserRole =
      typeof currentUser?.role === "string"
        ? currentUser.role
        : currentUser?.role?.name;
    const {
      name,
      description,
      status = "draft",
      packageId,
      sitesAssets = [],
      teamMembers = [],
      actorId: actorIdInBody,
    } = body;

    const normalizedStatus = normalizeTemplateStatus(status);
    if (
      (currentUserRole === "am" || currentUserRole === "am_ceo") &&
      (normalizedStatus === "approved" || normalizedStatus === "rejected")
    ) {
      return NextResponse.json(
        { message: "AM users cannot mark templates as approved or rejected." },
        { status: 403 },
      );
    }

    const actorId =
      actorIdInBody || (request.headers.get("x-actor-id") as string) || null;

    if (!name?.trim() || !packageId?.trim()) {
      return NextResponse.json(
        { message: "Template name and package ID are required" },
        { status: 400 }
      );
    }

    const assetTypeMap = await fetchAssetTypeMap({ includeInactive: true });
    if (!assetTypeMap.size) {
      return NextResponse.json(
        { message: "No asset types configured. Seed AssetType first." },
        { status: 500 }
      );
    }

    const fallbackType =
      assetTypeMap.has("other_asset")
        ? "other_asset"
        : assetTypeMap.keys().next().value;

    const normalizedAssets = sitesAssets
      .filter((asset: any) => asset?.name && asset.name.trim())
      .map((asset: any) => {
        const normalizedType = normalizeAssetTypeSlug(
          String(asset.type ?? fallbackType)
        );
        return { asset, normalizedType };
      });

    const invalidTypes = normalizedAssets
      .filter((a) => !a.normalizedType || !assetTypeMap.has(a.normalizedType))
      .map((a) => a.normalizedType || String(a.asset?.type ?? ""))
      .filter(Boolean);

    if (invalidTypes.length > 0) {
      return NextResponse.json(
        {
          message: "Invalid site asset type(s) provided",
          invalidTypes: Array.from(new Set(invalidTypes)),
        },
        { status: 400 }
      );
    }

    const normalizePostingDuration = (val: any) => {
      if (val === null || val === undefined || String(val).trim() === "") return null;
      const n = Number.parseInt(String(val), 10);
      if (!Number.isFinite(n) || Number.isNaN(n) || n <= 0) return null;
      return n;
    };

    const validSitesAssets = normalizedAssets.map(({ asset, normalizedType }) => ({
      type: normalizedType,
      name: asset.name.trim(),
      url: asset.url?.trim() || null,
      description: asset.description?.trim() || null,
      isRequired: Boolean(asset.isRequired),
      defaultPostingFrequency: Math.max(
        0,
        Number.parseInt(String(asset.defaultPostingFrequency), 10) || 0
      ),
      defaultIdealDurationMinutes: Math.max(
        1,
        parseInt(asset.defaultIdealDurationMinutes) || 30
      ),
      defaultIdealDurationMinutesForPosting: normalizePostingDuration(
        asset.defaultIdealDurationMinutesForPosting
      ),
    }));

    const validTeamMembers = teamMembers
      .filter((member: any) => member.agentId && member.role)
      .map((member: any) => ({
        agentId: member.agentId,
        role: member.role.trim(),
        teamId:
          member.teamId && member.teamId !== "none" ? member.teamId : null,
        assignedDate: new Date(),
      }));

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.template.findUnique({
        where: { id: templateId },
        include: {
          _count: {
            select: {
              sitesAssets: true,
              templateTeamMembers: true,
              assignments: true,
            },
          },
        },
      });
      if (!existing) {
        throw new Error("NOT_FOUND");
      }

      const updatedTemplate = await tx.template.update({
        where: { id: templateId },
        data: {
          name: name.trim(),
          description: description?.trim() || null,
          status: normalizedStatus,
          packageId,
          sitesAssets: {
            deleteMany: {}, // Clear old ones
            create: validSitesAssets,
          },
          templateTeamMembers: {
            deleteMany: {}, // Clear old ones
            create: validTeamMembers,
          },
        },
        include: {
          package: true,
          sitesAssets: {
            include: { assetType: { select: { slug: true, label: true } } },
          },
          templateTeamMembers: {
            include: {
              agent: { select: { id: true, name: true, email: true } },
              team: { select: { id: true, name: true } },
            },
          },
          _count: {
            select: {
              sitesAssets: true,
              templateTeamMembers: true,
              assignments: true,
            },
          },
        },
      });

      const changes = diffChanges(
        sanitizeTemplate(existing),
        sanitizeTemplate(updatedTemplate),
        ["updatedAt", "createdAt"]
      );

      await tx.activityLog.create({
        data: {
          id: crypto.randomUUID(),
          entityType: "Template",
          entityId: updatedTemplate.id,
          userId: actorId,
          action: "update",
          details: { changes },
        },
      });

      return updatedTemplate;
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (error: any) {
    if (error?.message === "NOT_FOUND") {
      return NextResponse.json(
        { message: "Template not found" },
        { status: 404 }
      );
    }

    console.error("Error updating template:", error);

    if (error instanceof Error) {
      if (error.message.includes("Invalid value for argument `type`")) {
        return NextResponse.json(
          { message: "Invalid site asset type provided", error: error.message },
          { status: 400 }
        );
      }
      if (error.message.includes("Foreign key constraint")) {
        return NextResponse.json(
          {
            message: "Invalid package ID or team member reference",
            error: error.message,
          },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      {
        message: "Failed to update template",
        error:
          process.env.NODE_ENV === "development"
            ? (error as any)?.message
            : undefined,
      },
      { status: 500 }
    );
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: templateId } = await params;

    if (!templateId) {
      return NextResponse.json(
        { message: "Template ID is required" },
        { status: 400 }
      );
    }

    const template = await prisma.template.findUnique({
      where: { id: templateId },
      include: {
        package: { select: { id: true, name: true } },
        sitesAssets: {
          include: { assetType: { select: { slug: true, label: true } } },
        },
        templateTeamMembers: {
          include: {
            agent: { select: { id: true, name: true, email: true } },
            team: { select: { id: true, name: true } },
          },
        },
        _count: {
          select: {
            sitesAssets: true,
            templateTeamMembers: true,
            assignments: true,
          },
        },
      },
    });

    if (!template) {
      return NextResponse.json(
        { message: "Template not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(template);
  } catch (error) {
    console.error("Error fetching template:", error);
    return NextResponse.json(
      {
        message: "Failed to fetch template",
        error:
          process.env.NODE_ENV === "development"
            ? (error as any)?.message
            : undefined,
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: templateId } = await params;

  try {
    const actorId =
      (request.headers.get("x-actor-id") as string) ||
      (request.nextUrl.searchParams.get("actorId") as string) ||
      null;

    await prisma.$transaction(async (tx) => {
      // 1) Verify exists
      const existing = await tx.template.findUnique({
        where: { id: templateId },
        select: { id: true, name: true, packageId: true },
      });
      if (!existing) throw new Error("NOT_FOUND");

      // 2) Pre-compute child counts for audit (purely informational)
      const [
        siteAssetsCount,
        teamMembersCount,
        assignmentsCount,
        tasksCount,
        settingsCount,
        commentsCount,
        reportsCount,
        notificationsCount,
      ] = await Promise.all([
        tx.templateSiteAsset.count({ where: { templateId } }),
        tx.templateTeamMember.count({ where: { templateId } }),
        tx.assignment.count({ where: { templateId } }),
        tx.task.count({
          where: {
            OR: [
              { assignment: { templateId } }, // tasks created via assignments
              { templateSiteAsset: { templateId } }, // tasks created via assets
            ],
          },
        }),
        tx.assignmentSiteAssetSetting.count({
          where: {
            OR: [
              { assignment: { templateId } },
              { templateSiteAsset: { templateId } },
            ],
          },
        }),
        tx.comment.count({
          where: {
            task: {
              OR: [
                { assignment: { templateId } },
                { templateSiteAsset: { templateId } },
              ],
            },
          },
        }),
        tx.report.count({
          where: {
            task: {
              OR: [
                { assignment: { templateId } },
                { templateSiteAsset: { templateId } },
              ],
            },
          },
        }),
        tx.notification.count({
          where: {
            task: {
              OR: [
                { assignment: { templateId } },
                { templateSiteAsset: { templateId } },
              ],
            },
          },
        }),
      ]);

      // 3) Single call — DB cascades will delete EVERYTHING downstream
      await tx.template.delete({ where: { id: templateId } });

      // 4) Audit log
      await tx.activityLog.create({
        data: {
          id: crypto.randomUUID(),
          entityType: "Template",
          entityId: existing.id,
          userId: actorId,
          action: "delete",
          details: {
            name: existing.name,
            packageId: existing.packageId ?? null,
            // purely informational snapshot of what got removed
            deletedCounts: {
              siteAssets: siteAssetsCount,
              teamMembers: teamMembersCount,
              assignments: assignmentsCount,
              tasks: tasksCount,
              assignmentSiteAssetSettings: settingsCount,
              comments: commentsCount,
              reports: reportsCount,
              notifications: notificationsCount,
            },
          },
        },
      });
    });

    return NextResponse.json({ message: "Template deleted successfully" });
  } catch (error: any) {
    if (error?.message === "NOT_FOUND") {
      return NextResponse.json(
        { message: "Template not found" },
        { status: 404 }
      );
    }

    console.error("Error deleting template:", error);
    return NextResponse.json(
      {
        message: "Failed to delete template",
        // no env branching; same behavior for dev/prod
      },
      { status: 500 }
    );
  }
}
