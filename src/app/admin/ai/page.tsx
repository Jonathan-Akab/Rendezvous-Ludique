import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Gift, Settings2, Sparkles } from "lucide-react";
import { db } from "@/lib/db";
import { getModule } from "@/lib/modules";
import { ilike } from "@/lib/search";
import { ActionForm } from "@/components/ActionForm";
import { MeepleAvatar } from "@/components/Meeple";
import { AdminHeader, AdminTable, SearchBar, Td } from "@/modules/admin/components/AdminUi";
import { saveAiLimitsAction, setMemberAiAction } from "@/modules/admin/actions";
import { aiConfigured } from "@/modules/ai/service";
import { freeConfigured } from "@/modules/ai/free";
import { claudeSpend, monthStart } from "@/modules/ai/policy";

export async function generateMetadata() {
  return { title: (await getTranslations("admin.nav"))("ai") };
}

const usd = (n: number) => `${n.toFixed(2)} $`;

export default async function AdminAiPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const [{ q }, mod, t] = await Promise.all([searchParams, getModule("ai"), getTranslations("admin.ai")]);
  const s = mod.settings;
  const since = await monthStart();

  const [siteSpent, monthMessages, members] = await Promise.all([
    claudeSpend(),
    db.aiMessage.findMany({
      where: { role: "assistant", createdAt: { gte: since } },
      select: { provider: true, costUsd: true, chat: { select: { userId: true } } },
    }),
    db.user.findMany({
      where: q ? { OR: [{ displayName: ilike(q) }, { username: ilike(q) }, { email: ilike(q) }] } : {},
      select: { id: true, displayName: true, username: true, meepleColor: true, aiSetting: true },
      orderBy: { displayName: "asc" },
      take: 300,
    }),
  ]);

  const perMember = new Map<string, { spent: number; claude: number; free: number }>();
  let claudeCount = 0;
  let freeCount = 0;
  for (const m of monthMessages) {
    const cur = perMember.get(m.chat.userId) ?? { spent: 0, claude: 0, free: 0 };
    if (m.provider === "free") {
      cur.free++;
      freeCount++;
    } else {
      cur.claude++;
      cur.spent += m.costUsd;
      claudeCount++;
    }
    perMember.set(m.chat.userId, cur);
  }
  const siteBudget = Number(s.monthlyBudgetUsd);
  const pct = siteBudget > 0 ? Math.min(100, (siteSpent / siteBudget) * 100) : 100;
  const defaultMemberBudget = Number(s.memberMonthlyBudgetUsd);

  return (
    <div className="space-y-6">
      <AdminHeader title={t("title")} lead={t("lead")}>
        <Link href="/admin/modules" className="btn btn-secondary btn-sm">
          <Settings2 className="size-4" /> {t("allSettings")}
        </Link>
      </AdminHeader>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card card-pad space-y-3 lg:col-span-2">
          <h2 className="section-title flex items-center gap-2 text-base">
            <Sparkles className="size-5 text-accent" /> {t("claudeMonth")}
          </h2>
          <p className="font-display text-4xl font-black">
            {usd(siteSpent)} <span className="text-base font-semibold text-muted">/ {usd(siteBudget)}</span>
          </p>
          <div className="h-3 overflow-hidden rounded-full bg-surface-2">
            <div className={`h-full rounded-full ${pct >= 90 ? "bg-danger" : pct >= 70 ? "bg-[#f2b705]" : "bg-success"}`} style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-muted">{t("monthCounts", { claude: claudeCount, free: freeCount })}</p>
          <p className="text-xs text-muted">{t("budgetNote")}</p>
        </section>
        <section className="card card-pad space-y-2 text-sm">
          <h2 className="section-title text-base">{t("providers")}</h2>
          <p className={aiConfigured() ? "text-success" : "text-danger"}>
            <Sparkles className="mr-1 inline size-4" /> Claude ({String(s.model)}) — {aiConfigured() ? t("ready") : t("missingKey", { env: "ANTHROPIC_API_KEY" })}
          </p>
          <p className={freeConfigured(String(s.freeBaseUrl)) ? "text-success" : "text-danger"}>
            <Gift className="mr-1 inline size-4" /> {String(s.freeProviderName)} ({String(s.freeModel)}) —{" "}
            {freeConfigured(String(s.freeBaseUrl)) ? t("ready") : t("missingKey", { env: "FREE_AI_API_KEY" })}
          </p>
        </section>
      </div>

      <section className="card card-pad">
        <h2 className="section-title mb-4 text-base">{t("limits")}</h2>
        <ActionForm action={saveAiLimitsAction} submitLabel={t("save")}>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="monthlyBudgetUsd">
                {t("siteBudget")}
              </label>
              <input id="monthlyBudgetUsd" name="monthlyBudgetUsd" type="number" step="0.01" min={0} defaultValue={siteBudget} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="memberMonthlyBudgetUsd">
                {t("memberBudget")}
              </label>
              <input id="memberMonthlyBudgetUsd" name="memberMonthlyBudgetUsd" type="number" step="0.01" min={0} defaultValue={defaultMemberBudget} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="dailyQuestionLimit">
                {t("dailyLimit")}
              </label>
              <input id="dailyQuestionLimit" name="dailyQuestionLimit" type="number" min={1} defaultValue={Number(s.dailyQuestionLimit)} className="input" />
            </div>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="claudeEnabled" defaultChecked={Boolean(s.claudeEnabled)} className="size-4 accent-[var(--accent)]" /> {t("claudeEnabled")}
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="freeEnabled" defaultChecked={Boolean(s.freeEnabled)} className="size-4 accent-[var(--accent)]" /> {t("freeEnabled")}
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="autoFallbackToFree" defaultChecked={Boolean(s.autoFallbackToFree)} className="size-4 accent-[var(--accent)]" /> {t("autoFallback")}
            </label>
          </div>
        </ActionForm>
      </section>

      <section className="space-y-3">
        <h2 className="section-title text-base">{t("members")}</h2>
        <p className="text-xs text-muted">{t("membersHint", { budget: usd(defaultMemberBudget), limit: Number(s.dailyQuestionLimit) })}</p>
        <SearchBar placeholder={t("search")} defaultValue={q} />
        <AdminTable head={[t("member"), t("spent"), t("questions"), t("access"), t("budgetOverride"), t("dailyOverride"), ""]}>
          {members.map((m) => {
            const usage = perMember.get(m.id) ?? { spent: 0, claude: 0, free: 0 };
            const budget = m.aiSetting?.monthlyBudgetUsd ?? defaultMemberBudget;
            const formId = `ai-${m.id}`;
            return (
              <tr key={`${m.id}-${m.aiSetting?.access}-${m.aiSetting?.monthlyBudgetUsd}-${m.aiSetting?.dailyLimit}`}>
                <Td>
                  <span className="flex items-center gap-2 font-semibold">
                    <MeepleAvatar color={m.meepleColor} size={28} />
                    {m.displayName}
                  </span>
                </Td>
                <Td className={usage.spent >= budget && budget > 0 ? "font-bold text-danger" : ""}>
                  {usd(usage.spent)} <span className="text-xs text-muted">/ {usd(budget)}</span>
                </Td>
                <Td className="text-xs">{t("questionCounts", { claude: usage.claude, free: usage.free })}</Td>
                <Td>
                  <select form={formId} name="access" defaultValue={m.aiSetting?.access ?? "DEFAULT"} className="select w-auto py-1 text-xs" aria-label={t("access")}>
                    {(["DEFAULT", "FREE_ONLY", "NONE"] as const).map((a) => (
                      <option key={a} value={a}>
                        {t(`accessLevels.${a}`)}
                      </option>
                    ))}
                  </select>
                </Td>
                <Td>
                  <input form={formId} name="monthlyBudgetUsd" type="number" step="0.01" min={0} defaultValue={m.aiSetting?.monthlyBudgetUsd ?? ""} placeholder={String(defaultMemberBudget)} className="input w-24 py-1 text-xs" aria-label={t("budgetOverride")} />
                </Td>
                <Td>
                  <input form={formId} name="dailyLimit" type="number" min={0} defaultValue={m.aiSetting?.dailyLimit ?? ""} placeholder={String(s.dailyQuestionLimit)} className="input w-20 py-1 text-xs" aria-label={t("dailyOverride")} />
                </Td>
                <Td>
                  <form id={formId} action={setMemberAiAction.bind(null, m.id)}>
                    <button className="btn btn-secondary btn-sm">{t("saveRow")}</button>
                  </form>
                </Td>
              </tr>
            );
          })}
        </AdminTable>
      </section>
    </div>
  );
}
