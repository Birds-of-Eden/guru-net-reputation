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

    // -------- Optional query tuning (safe defaults preserved) --------
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

    const SORT_FIELDS: Record<string, "dueDate" | "updatedAt" | "createdAt" | "completedAt"> = {
      duedate: "dueDate",
      dueDate: "dueDate",
      updatedat: "updatedAt",
      updatedAt: "updatedAt",
      createdat: "createdAt",
      createdAt: "createdAt",
      completedat: "completedAt",
      completedAt: "completedAt",
      activity: "updatedAt", // best-effort ordering for live views
    };

    const RANGE_FIELDS: Record<string, "dueDate" | "updatedAt" | "createdAt" | "completedAt" | "activity"> = {
      duedate: "dueDate",
      dueDate: "dueDate",
      updatedat: "updatedAt",
      updatedAt: "updatedAt",
      completedat: "completedAt",
      completedAt: "completedAt",
      activity: "activity", // updated/completed/created window
    };

    const sortField = SORT_FIELDS[sortByParam] ?? "dueDate";
    const sortDir: "asc" | "desc" = sortDirParam;
    const rangeField = RANGE_FIELDS[rangeByParam] ?? "dueDate";
    const take = Math.min(Math.max(Number.isFinite(limitParam) ? limitParam : 100, 1), 500); // cap to protect DB

    let where: any = {};

    // ----- Date Range -----
    if (startDate && endDate) {
      const window = {
        gte: startOfDay(new Date(startDate)),
        lte: endOfDay(new Date(endDate)),
      };

      if (rangeField === "activity") {
        // Include any task touched in the window (updated/completed/created)
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

    // ----- Package Filter (via client relation) -----
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

    // Fetch tasks efficiently
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


// // app/api/tasks/route.ts

// import { NextResponse } from "next/server";
// import { startOfDay, endOfDay } from "date-fns";
// import prisma from "@/lib/prisma";

// // ========== READ TASKS WITH DATE RANGE & FILTERS ==========
// export async function GET(req: Request) {
//   try {
//     const { searchParams } = new URL(req.url);

//     const startDate = searchParams.get("startDate");
//     const endDate = searchParams.get("endDate");
//     const clientId = searchParams.get("clientId");
//     const packageId = searchParams.get("packageId");
//     const status = searchParams.get("status");
//     const assignedToId = searchParams.get("assignedToId");

//     let where: any = {};

//     // ----- Date Range -----
//     if (startDate && endDate) {
//       where.dueDate = {
//         gte: startOfDay(new Date(startDate)),
//         lte: endOfDay(new Date(endDate)),
//       };
//     }

//     // ----- Client Filter -----
//     if (clientId) {
//       where.clientId = clientId;
//     }

//     // ----- Package Filter (via client relation) -----
//     if (packageId) {
//       where.client = { packageId };
//     }

//     // ----- Status Filter -----
//     if (status) {
//       where.status = status;
//     }

//     // ----- Assigned User Filter -----
//     if (assignedToId) {
//       where.assignedToId = assignedToId;
//     }

//     // Fetch tasks efficiently
//     const tasks = await prisma.task.findMany({
//       where,
//       include: {
//         client: { select: { id: true, name: true, packageId: true } },
//         category: { select: { id: true, name: true } },
//         assignedTo: { select: { id: true, name: true, email: true } },
//       },
//       orderBy: { dueDate: "asc" },
//       take: 100, // ✅ limit (add pagination later if needed)
//     });

//     return NextResponse.json(tasks);
//   } catch (error) {
//     console.error("Error fetching tasks:", error);
//     return NextResponse.json(
//       { error: "Failed to fetch tasks" },
//       { status: 500 }
//     );
//   }
// }
