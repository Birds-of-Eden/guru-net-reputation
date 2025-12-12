// app/api/tasks/route.ts

import { NextResponse } from "next/server";
import { startOfDay, endOfDay } from "date-fns";
import prisma from "@/lib/prisma";

// ========== READ TASKS WITH DATE RANGE & FILTERS ==========
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const clientId = searchParams.get("clientId");
    const packageId = searchParams.get("packageId");
    const status = searchParams.get("status");
    const assignedToId = searchParams.get("assignedToId");

    // ⭐ NEW: QC SUPERVISOR FILTER
    const qcSupervisorId = searchParams.get("qcSupervisorId");

    // -------- Optional query tuning --------
    const sortByParam = searchParams.get("sortBy") || "dueDate";
    const sortDirParam =
      (searchParams.get("sortDir") || "asc").toLowerCase() === "desc"
        ? "desc"
        : "asc";
    const limitParam = Number.parseInt(searchParams.get("limit") || "100", 10);
    const rangeByParam =
      searchParams.get("rangeBy") ||
      searchParams.get("rangeField") ||
      "dueDate";

    const SORT_FIELDS: Record<
      string,
      "dueDate" | "updatedAt" | "createdAt" | "completedAt"
    > = {
      duedate: "dueDate",
      dueDate: "dueDate",
      updatedat: "updatedAt",
      updatedAt: "updatedAt",
      createdat: "createdAt",
      createdAt: "createdAt",
      completedat: "completedAt",
      completedAt: "completedAt",
      activity: "updatedAt",
    };

    const RANGE_FIELDS: Record<
      string,
      "dueDate" | "updatedAt" | "createdAt" | "completedAt" | "activity"
    > = {
      duedate: "dueDate",
      dueDate: "dueDate",
      updatedat: "updatedAt",
      updatedAt: "updatedAt",
      completedat: "completedAt",
      completedAt: "completedAt",
      activity: "activity",
    };

    const sortField = SORT_FIELDS[sortByParam] ?? "dueDate";
    const sortDir: "asc" | "desc" = sortDirParam;
    const rangeField = RANGE_FIELDS[rangeByParam] ?? "dueDate";
    const take = Math.min(
      Math.max(Number.isFinite(limitParam) ? limitParam : 100, 1),
      500
    );

    let where: any = {};

    // ----- Date Range -----
    if (startDate && endDate) {
      const window = {
        gte: startOfDay(new Date(startDate)),
        lte: endOfDay(new Date(endDate)),
      };

      if (rangeField === "activity") {
        where.OR = [
          { updatedAt: window },
          { completedAt: window },
          { createdAt: window },
        ];
      } else {
        where[rangeField] = window;
      }
    }

    // ----- Client Filter -----
    if (clientId) {
      where.clientId = clientId;
    }

    // ----- Package Filter -----
    if (packageId) {
      where.client = { packageId };
    }

    // ----- Status Filter -----
    if (status) {
      where.status = status;
    }

    // ----- Assigned User Filter -----
    if (assignedToId) {
      where.assignedToId = assignedToId;
    }

    // ⭐⭐⭐ QC SUPERVISOR FILTER (FIXED: merge safely) ⭐⭐⭐
    if (false && qcSupervisorId) {
      const agents = await prisma.user.findMany({
        where: { qcId: qcSupervisorId },
        select: { id: true },
      });

      const agentIds = agents.map((a) => a.id);

      if (agentIds.length === 0) {
        return NextResponse.json([]); // No agents ⇒ no tasks
      }

      const existingAssignedTo = where.assignedToId;

      if (existingAssignedTo) {
        where.AND = [
          ...(where.AND || []),
          { assignedToId: existingAssignedTo },
          { assignedToId: { in: agentIds } },
        ];
        delete where.assignedToId;
      } else {
        where.assignedToId = { in: agentIds };
      }
    }

    // ⭐⭐⭐ NEW: QC SUPERVISOR FILTER ⭐⭐⭐
    if (qcSupervisorId) {
      const agents = await prisma.user.findMany({
        where: { qcId: qcSupervisorId },
        select: { id: true },
      });

      const agentIds = agents.map((a) => a.id);

      if (agentIds.length === 0) {
        return NextResponse.json([]); // No agents → no tasks
      }

      where.assignedToId = { in: agentIds };
    }

    // ----- Fetch tasks -----
    const tasks = await prisma.task.findMany({
      where,
      select: {
        id: true,
        name: true,
        status: true,
        priority: true,
        dueDate: true,
        createdAt: true,
        updatedAt: true,
        notes: true,
        idealDurationMinutes: true,
        actualDurationMinutes: true,
        performanceRating: true,
        completionLink: true,
        completedAt: true,
        qcTotalScore: true,
        qcReview: true,
        client: { select: { id: true, name: true, packageId: true } },
        category: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
      },
      orderBy: { [sortField]: sortDir },
      take,
    });

    return NextResponse.json(tasks);
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return NextResponse.json(
      { error: "Failed to fetch tasks" },
      { status: 500 }
    );
  }
}
