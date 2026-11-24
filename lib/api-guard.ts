// lib/api-guard.ts
// Server-side access checks for API route handlers.
//
//   const access = await requireAccess({ permissions: ["view_user_management"] });
//   if (access instanceof NextResponse) return access;
//   const me = access; // the acting user (impersonation-aware)
//
// Rules: the caller must be signed in. If `roles` / `permissions` are given,
// the caller passes when their role is listed OR they hold any listed
// permission. Admins always pass. These mirror the permissions the sidebar
// uses to show each screen, so anyone who can open a screen can still use it.
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/getAuthUser";

export type AccessRule = {
  roles?: string[];
  permissions?: string[];
};

export type AuthedUser = {
  id: string;
  role: string | null;
  roleId: string | null;
  clientId: string | null;
  permissions: string[];
  [key: string]: any;
};

export const STAFF_ROLES = ["admin", "manager", "agent", "qc", "am", "am_ceo", "data_entry"];

export function hasAccess(user: AuthedUser, rule: AccessRule = {}): boolean {
  const role = String(user.role ?? "").toLowerCase();
  if (role === "admin") return true;
  const { roles, permissions } = rule;
  if (!roles?.length && !permissions?.length) return true;
  if (roles?.some((r) => r.toLowerCase() === role)) return true;
  const perms = user.permissions ?? [];
  return !!permissions?.some((p) => perms.includes(p));
}

export async function requireAccess(rule: AccessRule = {}): Promise<AuthedUser | NextResponse> {
  const user = (await getAuthUser()) as AuthedUser | null;
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasAccess(user, rule)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return user;
}

export function isStaff(user: { role?: string | null } | null | undefined) {
  return STAFF_ROLES.includes(String(user?.role ?? "").toLowerCase());
}

/** Any signed-in staff member (everyone except client / plain user accounts). */
export function requireStaff() {
  return requireAccess({ roles: STAFF_ROLES });
}
