import "server-only";
import type { ModuleState } from "@/lib/modules";
import { getSiteSettings } from "@/lib/settings";
import { ownKeysAllowed } from "./ownKey";
import type { AiStatus, Provider } from "./policy";
import type { ProviderInfo } from "./components/ProviderSwitch";

/** What the provider switch needs (site's Claude / free option / personal Claude), and the default choice. */
export async function providerChoices(status: AiStatus, mod: ModuleState): Promise<{ info: ProviderInfo; initial: Provider; anyAvailable: boolean }> {
  const { siteName } = await getSiteSettings();
  const info: ProviderInfo = {
    claudeAvailable: status.claude.available,
    claudeReason: status.claude.reason ?? null,
    freeAvailable: status.free.available,
    freeName: status.free.name,
    budgetUsedPct: status.claude.budget > 0 ? Math.min(100, Math.round((status.claude.spent / status.claude.budget) * 100)) : null,
    ownAllowed: ownKeysAllowed(mod) && status.access !== "NONE",
    ownAvailable: status.own.available,
    ownHint: status.own.hint,
    siteName,
  };
  // The member's personal Claude is the default whenever they added a key.
  const initial: Provider = status.own.available ? "own" : status.access === "FREE_ONLY" ? "free" : status.preferred;
  return { info, initial, anyAvailable: status.access !== "NONE" && (info.claudeAvailable || info.freeAvailable || info.ownAvailable) };
}
