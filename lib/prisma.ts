// lib/prisma.ts

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { realtime } from "./realtime/server";

// ---------- Realtime fan-out for notifications / new conversations ----------
// Events are derived from query args (not results) so batch $transaction([...])
// keeps working, and are slightly delayed + coalesced so the DB write is
// committed before clients refetch.
const pendingNotifUsers = new Set<string>();
let notifTimer: ReturnType<typeof setTimeout> | null = null;

function queueNotificationChanged(userIds: string[]) {
  userIds.forEach((id) => id && pendingNotifUsers.add(id));
  if (notifTimer) return;
  notifTimer = setTimeout(() => {
    notifTimer = null;
    const ids = Array.from(pendingNotifUsers);
    pendingNotifUsers.clear();
    // AMs see their agents' notifications, so they get a ping too
    void realtime.trigger(
      [...ids.map((id) => `user-${id}`), "role-am"],
      "notification:changed",
      {}
    );
  }, 300);
}

function userIdsFromData(data: any): string[] {
  const list = Array.isArray(data) ? data : [data];
  return list
    .map((d) => (typeof d?.userId === "string" ? d.userId : d?.user?.connect?.id))
    .filter((id): id is string => typeof id === "string");
}

function userIdsFromWhere(where: any): string[] {
  const u = where?.userId;
  if (typeof u === "string") return [u];
  if (typeof u?.equals === "string") return [u.equals];
  if (Array.isArray(u?.in)) return u.in.filter((x: unknown) => typeof x === "string");
  return [];
}

function participantIdsFromConversation(data: any): string[] {
  const p = data?.participants;
  if (!p) return [];
  return [...userIdsFromData(p.create ?? []), ...userIdsFromData(p.createMany?.data ?? [])];
}

function queueChatChanged(userIds: string[]) {
  if (!userIds.length) return;
  setTimeout(() => {
    void realtime.trigger(
      Array.from(new Set(userIds)).map((id) => `user-${id}`),
      "chat:changed",
      {}
    );
  }, 300);
}

const prismaClientSingleton = () => {
  const pool =
    globalForPrisma.pgPool ??
    new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    // ✅ Connection pool configuration for better performance
  });
};

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientSingleton | undefined;
  pgPool: Pool | undefined;
};

// ✅ Connection pooling optimization
const prismaBase = globalForPrisma.prisma ?? prismaClientSingleton();

// ✅ Optimized Middleware: Cache roles to avoid repeated DB queries
const roleCache = new Map<string, string>();
let roleCacheInitialized = false;

// Initialize role cache on first use
async function initRoleCache() {
  if (roleCacheInitialized) return;
  const roles = await prismaBase.role.findMany({ select: { id: true, name: true } });
  roles.forEach(r => roleCache.set(r.name, r.id));
  roleCacheInitialized = true;
}

// ✅ Prisma v6: use $extends query hook instead of $use middleware
const prisma = prismaBase.$extends({
  query: {
    user: {
      async create({ args, query }) {
        const data = args.data as any;
        if (data?.role && typeof data.role === "string") {
          const roleName = data.role;
          delete data.role;

          // Initialize cache if needed
          await initRoleCache();

          const roleId = roleCache.get(roleName);
          if (roleId) {
            data.role = { connect: { id: roleId } };
          } else {
            console.warn(
              `Prisma Extension: Role '${roleName}' not found in cache. User will be created without a linked role.`
            );
          }
        }
        return query(args);
      },
    },
    notification: {
      create({ args, query }) {
        queueNotificationChanged(userIdsFromData((args as any).data));
        return query(args);
      },
      createMany({ args, query }) {
        queueNotificationChanged(userIdsFromData((args as any).data));
        return query(args);
      },
      update({ args, query }) {
        queueNotificationChanged(userIdsFromWhere((args as any).where));
        return query(args);
      },
      updateMany({ args, query }) {
        queueNotificationChanged(userIdsFromWhere((args as any).where));
        return query(args);
      },
      delete({ args, query }) {
        queueNotificationChanged(userIdsFromWhere((args as any).where));
        return query(args);
      },
      deleteMany({ args, query }) {
        queueNotificationChanged(userIdsFromWhere((args as any).where));
        return query(args);
      },
    },
    conversation: {
      create({ args, query }) {
        queueChatChanged(participantIdsFromConversation((args as any).data));
        return query(args);
      },
    },
  },
});

export default prisma;

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prismaBase;
  if (!globalForPrisma.pgPool) {
    globalForPrisma.pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }
}
