// ================================
// FILE: app/api/utils/custom-jobs.ts
// ================================

function parseJsonSafe(value: unknown, fallback: Record<string, unknown> = {}) {
  if (!value) return fallback;
  if (typeof value === "object") return value as Record<string, unknown>;
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}

export function mapTaskToCustomJob(task: any) {
  const extra = parseJsonSafe(task.taskCompletionJson, {});
  const social = Array.isArray(task.socialCommunications)
    ? task.socialCommunications
    : parseJsonSafe(task.socialCommunications, { items: [] });

  return {
    id: task.id,
    date: task.dueDate ?? task.createdAt,
    clientId: task.clientId,
    clientName: task.client?.name ?? "",
    amId: task.client?.amId ?? "",
    amName: task.client?.accountManager?.name ?? "",
    name: task.name,
    assignedToId: task.assignedToId,
    assignedToName: task.assignedTo?.name ?? "",
    issueStatus: (extra.issueStatus as string) ?? task.notes ?? "",
    qcStatus: (extra.qcStatus as string) ?? "pending",
    priority: task.priority,
    status: task.status,
    link: (extra.link as string) ?? task.completionLink ?? "",
    notes: task.notes ?? "",
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    taskCompletionJson: task.taskCompletionJson,
  };
}

export { parseJsonSafe };
