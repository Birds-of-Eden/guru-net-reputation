import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

function normalizeStatus(status: unknown) {
  return String(status ?? "").toLowerCase().trim();
}

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const qcSupervisorId = searchParams.get("qcSupervisorId");
    const page = parsePositiveInt(searchParams.get("page"), 1);
    const pageSizeParam = searchParams.get("pageSize");
    const pageSize = pageSizeParam ? parsePositiveInt(pageSizeParam, 50) : null;

    if (!qcSupervisorId) {
      return NextResponse.json(
        { clients: [], total: 0, page, pageSize, totalPages: 1 },
        { status: 200 },
      );
    }

    const supervisedTaskWhere: any = {
      assignedTo: { is: { qcId: qcSupervisorId } },
      OR: [{ clientId: { not: null } }, { assignment: { clientId: { not: null } } }],
    };

    // Resolve unique clients before pagination. Paginating raw tasks first can hide
    // clients when a few clients own most of the latest task rows.
    const supervisedTasks = (await prisma.task.findMany({
      where: supervisedTaskWhere,
      select: {
        clientId: true,
        status: true,
        dueDate: true,
        createdAt: true,
        updatedAt: true,
        assignment: { select: { clientId: true } },
      },
    })) as Array<{
      clientId: string | null;
      status: string;
      dueDate: Date | null;
      createdAt: Date;
      updatedAt: Date;
      assignment: { clientId: string | null } | null;
    }>;

    const clientIds: string[] = Array.from(
      new Set(
        supervisedTasks
          .map((row) => row.clientId ?? row.assignment?.clientId)
          .filter((id): id is string => Boolean(id)),
      ),
    );

    if (clientIds.length === 0) {
      return NextResponse.json({
        clients: [],
        total: 0,
        page,
        pageSize,
        totalPages: 1,
      });
    }

    const clients = await prisma.client.findMany({
      where: { id: { in: clientIds } },
      select: { id: true, name: true, company: true },
      orderBy: { name: "asc" },
    });

    const statsByClient = new Map<
      string,
      {
        totalTasks: number;
        completed: number;
        pending: number;
        inProgress: number;
        reassigned: number;
        overdue: number;
        qcApproved: number;
        latestTaskDate: Date | null;
      }
    >();

    for (const clientId of clientIds) {
      statsByClient.set(clientId, {
        totalTasks: 0,
        completed: 0,
        pending: 0,
        inProgress: 0,
        reassigned: 0,
        overdue: 0,
        qcApproved: 0,
        latestTaskDate: null,
      });
    }

    const now = Date.now();

    for (const row of supervisedTasks) {
      const clientId = row.clientId ?? row.assignment?.clientId;
      if (!clientId) continue;

      const stats = statsByClient.get(clientId);
      if (!stats) continue;

      stats.totalTasks += 1;
      const rowDate = row.dueDate ?? row.updatedAt ?? row.createdAt;
      if (!stats.latestTaskDate || rowDate.getTime() > stats.latestTaskDate.getTime()) {
        stats.latestTaskDate = rowDate;
      }

      switch (normalizeStatus(row.status)) {
        case "completed":
          stats.completed += 1;
          break;
        case "pending":
          stats.pending += 1;
          break;
        case "in_progress":
          stats.inProgress += 1;
          break;
        case "reassigned":
          stats.reassigned += 1;
          break;
        case "qc_approved":
          stats.qcApproved += 1;
          break;
      }

      const status = normalizeStatus(row.status);
      if (
        row.dueDate &&
        row.dueDate.getTime() < now &&
        !["completed", "qc_approved", "cancelled"].includes(status)
      ) {
        stats.overdue += 1;
      }
    }

    const allClients = clients.map((client) => {
      const stats = statsByClient.get(client.id) ?? {
        totalTasks: 0,
        completed: 0,
        pending: 0,
        inProgress: 0,
        reassigned: 0,
        overdue: 0,
        qcApproved: 0,
        latestTaskDate: null,
      };

      return {
        client,
        ...stats,
        latestTaskDate: stats.latestTaskDate?.toISOString() ?? null,
        progress: stats.totalTasks
          ? Math.round((stats.qcApproved / stats.totalTasks) * 100)
          : 0,
      };
    });

    const total = allClients.length;
    const totalPages = pageSize ? Math.max(1, Math.ceil(total / pageSize)) : 1;
    const pagedClients = pageSize
      ? allClients.slice((page - 1) * pageSize, page * pageSize)
      : allClients;

    return NextResponse.json({
      clients: pagedClients,
      total,
      page,
      pageSize,
      totalPages,
    });
  } catch (error) {
    console.error("Error fetching QC clients:", error);
    return NextResponse.json(
      { error: "Failed to fetch QC clients" },
      { status: 500 },
    );
  }
}
