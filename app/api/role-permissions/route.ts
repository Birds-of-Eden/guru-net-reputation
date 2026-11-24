// app/api/role-permissions/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAccess, requireStaff } from "@/lib/api-guard";

// GET: List all role-permission mappings
export async function GET() {
  const __access = await requireStaff();
  if (__access instanceof NextResponse) return __access;
  try {
    const mappings = await prisma.rolePermission.findMany({
      include: {
        role: { select: { id: true, name: true } },
        permission: { select: { id: true, name: true, description: true } },
      },
    });

    return NextResponse.json({ success: true, data: mappings });
  } catch (error) {
    console.error("Error fetching role-permissions:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch role-permissions" },
      { status: 500 }
    );
  }
}

// POST: Assign a permission to a role
export async function POST(req: NextRequest) {
  const __access = await requireAccess({ permissions: ["view_role_permissions"] });
  if (__access instanceof NextResponse) return __access;
  try {
    const { roleId, permissionId } = await req.json();

    if (!roleId || !permissionId) {
      return NextResponse.json(
        { success: false, error: "roleId and permissionId are required" },
        { status: 400 }
      );
    }

    const mapping = await prisma.rolePermission.create({
      data: { roleId, permissionId },
    });

    return NextResponse.json({ success: true, data: mapping });
  } catch (error) {
    console.error("Error assigning role-permission:", error);
    return NextResponse.json(
      { success: false, error: "Failed to assign role-permission" },
      { status: 500 }
    );
  }
}
