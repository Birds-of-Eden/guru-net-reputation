// app/api/packages/templates/route.ts

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isTemplateStatus } from "@/lib/template-status";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const packageId = searchParams.get("packageId");
    const status = searchParams.get("status");

    if (!packageId) {
      return NextResponse.json(
        { error: "Package ID is required" },
        { status: 400 }
      );
    }

    const templates = await prisma.template.findMany({
      where: {
        packageId: packageId,
        ...(status && isTemplateStatus(status) ? { status } : {}),
      },
      include: {
        _count: {
          select: {
            sitesAssets: true,
            templateTeamMembers: true,
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json(templates);
  } catch (error) {
    console.error("Error fetching templates:", error);
    return NextResponse.json(
      { error: "Failed to fetch templates" },
      { status: 500 }
    );
  }
}
