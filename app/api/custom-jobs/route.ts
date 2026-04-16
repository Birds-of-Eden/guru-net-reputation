// ================================
// FILE: app/api/custom-jobs/route.ts
// ================================
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, Prisma, TaskPriority, TaskStatus, TaskType } from "@prisma/client";
import { randomUUID } from "crypto";
import { mapTaskToCustomJob } from "../utils/custom-jobs";

const prisma = new PrismaClient();

type CustomJobPayload = {
  date?: string;
  clientId?: string;
  name?: string; // Task লিখা হবে এখানে
  assignedToId?: string | null; // approved assignment flow পরে add করা যাবে
  issueStatus?: string | null;
  qcStatus?: string | null;
  clientNotificationUpdate?: string | null;
  priority?: TaskPriority;
  status?: TaskStatus;
  notes?: string | null;
  link?: string | null; // mail/drive/slack link
};


export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId") || undefined;
    const priority = (searchParams.get("priority") as TaskPriority | null) || undefined;
    const status = (searchParams.get("status") as TaskStatus | null) || undefined;
    const search = searchParams.get("search") || "";

    const where: Prisma.TaskWhereInput = {
      ...(clientId ? { clientId } : {}),
      ...(priority ? { priority } : {}),
      ...(status ? { status } : {}),
      taskType: TaskType.customjob,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { notes: { contains: search, mode: "insensitive" } },
              { client: { name: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
      // custom jobs ধরার জন্য
      category: {
        name: "Custom Job",
      },
    };

    const tasks = await prisma.task.findMany({
      where,
      include: {
        client: { 
          select: { 
            id: true, 
            name: true, 
            amId: true,
            accountManager: {
              select: { id: true, name: true, email: true }
            }
          } 
        },
        assignedTo: { select: { id: true, name: true, email: true } },
        category: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: tasks.map(mapTaskToCustomJob) });
  } catch (error) {
    console.error("GET /api/custom-jobs error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch custom jobs" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CustomJobPayload;

    if (!body.clientId) {
      return NextResponse.json(
        { success: false, message: "clientId is required" },
        { status: 400 }
      );
    }

    if (!body.name?.trim()) {
      return NextResponse.json(
        { success: false, message: "Task name is required" },
        { status: 400 }
      );
    }

    let category = await prisma.taskCategory.findUnique({
      where: { name: "Custom Job" },
    });

    if (!category) {
      category = await prisma.taskCategory.create({
        data: {
          id: randomUUID(),
          name: "Custom Job",
          description: "Manual custom jobs task",
        },
      });
    }

    const created = await prisma.task.create({
      data: {
        id: randomUUID(),
        clientId: body.clientId,
        assignedToId: body.assignedToId || null,
        categoryId: category.id,
        name: body.name.trim(),
        dueDate: body.date ? new Date(body.date) : null,
        priority: body.priority || "medium",
        status: body.status || "requested",
        taskType: TaskType.customjob,
        notes: body.notes || null,
        completionLink: body.link || null,
        taskCompletionJson: {
          issueStatus: body.issueStatus || "",
          qcStatus: body.qcStatus || "requested",
          clientNotificationUpdate: body.clientNotificationUpdate || "",
          link: body.link || "",
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
      message: "Custom job created successfully",
      data: mapTaskToCustomJob(created),
    });
  } catch (error) {
    console.error("POST /api/custom-jobs error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to create custom job" },
      { status: 500 }
    );
  }
}
