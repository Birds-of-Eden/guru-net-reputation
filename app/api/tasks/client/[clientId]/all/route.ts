// app/api/tasks/client/[clientId]/all/route.ts
import { type NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { attachQcReviewers } from "@/lib/task-completion";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
    if (!clientId) {
      return NextResponse.json({ error: "clientId is required" }, { status: 400 });
    }

    // Same as OR [{clientId}, {assignment: {clientId}}], but filters on plain
    // columns (Task.clientId / Task.assignmentId) instead of a relation subquery.
    const assignmentIds = (
      await prisma.assignment.findMany({ where: { clientId }, select: { id: true } })
    ).map((a) => a.id);

    const tasks = await prisma.task.findMany({
      where: {
        OR: [
          { clientId },
          ...(assignmentIds.length ? [{ assignmentId: { in: assignmentIds } }] : []),
        ],
      },
      select: {
        id: true,
        name: true,
        priority: true,
        status: true,
        dueDate: true,
        completedAt: true,
        qcReview: true,
        assignedToId: true,
        assignedTo: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            email: true,
            image: true,
          },
        },
        templateSiteAsset: {
          select: {
            id: true,
            name: true,
            type: true,
            url: true,
          },
        },
        category: { select: { id: true, name: true } },
      },
      orderBy: [{ status: "asc" }, { priority: "desc" }, { dueDate: "asc" }],
    });

    const withQc = (await attachQcReviewers(tasks)).map(({ qcReview: _qc, ...t }: any) => t);
    return NextResponse.json(withQc);
  } catch (error: any) {
    console.error("Error fetching all client tasks (non-paginated):", error);
    return NextResponse.json(
      { error: "Failed to fetch client tasks", message: error?.message },
      { status: 500 }
    );
  }
}
