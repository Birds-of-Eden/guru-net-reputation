// app/api/asset-types/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  formatAssetTypeLabel,
  normalizeAssetTypeSlug,
  slugifyAssetType,
} from "@/lib/asset-types";
import {
  authenticateUser,
  getAuthErrorResponse,
  requirePermission,
} from "@/lib/auth-middleware";

/**
 * GET /api/asset-types
 * Returns all available asset types from DB (dynamic).
 */
export async function GET(request: NextRequest) {
  try {
    const includeInactive =
      request.nextUrl.searchParams.get("includeInactive") === "1";

    const assetTypes = await prisma.assetType.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      select: {
        id: true,
        slug: true,
        label: true,
        isActive: true,
        sortOrder: true,
        categoryName: true,
      },
    });

    return NextResponse.json({
      assetTypes,
      count: assetTypes.length,
    });
  } catch (error) {
    console.error("Error fetching asset types:", error);
    return NextResponse.json(
      {
        message: "Failed to fetch asset types",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/asset-types
 * Create a new asset type (admin/manager only).
 */
export async function POST(request: NextRequest) {
  try {
    const authContext = await authenticateUser(request);
    await requirePermission(authContext, "asset_type_manage", ["admin", "manager"]);

    const body = await request.json();
    const labelRaw = String(body?.label ?? "").trim();
    const slugRaw = String(body?.slug ?? labelRaw).trim();

    if (!labelRaw) {
      return NextResponse.json(
        { message: "label is required" },
        { status: 400 }
      );
    }

    const slug = normalizeAssetTypeSlug(slugifyAssetType(slugRaw));
    if (!slug) {
      return NextResponse.json(
        { message: "slug is required" },
        { status: 400 }
      );
    }

    const created = await prisma.assetType.create({
      data: {
        slug,
        label: labelRaw || formatAssetTypeLabel(slug),
        isActive: body?.isActive ?? true,
        sortOrder: Number.isFinite(Number(body?.sortOrder))
          ? Number(body?.sortOrder)
          : 0,
        categoryName: body?.categoryName ? String(body.categoryName).trim() : null,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED" || error?.message === "FORBIDDEN") {
      const authErr = getAuthErrorResponse(error);
      return NextResponse.json({ message: authErr.message }, { status: authErr.status });
    }
    if (error?.code === "P2002") {
      return NextResponse.json(
        { message: "Asset type slug already exists" },
        { status: 409 }
      );
    }
    console.error("Error creating asset type:", error);
    return NextResponse.json(
      {
        message: "Failed to create asset type",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/asset-types
 * Update an asset type (admin/manager only).
 */
export async function PATCH(request: NextRequest) {
  try {
    const authContext = await authenticateUser(request);
    await requirePermission(authContext, "asset_type_manage", ["admin", "manager"]);

    const body = await request.json();
    const slugRaw = String(body?.slug ?? "").trim();
    const slug = normalizeAssetTypeSlug(slugifyAssetType(slugRaw));

    if (!slug) {
      return NextResponse.json(
        { message: "slug is required" },
        { status: 400 }
      );
    }

    const data: Record<string, any> = {};
    if (body?.label !== undefined) data.label = String(body.label).trim();
    if (body?.categoryName !== undefined)
      data.categoryName = body.categoryName
        ? String(body.categoryName).trim()
        : null;
    if (body?.isActive !== undefined) data.isActive = Boolean(body.isActive);
    if (body?.sortOrder !== undefined && Number.isFinite(Number(body.sortOrder)))
      data.sortOrder = Number(body.sortOrder);

    const updated = await prisma.assetType.update({
      where: { slug },
      data,
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED" || error?.message === "FORBIDDEN") {
      const authErr = getAuthErrorResponse(error);
      return NextResponse.json({ message: authErr.message }, { status: authErr.status });
    }
    if (error?.code === "P2025") {
      return NextResponse.json(
        { message: "Asset type not found" },
        { status: 404 }
      );
    }
    console.error("Error updating asset type:", error);
    return NextResponse.json(
      {
        message: "Failed to update asset type",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/asset-types
 * Soft-delete (disable) an asset type (admin/manager only).
 */
export async function DELETE(request: NextRequest) {
  try {
    const authContext = await authenticateUser(request);
    await requirePermission(authContext, "asset_type_manage", ["admin", "manager"]);

    let slugRaw = request.nextUrl.searchParams.get("slug") || "";
    if (!slugRaw) {
      try {
        const body = await request.json();
        slugRaw = String(body?.slug ?? "").trim();
      } catch {
        slugRaw = "";
      }
    }
    const slug = normalizeAssetTypeSlug(slugifyAssetType(slugRaw));

    if (!slug) {
      return NextResponse.json(
        { message: "slug is required" },
        { status: 400 }
      );
    }

    const updated = await prisma.assetType.update({
      where: { slug },
      data: { isActive: false },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED" || error?.message === "FORBIDDEN") {
      const authErr = getAuthErrorResponse(error);
      return NextResponse.json({ message: authErr.message }, { status: authErr.status });
    }
    if (error?.code === "P2025") {
      return NextResponse.json(
        { message: "Asset type not found" },
        { status: 404 }
      );
    }
    console.error("Error deleting asset type:", error);
    return NextResponse.json(
      {
        message: "Failed to delete asset type",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
