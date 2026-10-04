import "server-only";
import { db } from "@/lib/db";

export async function audit(actorId: string | null, action: string, target?: string, details?: unknown) {
  await db.auditLog.create({
    data: { actorId, action, target, details: details === undefined ? null : JSON.stringify(details) },
  });
}
