// lib/prisma.ts

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { realtime } from "./realtime/server";
import { invalidateAuthCache } from "./auth-cache-store";
import { auditedWrite } from "./audit/server";

// Clear the short-lived auth cache (lib/auth-cache.ts) when users, roles or
// permissions change. Done now and again shortly after, so a request that reads
// between "invalidate" and "commit" cannot keep stale permissions cached.
// (No await on the query: keeps batch $transaction([...]) working.)
function authDataChanged() {
  invalidateAuthCache();
  setTimeout(() => invalidateAuthCache(), 1000);
}

const WRITE_OPS = new Set([
  "create",
  "createMany",
  "createManyAndReturn",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "upsert",
  "delete",
  "deleteMany",
]);

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

// ---------- Realtime: task changes ----------
// Any task write pings staff role channels (+ the assigned agent when known),
// coalesced to at most one event per second. Browsers refresh their task lists
// on this event (components/realtime/RealtimeBridge.tsx), which replaces the
// old 10-second polling.
const TASK_EVENT_ROLES = ["admin", "manager", "qc", "am", "am_ceo", "data_entry", "agent"];
const pendingTaskUsers = new Set<string>();
let taskTimer: ReturnType<typeof setTimeout> | null = null;

function assigneeIdsFrom(args: any): string[] {
  const out: string[] = [];
  const push = (v: any) => {
    if (typeof v === "string") out.push(v);
    else if (typeof v?.connect?.id === "string") out.push(v.connect.id);
  };
  const datas = Array.isArray(args?.data) ? args.data : [args?.data, args?.create, args?.update];
  for (const d of datas) {
    push(d?.assignedToId);
    push(d?.assignedTo);
  }
  push(args?.where?.assignedToId);
  return out;
}

function queueTaskChanged(args: any) {
  assigneeIdsFrom(args).forEach((id) => pendingTaskUsers.add(id));
  if (taskTimer) return;
  taskTimer = setTimeout(() => {
    taskTimer = null;
    const ids = Array.from(pendingTaskUsers);
    pendingTaskUsers.clear();
    void realtime.trigger(
      [...TASK_EVENT_ROLES.map((r) => `role-${r}`), ...ids.map((id) => `user-${id}`)],
      "task:changed",
      {}
    );
  }, 1000);
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

function isOnlyLastSeen(data: any) {
  if (!data || typeof data !== "object") return false;
  const keys = Object.keys(data);
  return keys.length > 0 && keys.every((k) => k === "lastSeenAt" || k === "updatedAt");
}

const prismaClientSingleton = () => {
  const pool =
    globalForPrisma.pgPool ??
    new Pool({
      connectionString: process.env.DATABASE_URL,
      // pg defaults to 10; parallel route queries + realtime refetches exceed that.
      // Override with DATABASE_POOL_MAX if the database allows fewer connections.
      max: Number(process.env.DATABASE_POOL_MAX) || 20,
      idleTimeoutMillis: 30_000,
    });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    // Never return password hashes from any query (API responses used to leak
    // them via `include: { assignedTo: true }` etc.). The login check opts back
    // in explicitly with `omit: { passwordHash: false }` (see lib/auth.ts).
    omit: {
      user: { passwordHash: true },
      account: { password: true },
    },
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
    task: {
      $allOperations({ operation, args, query }) {
        if (WRITE_OPS.has(operation)) queueTaskChanged(args);
        return query(args);
      },
    },
    role: {
      $allOperations({ operation, args, query }) {
        if (WRITE_OPS.has(operation)) authDataChanged();
        return query(args);
      },
    },
    permission: {
      $allOperations({ operation, args, query }) {
        if (WRITE_OPS.has(operation)) authDataChanged();
        return query(args);
      },
    },
    rolePermission: {
      $allOperations({ operation, args, query }) {
        if (WRITE_OPS.has(operation)) authDataChanged();
        return query(args);
      },
    },
    user: {
      update({ args, query }) {
        // Skip high-frequency presence writes; everything else may change role/client link
        if (!isOnlyLastSeen((args as any).data)) authDataChanged();
        return query(args);
      },
      updateMany({ args, query }) {
        if (!isOnlyLastSeen((args as any).data)) authDataChanged();
        return query(args);
      },
      upsert({ args, query }) {
        authDataChanged();
        return query(args);
      },
      delete({ args, query }) {
        authDataChanged();
        return query(args);
      },
      deleteMany({ args, query }) {
        authDataChanged();
        return query(args);
      },
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
})
  // ✅ System-wide audit trail: every create / update / delete on every audited
  // model is written to ActivityLog with before/after values and a diff
  // (lib/audit/server.ts). Snapshots are read and logs written with the raw
  // client, so logging never recurses and never changes the query result.
  // NOTE: the hook awaits a snapshot read before the write, so audited models
  // must be used in interactive `$transaction(async tx => …)`, not batch arrays.
  .$extends({
    name: "audit-trail",
    query: {
      $allModels: {
        $allOperations(params) {
          return auditedWrite(prismaBase, params as any);
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
