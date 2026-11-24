// @ts-nocheck
// lib/getAuthUser.ts
import { cache } from "react";
import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import { getCachedAuthUser, permissionIdsOf } from "@/lib/auth-cache";
import { amScopeCheck, amCeoScopeCheck, canImpersonate } from "./impersonation";

// Memoized per request: many routes/components call this more than once.
export const getAuthUser = cache(async function getAuthUser() {
  const session = await auth();
  const baseUser = session?.user ?? null;
  if (!baseUser?.id) return null;

  // ⬇️ Dynamic API: must await
  const store = await cookies();
  const targetId = store.get("impersonation-target")?.value || null;
  const originId = store.get("impersonation-origin")?.value || null;

  // ইমপারসোনেশন অ্যাকটিভ কিনা চেক
  if (targetId && originId && originId === baseUser.id) {
    // পারমিশন ভেরিফাই (সেফটি)
    const perm = await canImpersonate(originId);
    if (!perm.ok) {
      return normalUser(baseUser); // পারমিশন নেই → ইগনোর
    }
    if (perm.roleName === "am") {
      const scope = await amScopeCheck(originId, targetId);
      if (!scope.ok) {
        return normalUser(baseUser); // স্কোপ মিলেনি → ইগনোর
      }
    }
    if (perm.roleName === "am_ceo") {
      const scope = await amCeoScopeCheck(originId, targetId);
      if (!scope.ok) {
        return normalUser(baseUser); // Scope failed
      }
    }

    // টার্গেট ইউজার ফুল ডেটা (রোল + পারমিশনসহ)
    const dbUser = await getCachedAuthUser(targetId);
    if (!dbUser) return normalUser(baseUser);

    return {
      id: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
      image: dbUser.image,
      role: dbUser.role?.name ?? null,
      roleId: dbUser.roleId ?? null,
      clientId: dbUser.clientId ?? null,
      permissions: permissionIdsOf(dbUser),
      __impersonating: true,
      __impersonatedBy: originId,
    } as any;
  }

  return normalUser(baseUser);
});

// নরমাল কেস: the session callback already loaded role, clientId and
// permissions (see lib/auth.ts), so no second database query is needed.
function normalUser(baseUser: any) {
  return {
    ...baseUser,
    role: baseUser.role ?? null,
    roleId: baseUser.roleId ?? null,
    clientId: baseUser.clientId ?? null,
    permissions: baseUser.permissions ?? [],
    __impersonating: false,
  } as any;
}
