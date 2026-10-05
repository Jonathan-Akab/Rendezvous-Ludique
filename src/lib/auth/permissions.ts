// Granular staff access. Every section of the admin console is a permission; each admin or
// moderator gets the ones they need. A "full admin" (role ADMIN with no list) has them all
// and is the only one who can give rights to others.

export const PERMISSIONS = [
  "registrations", // approve or refuse sign-ups
  "members", // manage member accounts (not other staff)
  "games", // edit the Ludothèque (incl. completing it with the AI)
  "events",
  "libraries",
  "plays",
  "bazaar",
  "facebook",
  "faq",
  "suggestions",
  "ai",
  "modules",
  "appearance",
  "settings",
  "audit",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

type StaffUser = { role: string; permissions: string | null };

function parse(list: string | null): Permission[] {
  if (!list) return [];
  try {
    const arr = JSON.parse(list);
    return Array.isArray(arr) ? arr.filter((p): p is Permission => (PERMISSIONS as readonly string[]).includes(p)) : [];
  } catch {
    return [];
  }
}

/** An admin with no restriction: every section, and managing staff and their rights. */
export function isFullAdmin(user: StaffUser) {
  return user.role === "ADMIN" && user.permissions == null;
}

/** The console sections this person may use. Members have none. */
export function permissionsOf(user: StaffUser): Set<Permission> {
  if (isFullAdmin(user)) return new Set(PERMISSIONS);
  if (user.role !== "ADMIN" && user.role !== "MODERATOR") return new Set();
  return new Set(parse(user.permissions));
}

export function can(user: StaffUser, permission: Permission) {
  return permissionsOf(user).has(permission);
}

/** Has access to at least one section of the admin console. */
export function isStaff(user: StaffUser) {
  return permissionsOf(user).size > 0;
}

/** Stored form of a permission list ("null" = full admin, only for admins). */
export function serializePermissions(role: string, fullAdmin: boolean, list: string[]) {
  if (role === "ADMIN" && fullAdmin) return null;
  if (role === "MEMBER") return null;
  return JSON.stringify(PERMISSIONS.filter((p) => list.includes(p)));
}
