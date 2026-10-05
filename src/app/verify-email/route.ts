import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { createSession } from "@/lib/auth/session";
import { consumeEmailToken } from "@/lib/auth/emailTokens";
import { appUrl } from "@/lib/mail";

// The link in the "confirm your email" message: confirms the address and signs the person in.
export async function GET(req: Request) {
  const url = new URL(req.url);
  // back to the site's public address (the same one as in the email)
  const to = (path: string) => NextResponse.redirect(new URL(path, appUrl()));
  const userId = await consumeEmailToken(url.searchParams.get("token") ?? "", "verify");
  if (!userId) return to("/?verify=invalid");
  const user = await db.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
  await audit(userId, "user.verifyEmail", user.username);
  // Still waiting for a team member's approval: confirmed, but not signed in yet.
  if (user.status !== "ACTIVE") return to("/?pending=1&verified=1");
  await createSession(userId);
  return to("/home?verified=1");
}
