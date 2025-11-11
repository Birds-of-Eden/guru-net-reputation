// app/api/clients/[id]/development-summary/route.ts

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

function getMonthRange(offset: number = 0) {
  const now = new Date();
  const month = now.getMonth() + offset;
  const year = now.getFullYear();
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0, 23, 59, 59);
  return { start, end };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // current and previous month ranges
    const { start: currentStart, end: currentEnd } = getMonthRange(0);
    const { start: prevStart, end: prevEnd } = getMonthRange(-1);

    // aggregate tasks per month
    const [prev, current] = await Promise.all([
      prisma.task.groupBy({
        by: ["status"],
        where: {
          clientId: id,
          createdAt: { gte: prevStart, lte: prevEnd },
        },
        _count: { _all: true },
      }),
      prisma.task.groupBy({
        by: ["status"],
        where: {
          clientId: id,
          createdAt: { gte: currentStart, lte: currentEnd },
        },
        _count: { _all: true },
      }),
    ]);

    // helper to structure result
    const formatStats = (data: typeof prev) => {
      const base = {
        pending: 0,
        in_progress: 0,
        completed: 0,
        qc_approved: 0,
        overdue: 0,
        cancelled: 0,
        reassigned: 0,
      };
      for (const row of data)
        base[row.status as keyof typeof base] = row._count._all;

      const total =
        base.pending +
        base.in_progress +
        base.completed +
        base.qc_approved +
        base.overdue +
        base.cancelled +
        base.reassigned;

      const performance =
        total > 0
          ? Math.round(((base.completed + base.qc_approved) / total) * 100)
          : 0;

      return { ...base, total, performance };
    };

    const prevStats = formatStats(prev);
    const currentStats = formatStats(current);

    const diff = {
      completedChange: currentStats.completed - prevStats.completed,
      performanceChange: currentStats.performance - prevStats.performance,
      totalChange: currentStats.total - prevStats.total,
    };

    return NextResponse.json({
      clientId: id,
      previousMonth: {
        start: prevStart,
        end: prevEnd,
        ...prevStats,
      },
      currentMonth: {
        start: currentStart,
        end: currentEnd,
        ...currentStats,
      },
      difference: diff,
      summary: `Performance ${
        diff.performanceChange >= 0 ? "improved" : "declined"
      } by ${Math.abs(diff.performanceChange)}% compared to last month.`,
    });
  } catch (error) {
    console.error("Error in development-summary:", error);
    return NextResponse.json(
      { message: "Failed to generate development summary" },
      { status: 500 }
    );
  }
}
