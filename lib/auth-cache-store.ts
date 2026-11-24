// lib/auth-cache-store.ts
// Storage for lib/auth-cache.ts, kept free of imports so lib/prisma.ts can
// clear it (on user / role / permission writes) without a circular import.

export const authUserCache = new Map<string, { at: number; value: Promise<any> }>();

/** Call after changing users, roles or role permissions. */
export function invalidateAuthCache(userId?: string) {
  if (userId) authUserCache.delete(userId);
  else authUserCache.clear();
}
