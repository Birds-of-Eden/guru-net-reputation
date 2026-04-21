import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const entityType = searchParams.get("entityType")?.trim() || undefined;
    const entityId = searchParams.get("entityId")?.trim() || undefined;
    const action = searchParams.get("action")?.trim() || undefined;
    const limitParam = Number.parseInt(searchParams.get("limit") || "20", 10);
    const pageParam = Number.parseInt(searchParams.get("page") || "1", 10);

    const limit = Number.isFinite(limitParam) ? Math.max(1, limitParam) : 20;
    const page = Number.isFinite(pageParam) ? Math.max(1, pageParam) : 1;
    const skip = (page - 1) * limit;

    const where = {
      ...(entityType ? { entityType } : {}),
      ...(entityId ? { entityId } : {}),
      ...(action && action !== "all" ? { action } : {}),
    };

    const logs = await prisma.activityLog.findMany({
      where,
      orderBy: { timestamp: "desc" },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      skip,
      take: limit,
    });

    return NextResponse.json(logs);
  } catch (error) {
    console.error("Error fetching activity logs:", error);
    return NextResponse.json(
      {
        message: "Failed to fetch activity logs",
        error:
          process.env.NODE_ENV === "development"
            ? (error as any)?.message
            : undefined,
      },
      { status: 500 }
    );
  }
}
