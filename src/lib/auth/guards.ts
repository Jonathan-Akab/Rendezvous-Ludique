import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser } from "./session";
import type { Role } from "@/lib/constants";
import { can, isFullAdmin, isStaff, type Permission } from "./permissions";

const RANK: Record<Role, number> = { MEMBER: 0, MODERATOR: 1, ADMIN: 2 };

export function hasRole(role: string, min: Role) {
  return (RANK[role as Role] ?? -1) >= RANK[min];
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  return user;
}

export async function requireRole(min: Role) {
  const user = await requireUser();
  if (!hasRole(user.role, min)) redirect("/home");
  return user;
}

/** Pages and actions of the admin console: the person needs this section's permission. */
export async function requirePermission(permission: Permission) {
  const user = await requireUser();
  if (!can(user, permission)) redirect("/home");
  return user;
}

/** The admin console itself: any staff permission. */
export async function requireStaff() {
  const user = await requireUser();
  if (!isStaff(user)) redirect("/home");
  return user;
}

/** Managing staff and rights: full admins only. */
export async function requireFullAdmin() {
  const user = await requireUser();
  if (!isFullAdmin(user)) redirect("/home");
  return user;
}
