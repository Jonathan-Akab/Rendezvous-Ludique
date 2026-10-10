import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/constants";

const SESSION_DAYS = 30;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/**
 * "Secure" cookies only travel over HTTPS. Marking one Secure on a site reached over plain HTTP
 * signs people out after their first page (Chrome refuses the cookie; Safari and every iPhone /
 * iPad browser keep it but never send it back). So it follows the request's actual protocol;
 * COOKIE_SECURE="false" can still turn it off, but "true" can't force it on plain HTTP.
 */
async function secureCookies() {
  if (process.env.COOKIE_SECURE === "false") return false;
  const h = await headers();
  // set by Next's server, or by a reverse proxy (Caddy, nginx…) that terminates HTTPS
  const proto = h.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  if (proto) return proto === "https";
  return (h.get("origin") ?? process.env.APP_URL ?? "").startsWith("https://");
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const userAgent = (await headers()).get("user-agent")?.slice(0, 250) ?? null;
  await db.session.create({ data: { id: hashToken(token), userId, expiresAt, userAgent } });
  await db.user.update({ where: { id: userId }, data: { lastSeenAt: new Date() } });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: await secureCookies(),
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { id: hashToken(token) } });
  jar.delete(SESSION_COOKIE);
}

/** The signed-in member (without password hash), or null. Cached per request. */
export const getCurrentUser = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({ where: { id: hashToken(token) }, include: { user: true } });
  if (!session || session.expiresAt < new Date() || session.user.status !== "ACTIVE") return null;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, ...user } = session.user;
  return user;
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;
