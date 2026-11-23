// lib/realtime/chat.ts
// Tells every participant's personal channel that a conversation changed,
// so conversation lists and unread badges refresh instantly on all pages.
import prisma from "@/lib/prisma";
import { realtime } from "./server";

export async function notifyConversationChanged(conversationIds: string | string[]) {
  const ids = Array.isArray(conversationIds) ? conversationIds : [conversationIds];
  if (!ids.length) return;
  try {
    const participants = await prisma.conversationParticipant.findMany({
      where: { conversationId: { in: ids } },
      select: { userId: true, conversationId: true },
    });
    const byUser = new Map<string, string[]>();
    for (const p of participants) {
      const list = byUser.get(p.userId) ?? [];
      list.push(p.conversationId);
      byUser.set(p.userId, list);
    }
    await Promise.all(
      Array.from(byUser.entries()).map(([userId, conversationIds]) =>
        realtime.trigger(`user-${userId}`, "chat:changed", { conversationIds })
      )
    );
  } catch (err) {
    console.error("[realtime] notifyConversationChanged failed:", err);
  }
}

/** Only the given user (e.g. after they read a conversation in one tab). */
export async function notifyChatChangedForUser(userId: string, conversationId: string) {
  await realtime.trigger(`user-${userId}`, "chat:changed", { conversationIds: [conversationId] });
}
