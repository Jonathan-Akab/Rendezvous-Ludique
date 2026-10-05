import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { decryptSecret, secretsAvailable } from "@/lib/secrets";
import type { ModuleState } from "@/lib/modules";

// "Use my Claude credits": a member can add their own Anthropic API key. Their questions
// then go to Claude on their own account — not counted in the site's budgets or daily
// limit. The key is stored encrypted and never sent back to the browser.

export const OWN_MODELS = ["claude-sonnet-5-5", "claude-opus-5-5", "claude-haiku-4-5"] as const;
export type OwnModel = (typeof OWN_MODELS)[number];

/** Members may add their own key: allowed by admins and APP_SECRET is set. */
export function ownKeysAllowed(mod: ModuleState) {
  return mod.enabled && Boolean(mod.settings.allowOwnKeys) && secretsAvailable();
}

/** The member's decrypted key and model, or null. Server-side only. */
export async function getOwnKey(userId: string) {
  const s = await db.aiMemberSetting.findUnique({ where: { userId }, select: { ownKeyEncrypted: true, ownModel: true } });
  if (!s?.ownKeyEncrypted || !secretsAvailable()) return null;
  try {
    return { apiKey: decryptSecret(s.ownKeyEncrypted), model: (OWN_MODELS as readonly string[]).includes(s.ownModel ?? "") ? (s.ownModel as OwnModel) : OWN_MODELS[0] };
  } catch {
    return null; // APP_SECRET changed: the member has to enter the key again
  }
}

/** Checks a key with Anthropic (listing models is free). */
export async function checkAnthropicKey(apiKey: string): Promise<"ok" | "invalid" | "unreachable"> {
  try {
    await new Anthropic({ apiKey, maxRetries: 1, timeout: 15_000 }).models.list({ limit: 1 });
    return "ok";
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) return "invalid";
    return "unreachable";
  }
}

/** What the member spent on their own key this month (for their settings page). */
export async function ownSpendSince(userId: string, since: Date) {
  const [chat, other] = await Promise.all([
    db.aiMessage.aggregate({ _sum: { costUsd: true }, _count: true, where: { provider: "own", createdAt: { gte: since }, chat: { userId } } }),
    db.aiUsage.aggregate({ _sum: { costUsd: true }, _count: true, where: { provider: "own", createdAt: { gte: since }, userId } }),
  ]);
  return { usd: (chat._sum.costUsd ?? 0) + (other._sum.costUsd ?? 0), answers: chat._count + other._count };
}
