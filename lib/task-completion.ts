// lib/task-completion.ts
// Adds `qcReviewedAt` and `qcReviewer` to tasks so screens can show who
// QC-approved a task and when (the reviewer id lives inside the qcReview JSON).
import prisma from "@/lib/prisma";

type WithQc = { qcReview?: any; [k: string]: any };

export async function attachQcReviewers<T extends WithQc>(tasks: T[]) {
  const ids = Array.from(
    new Set(
      tasks
        .map((t) => t?.qcReview?.reviewerId)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  );
  const users = ids.length
    ? await prisma.user.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const byId = new Map(users.map((u) => [u.id, u]));

  return tasks.map((t) => {
    const r = t?.qcReview;
    return {
      ...t,
      qcReviewedAt: typeof r?.reviewedAt === "string" ? r.reviewedAt : null,
      qcReviewer: r?.reviewerId ? byId.get(r.reviewerId) ?? null : null,
    };
  });
}
