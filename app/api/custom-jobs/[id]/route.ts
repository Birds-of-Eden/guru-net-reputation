// ================================
// FILE: app/api/custom-jobs/[id]/route.ts
// ================================
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, TaskPriority, TaskStatus } from "@prisma/client";
import { mapTaskToCustomJob, parseJsonSafe } from "../../utils/custom-jobs";
import { getAuthUser } from "@/lib/getAuthUser";

const prismaById = new PrismaClient();

async function getScopedTask(id: string) {
  const currentUser = await getAuthUser();
  const userRole = currentUser?.role;
  const userId = currentUser?.id;
  const isAM = userRole === "am";

  const task = await prismaById.task.findUnique({
    where: { id },
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
      taskCompletionJson: true,
      taskType: true,
      clientId: true,
      assignedToId: true,
      category: true,
      client: {
        select: {
          id: true,
          name: true,
          amId: true,
          accountManager: {
            select: { id: true, name: true, email: true },
          },
        },
      },
      assignedTo: { select: { id: true, name: true, email: true } },
    },
  });

  if (!task) {
    return { task: null, denied: false };
  }

  if (isAM && userId && task.client?.amId !== userId) {
    return { task: null, denied: true };
  }

  return { task, denied: false };
}

type UpdatePayload = {
  date?: string;
  dueDate?: string;
  clientId?: string;
  name?: string;
  assignedToId?: string | null;
  issueStatus?: string | null;
  qcStatus?: string | null;
  clientNotificationUpdate?: string | null;
  amUpdateStatus?: "approved" | "rejected" | null;
  completionNotes?: string | null;
  priority?: TaskPriority;
  status?: TaskStatus;
  notes?: string | null;
  link?: string | null;
  idealDurationMinutes?: number | null;
};

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { task, denied } = await getScopedTask(id);

    if (denied) {
      return NextResponse.json(
        { success: false, message: "Forbidden" },
        { status: 403 }
      );
    }

    if (!task) {
      return NextResponse.json(
        { success: false, message: "Custom job not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: mapTaskToCustomJob(task) });
  } catch (error) {
    console.error("GET /api/custom-jobs/[id] error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch custom job" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await req.json()) as UpdatePayload;
    const { task: existing, denied } = await getScopedTask(id);
    const currentUser = await getAuthUser();
    const isAM = currentUser?.role === "am";

    if (denied) {
      return NextResponse.json(
        { success: false, message: "Forbidden" },
        { status: 403 }
      );
    }

    if (!existing) {
      return NextResponse.json(
        { success: false, message: "Custom job not found" },
        { status: 404 }
      );
    }

    const prevJson = parseJsonSafe(existing.taskCompletionJson, {});
    const requestedStatusChange =
      body.status !== undefined && body.status !== existing.status;
    const resolvedDueDate = body.dueDate ?? body.date;

    if (requestedStatusChange) {
      const allowed =
        (existing.status === "requested" &&
          (body.status === "requested" || body.status === "approved")) ||
        (existing.status === "approved" &&
          (body.status === "approved" || body.status === "pending"));

      if (!allowed) {
        return NextResponse.json(
          {
            success: false,
            message: "Custom job status can only change from requested to approved, or approved to pending.",
          },
          { status: 400 }
        );
      }
    }

    if (body.assignedToId !== undefined && body.assignedToId && existing.status !== "approved") {
      return NextResponse.json(
        {
          success: false,
          message: "Only approved custom jobs can be assigned.",
        },
        { status: 400 }
      );
    }

    const hasAmUpdate =
      body.amUpdateStatus !== undefined || body.completionNotes !== undefined;

    if (hasAmUpdate) {
      if (!isAM) {
        return NextResponse.json(
          { success: false, message: "Only AM can save AM updates." },
          { status: 403 }
        );
      }

      if (existing.status !== "completed" && existing.status !== "qc_approved") {
        return NextResponse.json(
          {
            success: false,
            message: "AM updates are allowed only for completed or qc approved custom jobs.",
          },
          { status: 400 }
        );
      }
    }

    const updated = await prismaById.task.update({
      where: { id },
      data: {
        clientId: body.clientId ?? existing.clientId,
        assignedToId:
          body.assignedToId !== undefined ? body.assignedToId : existing.assignedToId,
        name: body.name?.trim() ?? existing.name,
        dueDate: resolvedDueDate ? new Date(resolvedDueDate) : existing.dueDate,
        priority: body.priority ?? existing.priority,
        status: body.status ?? existing.status,
        notes: body.notes !== undefined ? body.notes : existing.notes,
        completionLink: body.link !== undefined ? body.link : existing.completionLink,
        idealDurationMinutes: body.idealDurationMinutes !== undefined ? body.idealDurationMinutes : existing.idealDurationMinutes,
        taskCompletionJson: {
          ...prevJson,
          ...(body.issueStatus !== undefined ? { issueStatus: body.issueStatus } : {}),
          ...(body.qcStatus !== undefined ? { qcStatus: body.qcStatus } : {}),
          ...(body.clientNotificationUpdate !== undefined
            ? { clientNotificationUpdate: body.clientNotificationUpdate }
            : {}),
          ...(body.amUpdateStatus !== undefined
            ? { amUpdateStatus: body.amUpdateStatus }
            : {}),
          ...(body.completionNotes !== undefined ? { notes: body.completionNotes } : {}),
          ...(body.link !== undefined ? { link: body.link } : {}),
          source: "custom-job",
        },
      },
      include: {
        client: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Custom job updated successfully",
      data: mapTaskToCustomJob(updated),
    });
  } catch (error) {
    console.error("PATCH /api/custom-jobs/[id] error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to update custom job" },
      { status: 500 }
    );
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { task: existing, denied } = await getScopedTask(id);

    if (denied) {
      return NextResponse.json(
        { success: false, message: "Forbidden" },
        { status: 403 }
      );
    }

    if (!existing) {
      return NextResponse.json(
        { success: false, message: "Custom job not found" },
        { status: 404 }
      );
    }

    await prismaById.task.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: "Custom job deleted successfully",
    });
  } catch (error) {
    console.error("DELETE /api/custom-jobs/[id] error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to delete custom job" },
      { status: 500 }
    );
  }
}

