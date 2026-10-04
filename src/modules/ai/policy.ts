import "server-only";
import { db } from "@/lib/db";
import { getModule, type ModuleState } from "@/lib/modules";
import { getSiteSettings } from "@/lib/settings";
import { fromLocalInput, toDateInput } from "@/lib/time";
import { aiConfigured } from "./service";
import { freeConfigured } from "./free";

// Who may use which AI provider, and how much Claude spending is left.
//
// Claude is the default for everyone, within two monthly budgets set by admins:
// one for the whole site and one per member (overridable per member). Admins can
// also restrict a member to the free provider or turn the AI off for them.

export type Provider = "claude" | "free";
export type Access = "DEFAULT" | "FREE_ONLY" | "NONE";

export async function monthStart() {
  const { timeZone } = await getSiteSettings();
  return fromLocalInput(`${toDateInput(new Date(), timeZone).slice(0, 7)}-01T00:00`, timeZone)!;
}

export async function claudeSpend(userId?: string) {
  const since = await monthStart();
  const agg = await db.aiMessage.aggregate({
    _sum: { costUsd: true },
    where: { provider: "claude", createdAt: { gte: since }, ...(userId ? { chat: { userId } } : {}) },
  });
  return agg._sum.costUsd ?? 0;
}

export async function getMemberAiSetting(userId: string) {
  return (
    (await db.aiMemberSetting.findUnique({ where: { userId } })) ?? {
      userId,
      access: "DEFAULT",
      monthlyBudgetUsd: null,
      dailyLimit: null,
      preferredProvider: "claude",
    }
  );
}

export type AiStatus = {
  access: Access;
  preferred: Provider;
  claude: { available: boolean; reason?: "disabled" | "notConfigured" | "siteBudget" | "memberBudget" | "restricted"; spent: number; budget: number };
  free: { available: boolean; name: string };
  dailyLimit: number;
  usedToday: number;
};

/** Everything the member UI and the chat endpoint need to decide on a provider. */
export async function getAiStatus(userId: string, mod?: ModuleState): Promise<AiStatus> {
  const m = mod ?? (await getModule("ai"));
  const s = m.settings;
  const setting = await getMemberAiSetting(userId);
  const access = setting.access as Access;
  const [siteSpent, memberSpent, usedToday] = await Promise.all([
    claudeSpend(),
    claudeSpend(userId),
    db.aiMessage.count({ where: { role: "user", chat: { userId }, createdAt: { gte: new Date(Date.now() - 86_400_000) } } }),
  ]);
  const memberBudget = setting.monthlyBudgetUsd ?? Number(s.memberMonthlyBudgetUsd);

  let reason: AiStatus["claude"]["reason"];
  if (access !== "DEFAULT") reason = "restricted";
  else if (!s.claudeEnabled) reason = "disabled";
  else if (!aiConfigured()) reason = "notConfigured";
  else if (siteSpent >= Number(s.monthlyBudgetUsd)) reason = "siteBudget";
  else if (memberSpent >= memberBudget) reason = "memberBudget";

  return {
    access,
    preferred: setting.preferredProvider === "free" ? "free" : "claude",
    claude: { available: !reason, reason, spent: memberSpent, budget: memberBudget },
    free: { available: access !== "NONE" && Boolean(s.freeEnabled) && freeConfigured(String(s.freeBaseUrl)), name: String(s.freeProviderName) },
    dailyLimit: setting.dailyLimit ?? Number(s.dailyQuestionLimit),
    usedToday,
  };
}

/**
 * Picks the provider for a question. Returns the provider and whether we switched to
 * the free one because Claude wasn't available, or an error code.
 */
export function resolveProvider(status: AiStatus, requested: Provider, autoFallback: boolean):
  | { provider: Provider; switched: boolean }
  | { error: string } {
  if (status.access === "NONE") return { error: "blocked" };
  if (status.usedToday >= status.dailyLimit) return { error: "limit" };
  if (requested === "claude" && status.claude.available) return { provider: "claude", switched: false };
  if (status.free.available && (requested === "free" || autoFallback || status.access === "FREE_ONLY")) {
    return { provider: "free", switched: requested === "claude" };
  }
  if (requested === "free") return { error: "freeUnavailable" };
  return { error: status.claude.reason === "notConfigured" ? "notConfigured" : status.claude.reason === "siteBudget" || status.claude.reason === "memberBudget" ? "budget" : "claudeUnavailable" };
}
