import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser } from "./session";
import type { Role } from "@/lib/constants";

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
