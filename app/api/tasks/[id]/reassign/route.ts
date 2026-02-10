// app/api/tasks/[id]/reassign/route.ts

import { NextResponse } from "next/server";
import { PerformanceRating } from "@prisma/client"; // ✅ enum import
import prisma from "@/lib/prisma";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params;
    const { toAgentId, reassignNotes, reassignedById, reassignedByEmail } =
      await req.json();

    // কে reassign করছে (optional)
    let reassignedBy: string | null = null;
    if (reassignedById || reassignedByEmail) {
      const u = await prisma.user.findUnique({
        where: reassignedById
          ? { id: reassignedById }
          : { email: reassignedByEmail },
        select: { id: true, email: true },
      });
      reassignedBy = u?.id ?? u?.email ?? null;
    }

    // টাস্ক লোড (previous rating audit করার জন্য)
    // Get the task with its category information
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        name: true,
        assignedToId: true,
        clientId: true,
        performanceRating: true, // audit only
        category: {
          select: {
            name: true
          }
        }, // Get category name
        completionLink: true, // We need this to preserve it for certain categories
      },
    });
    if (!task) {
      return NextResponse.json({ message: "Task not found" }, { status: 404 });
    }

    const fromAgentId = task.assignedToId;
    const toId = toAgentId ?? fromAgentId; // current agent default

    await prisma.$transaction(async (tx) => {
      // Prepare the update data
      const updateData: any = {
        assignedToId: toId,
        status: "reassigned",
        reassignNotes: reassignNotes ?? "",
        completedAt: null,
        performanceRating: PerformanceRating.Poor, // ✅ সবসময় Poor
        updatedAt: new Date(),
        pauseReasons: [], // ✅ IMPORTANT: clear timer event history on reassign

      };

      // Only reset completionLink for non-social and non-blog tasks
      const preserveLinkCategories = ["Social Activity", "Blog Posting"];
      const categoryName = task?.category?.name;
      if (!categoryName || !preserveLinkCategories.includes(categoryName)) {
        updateData.completionLink = null;
      }

      await tx.task.update({
        where: { id: taskId },
        data: updateData,
      });

      await tx.activityLog.create({
        data: {
          id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          entityType: "Task",
          entityId: taskId,
          userId: toId,
          action: "task_reassigned",
          details: {
            clientId: task.clientId,
            reassignedAt: new Date().toISOString(),
            reassignedTo: toId,
            reassignedFrom: fromAgentId ?? null,
            reassignedBy: reassignedBy ?? "system",
            reassignNotes: reassignNotes ?? null,
            previousPerformance: task.performanceRating ?? null, // 📝 audit
            newPerformance: PerformanceRating.Poor, // 📝 audit
          },
        },
      });

      // counters update (from != to হলে)
      if (task.clientId && fromAgentId && fromAgentId !== toId) {
        const existing = await tx.clientTeamMember.findUnique({
          where: {
            clientId_agentId: { clientId: task.clientId, agentId: fromAgentId },
          },
          select: { assignedTasks: true },
        });
        if (existing) {
          await tx.clientTeamMember.update({
            where: {
              clientId_agentId: {
                clientId: task.clientId,
                agentId: fromAgentId,
              },
            },
            data: {
              assignedTasks: Math.max(0, (existing.assignedTasks ?? 0) - 1),
            },
          });
        }
        const dest = await tx.clientTeamMember.findUnique({
          where: {
            clientId_agentId: { clientId: task.clientId, agentId: toId },
          },
          select: { assignedTasks: true },
        });
        if (dest) {
          await tx.clientTeamMember.update({
            where: {
              clientId_agentId: { clientId: task.clientId, agentId: toId },
            },
            data: { assignedTasks: (dest.assignedTasks ?? 0) + 1 },
          });
        } else {
          await tx.clientTeamMember.create({
            data: {
              clientId: task.clientId,
              agentId: toId,
              assignedTasks: 1,
              assignedDate: new Date(),
            },
          });
        }
      }
    });

    // notifications
    const adminManagers = await prisma.user.findMany({
      where: { role: { name: { in: ["admin", "manager"] } } },
      select: { id: true },
    });
    const [client, toUser] = await Promise.all([
      task.clientId
        ? prisma.client.findUnique({
            where: { id: task.clientId },
            select: { name: true },
          })
        : Promise.resolve(null),
      toId
        ? prisma.user.findUnique({
            where: { id: toId },
            select: {
              id: true,
              name: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          })
        : Promise.resolve(null),
    ]);
    const clientName = client?.name || "Client";
    const taskName = task?.name || "task";
    const assigneeName =
      toUser?.name ||
      `${toUser?.firstName ?? ""} ${toUser?.lastName ?? ""}`.trim() ||
      toUser?.email ||
      "Agent";

    const notifs: Promise<any>[] = [
      prisma.notification.create({
        data: {
          userId: toId,
          taskId,
          type: "general",
          message: `${assigneeName} has been reassigned a task for ${clientName}.`,
          createdAt: new Date(),
        },
      }),
    ];
    if (fromAgentId && fromAgentId !== toId) {
      notifs.push(
        prisma.notification.create({
          data: {
            userId: fromAgentId,
            taskId,
            type: "general",
            message: "A task previously assigned to you has been reassigned.",
            createdAt: new Date(),
          },
        })
      );
    }
    if (adminManagers.length) {
      const message = toId
        ? `${assigneeName} has been reassigned ${taskName} for ${clientName}.`
        : `${taskName} has been unassigned for ${clientName}.`;
      notifs.push(
        prisma.notification.createMany({
          data: adminManagers.map((u) => ({
            userId: u.id,
            taskId,
            type: "general",
            message,
            createdAt: new Date(),
          })),
        })
      );
    }
    await Promise.all(notifs);

    return NextResponse.json({
      message: "Task reassigned",
      taskId,
      reassignedFrom: fromAgentId ?? null,
      reassignedTo: toId,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: "Failed to reassign" },
      { status: 500 }
    );
  }
}
