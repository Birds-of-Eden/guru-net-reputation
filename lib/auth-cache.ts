// lib/auth-cache.ts
// Short-lived in-process cache for "user + role + permissions".
//
// Every authenticated request used to run this 4-table join twice (once in the
// NextAuth session callback, once in getAuthUser). Caching it for a few seconds
// removes almost all of that load. Any write to users, roles or role
// permissions clears the cache (see lib/prisma.ts), so changes apply at once.
import prisma from "@/lib/prisma";
import { authUserCache, invalidateAuthCache } from "@/lib/auth-cache-store";

export { invalidateAuthCache };

const TTL_MS = 15_000;
const MAX_ENTRIES = 5_000;

function loadUser(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: {
      role: {
        include: { rolePermissions: { include: { permission: true } } },
      },
    },
  });
}

type AuthUserRow = Awaited<ReturnType<typeof loadUser>>;

/** User with role + permissions, cached for a few seconds per user. */
export function getCachedAuthUser(userId: string): Promise<AuthUserRow> {
  const now = Date.now();
  const hit = authUserCache.get(userId);
  if (hit && now - hit.at < TTL_MS) return hit.value;

  if (authUserCache.size >= MAX_ENTRIES) authUserCache.clear();
  const value = loadUser(userId);
  authUserCache.set(userId, { at: now, value });
  // Never cache failures
  value.catch(() => {
    if (authUserCache.get(userId)?.value === value) authUserCache.delete(userId);
  });
  return value;
}

/** Permission ids for a cached user row (same shape the session exposes). */
export function permissionIdsOf(user: AuthUserRow): string[] {
  return user?.role?.rolePermissions.map((rp) => rp.permission.id) ?? [];
}
