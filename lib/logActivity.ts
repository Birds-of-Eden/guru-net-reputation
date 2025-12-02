// lib/logActivity.ts
import prisma from "@/lib/prisma";

import type { Prisma } from '@prisma/client';

type LogParams = {
  entityType: string; // "User", "Package", "Client"
  entityId: string; // user.id / client.id / package.id
  userId?: string; // যিনি action করলেন (admin/agent)
  action: string; // "create", "update", "delete"
  details?: Prisma.InputJsonValue; // extra তথ্য (JSON আকারে)
};

export async function logActivity({
  entityType,
  entityId,
  userId,
  action,
  details,
}: LogParams) {
  return prisma.activityLog.create({
    data: {
      id: crypto.randomUUID(), // unique id
      entityType,
      entityId,
      userId,
      action,
      details,
    },
  });
}
