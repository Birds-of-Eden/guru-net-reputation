// lib/realtime/authorize.ts
// Decides which channels a connected user may subscribe to.
import prisma from "../prisma";
import type { RealtimeUser } from "./token";

export async function authorizeChannel(user: RealtimeUser, channel: string): Promise<boolean> {
  // Global activity feed: any signed-in user (same as the old public Pusher channel)
  if (channel === "activity") return true;

  // Personal + role channels are joined automatically; allow explicit re-subscribe of own only
  if (channel.startsWith("user-")) return channel === `user-${user.id}`;
  if (channel.startsWith("role-")) return !!user.role && channel === `role-${user.role}`;

  // Chat conversation presence channel: must be a participant
  const m = channel.match(/^presence-conversation-(.+)$/);
  if (m) {
    const conversationId = m[1];
    const member = await prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId: user.id } },
      select: { userId: true },
    });
    if (!member) return false;
    prisma.user
      .update({ where: { id: user.id }, data: { lastSeenAt: new Date() } })
      .catch(() => {});
    return true;
  }

  return false;
}
