// app/api/chat/conversations/route.ts

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthUser } from "@/lib/getAuthUser";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

type ConversationContext = {
  clientId?: string | null;
  teamId?: string | null;
  assignmentId?: string | null;
  taskId?: string | null;
};

const CONTEXT_KEYS: (keyof ConversationContext)[] = [
  "clientId",
  "teamId",
  "assignmentId",
  "taskId",
];

function buildConversationContext(context: ConversationContext) {
  const payload: Record<string, string> = {};
  for (const key of CONTEXT_KEYS) {
    const value = context[key];
    if (typeof value === "string" && value.trim().length > 0) {
      payload[key] = value;
    }
  }
  return Object.keys(payload).length ? payload : undefined;
}

function applyConversationContext<
  T extends { conversation_field_06?: Prisma.JsonValue | null }
>(conversation: T) {
  const raw = conversation.conversation_field_06;
  const meta =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  return {
    ...conversation,
    clientId: (meta.clientId as string | null | undefined) ?? null,
    teamId: (meta.teamId as string | null | undefined) ?? null,
    assignmentId: (meta.assignmentId as string | null | undefined) ?? null,
    taskId: (meta.taskId as string | null | undefined) ?? null,
  };
}

function contextFilter(field: keyof ConversationContext, value?: string) {
  if (!value) return undefined;
  return {
    conversation_field_06: {
      path: [field],
      equals: value,
    },
  };
}

// POST /api/chat/conversations  → create
export async function POST(req: Request) {
  const me = await getAuthUser();
  if (!me)
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const {
    type = "dm",
    title,
    memberIds = [],
    clientId,
    teamId,
    assignmentId,
    taskId,
  } = (await req.json()) || {};

  const normalizedTitle =
    typeof title === "string" ? title.trim() : "";
  if (type === "group" && !normalizedTitle) {
    return NextResponse.json(
      { message: "Group title is required" },
      { status: 400 }
    );
  }

  // Enforce: clients may only create a DM with their assigned AM
  const roleName = (me as any)?.role?.name?.toLowerCase?.() || "";
  if (roleName === "client") {
    // fetch client's AM
    const myClientId = (me as any)?.clientId || null;
    if (!myClientId) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const client = await prisma.client.findUnique({
      where: { id: myClientId },
      select: { amId: true },
    });
    const amId = client?.amId || null;
    // Only allowed if: type === 'dm' and memberIds contain only AM (besides me)
    const others = (Array.isArray(memberIds) ? memberIds : []).filter(
      (id: string) => id && id !== me.id
    );
    const onlyAM = others.length === 1 && amId && others[0] === amId;
    if (type !== "dm" || !onlyAM) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }
  }

  const uniqueMemberIds = Array.from(new Set([...memberIds, me.id]));

  // Enforce: Agent may only create DM and cannot target AM/account manager or client
  if (roleName === "agent") {
    if (type !== "dm") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }
    const others = uniqueMemberIds.filter((id) => id !== me.id);
    if (others.length !== 1) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }
    const otherId = others[0];
    const target = await prisma.user.findUnique({ where: { id: otherId }, include: { role: true } });
    const targetRole = target?.role?.name?.toLowerCase?.() || "";
    if (["client", "am", "account manager", "account_manager"].includes(targetRole)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }
  }

  // Enforce: AM may only create DM with allowed targets (admin/manager or AM's client)
  if (["am", "account manager", "account_manager"].includes(roleName)) {
    // Only DM allowed
    if (type !== "dm") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }
    const others = uniqueMemberIds.filter((id) => id !== me.id);
    if (others.length !== 1) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }
    const otherId = others[0];
    const target = await prisma.user.findUnique({ where: { id: otherId }, include: { role: true } });
    if (!target) {
      return NextResponse.json({ message: "Invalid member" }, { status: 400 });
    }
    const targetRole = target.role?.name?.toLowerCase?.() || "";
    let allowed = targetRole === "admin" || targetRole === "manager";
    if (!allowed) {
      const tClientId = (target as any)?.clientId || null;
      if (tClientId) {
        const count = await prisma.client.count({ where: { id: tClientId, amId: me.id } });
        allowed = count > 0;
      }
    }
    if (!allowed) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }
  }

  const contextPayload = buildConversationContext({
    clientId,
    teamId,
    assignmentId,
    taskId,
  });

  const conv = await prisma.conversation.create({
    data: {
      type,
      title: normalizedTitle || null,
      createdBy: { connect: { id: me.id } },
      ...(contextPayload ? { conversation_field_06: contextPayload } : {}),
      participants: {
        create: uniqueMemberIds.map((uid) => ({
          userId: uid,
          role: uid === me.id ? "owner" : "member",
        })),
      },
    },
    include: {
      participants: {
        include: { user: { select: { id: true, name: true, image: true } } },
      },
    },
  });

  return NextResponse.json(applyConversationContext(conv), { status: 201 });
}

// GET /api/chat/conversations  → my list
export async function GET(req: Request) {
  const me = await getAuthUser();
  if (!me)
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const u = new URL(req.url);
  const take = Number(u.searchParams.get("take") || 30);
  const cursor = u.searchParams.get("cursor") || undefined;
  const filterType = (u.searchParams.get("type") || undefined) as
    | "dm"
    | "group"
    | "client"
    | "team"
    | "assignment"
    | "task"
    | "support"
    | undefined;
  const filterTeamId = u.searchParams.get("teamId") || undefined;

  const cps = await prisma.conversationParticipant.findMany({
    where: { userId: me.id },
    take,
    ...(cursor
      ? {
          skip: 1,
          cursor: {
            conversationId_userId: { conversationId: cursor, userId: me.id },
          },
        }
      : {}),
    select: { conversationId: true, lastReadAt: true },
    orderBy: { joinedAt: "desc" },
  });

  const convIds = cps.map((c) => c.conversationId);
  const conversationsRaw = await prisma.conversation.findMany({
    where: {
      id: { in: convIds },
      ...(filterType ? { type: filterType } : {}),
      ...(contextFilter("teamId", filterTeamId) || {}),
    },
    include: {
      participants: {
        include: { user: { select: { id: true, name: true, image: true } } },
      },
      messages: { take: 1, orderBy: { createdAt: "desc" } },
    },
  });

  const conversations = conversationsRaw.map(applyConversationContext);


  // compute unread counts for all conversations in ONE grouped query
  // (previously one COUNT per conversation, re-run on every chat event).
  // Same rules: messages after my lastReadAt, not sent by me (null senders are
  // excluded, like Prisma's `not`), not deleted.
  const unreadById = new Map<string, number>();
  const ids = conversations.map((c) => c.id);
  if (ids.length) {
    const rows = await prisma.$queryRaw<{ conversationId: string; count: number }[]>`
      SELECT m."conversationId", COUNT(*)::int AS "count"
      FROM "ChatMessage" m
      JOIN "ConversationParticipant" cp
        ON cp."conversationId" = m."conversationId" AND cp."userId" = ${me.id}
      WHERE m."conversationId" = ANY(${ids}::text[])
        AND m."createdAt" > COALESCE(cp."lastReadAt", to_timestamp(0))
        AND m."senderId" <> ${me.id}
        AND m."deletedAt" IS NULL
      GROUP BY m."conversationId"`;
    for (const r of rows) unreadById.set(r.conversationId, Number(r.count));
  }

  // compute unread and last activity time
  const withUnread = conversations.map((conv) => {
    const unreadCount = unreadById.get(conv.id) ?? 0;
    const lastMsgAt = conv.messages?.[0]?.createdAt || conv.updatedAt;
    return { ...conv, unreadCount, _lastActivityAt: lastMsgAt } as any;
  });

  // Sort by most recent activity desc
  withUnread.sort((a: any, b: any) => {
    const ta = new Date(a._lastActivityAt).getTime();
    const tb = new Date(b._lastActivityAt).getTime();
    return tb - ta;
  });

  // Strip helper field before returning
  const result = withUnread.map(({ _lastActivityAt, ...rest }: any) => rest);
  return NextResponse.json(result);
}
