import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";

// One-time links sent by email. The raw token only travels in the email; we keep its hash.

export type TokenKind = "verify" | "reset";
const TTL: Record<TokenKind, number> = { verify: 48 * 3600_000, reset: 3600_000 };

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

/** Creates a new link token for this person (older unused ones of the same kind stop working). */
export async function createEmailToken(userId: string, kind: TokenKind) {
  const token = randomBytes(32).toString("base64url");
  await db.emailToken.deleteMany({ where: { userId, kind, usedAt: null } });
  await db.emailToken.create({ data: { userId, kind, tokenHash: hash(token), expiresAt: new Date(Date.now() + TTL[kind]) } });
  return token;
}

/** The token's owner if the link is valid (not expired, not used). Doesn't use it up. */
export async function checkEmailToken(token: string, kind: TokenKind) {
  if (!token) return null;
  const row = await db.emailToken.findUnique({ where: { tokenHash: hash(token) } });
  if (!row || row.kind !== kind || row.usedAt || row.expiresAt < new Date()) return null;
  return row;
}

/** Uses the token up. Returns its owner's id, or null when invalid. */
export async function consumeEmailToken(token: string, kind: TokenKind) {
  const row = await checkEmailToken(token, kind);
  if (!row) return null;
  const done = await db.emailToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
  return done.count ? row.userId : null;
}

/** Whoever a link was made for, even when it's used up or expired (to say "already confirmed"). */
export async function emailTokenOwner(token: string, kind: TokenKind) {
  if (!token) return null;
  const row = await db.emailToken.findUnique({ where: { tokenHash: hash(token) }, select: { kind: true, userId: true } });
  return row?.kind === kind ? row.userId : null;
}
