// app/api/tasks/monthlyReport/route.ts

import { NextResponse } from "next/server";
import { startOfDay, endOfDay, parseISO } from "date-fns";
import prisma from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    // ---------- Basic params ----------
    const dateParam = searchParams.get("date");
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const allDates =
      (searchParams.get("allDates") ?? "").toLowerCase() === "true";

    const clientId = searchParams.get("clientId");
    const packageId = searchParams.get("packageId");
    const status = searchParams.get("status");
    const assignedToId = searchParams.get("assignedToId");
    const search = searchParams.get("search")?.trim();

    const orderByField =
      (searchParams.get("orderBy") as "dueDate" | "createdAt" | "updatedAt") ||
      "dueDate";
    const order = (searchParams.get("order") as "asc" | "desc") || "asc";

    const takeParam = Number(searchParams.get("take") ?? 1000);
    const skip = Number(searchParams.get("skip") ?? 0);
    const take = Math.min(Math.max(takeParam, 1), 5000);

    // ---------- Build where ----------
    const where: any = {};

    if (!allDates) {
      if (startDateParam && endDateParam) {
        const start = startOfDay(parseISO(startDateParam));
        const end = endOfDay(parseISO(endDateParam));
        where.dueDate = { gte: start, lte: end };
      } else if (dateParam) {
        const base = parseISO(dateParam);
        const start = startOfDay(base);
        const end = endOfDay(base);
        where.dueDate = { gte: start, lte: end };
      }
    }

    if (clientId) where.clientId = clientId;
    if (packageId) where.client = { packageId };
    if (status) where.status = status;
    if (assignedToId) where.assignedToId = assignedToId;

    if (search && search.length > 0) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { assignedTo: { name: { contains: search, mode: "insensitive" } } },
        {
          client: {
            package: { name: { contains: search, mode: "insensitive" } },
          },
        },
      ];
    }

    // ---------- Query ----------
    const taskQuery = prisma.task.findMany({
      where,
      select: {
        id: true,
        name: true,
        dueDate: true,
        status: true,
        category: { select: { id: true, name: true } },
        client: {
          select: {
            id: true,
            packageId: true,
            package: { select: { id: true, name: true } },
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
            role: { select: { name: true } },
          },
        },
      },
      orderBy: { [orderByField]: order },
      skip,
      take,
    });

    const countQuery = prisma.task.count({ where });

    // OPTIMIZATION (parallel queries): fetch rows and total count simultaneously.
    const [tasks, totalCount] = await Promise.all([taskQuery, countQuery]);

    return NextResponse.json(
      {
        meta: {
          total: totalCount,
          count: tasks.length,
          skip,
          take,
          orderBy: orderByField,
          order,
          filters: {
            date: dateParam,
            startDate: startDateParam,
            endDate: endDateParam,
            allDates,
            clientId,
            packageId,
            status,
            assignedToId,
            search,
          },
        },
        data: tasks,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=60",
        },
      }
    );
  } catch (error) {
    console.error("Error fetching full tasks:", error);
    return NextResponse.json(
      { error: "Failed to fetch full tasks" },
      { status: 500 }
    );
  }
}
