import Link from "next/link";
import { requirePermission } from "@/lib/auth/guards";
import { getTranslations } from "next-intl/server";
import { BadgeCheck, EyeOff } from "lucide-react";
import { db } from "@/lib/db";
import { FAQ_STATUSES } from "@/lib/constants";
import { ActionForm } from "@/components/ActionForm";
import { ConfirmButton } from "@/components/forms";
import { AdminHeader } from "@/modules/admin/components/AdminUi";
import { deleteFaqAction, saveFaqAction } from "@/modules/ai/actions";
import type { Prisma } from "@/generated/prisma/client";

export async function generateMetadata() {
  return { title: (await getTranslations("admin.nav"))("faq") };
}

type Search = { game?: string; status?: string };

async function Fields({ entry }: { entry?: { question: string; answer: string; status: string } }) {
  const t = await getTranslations("admin.faq");
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
        <div>
          <label className="label">{t("question")}</label>
          <input name="question" defaultValue={entry?.question} className="input" required maxLength={500} />
        </div>
        <div>
          <label className="label">{t("status")}</label>
          <select name="status" defaultValue={entry?.status ?? "VERIFIED"} className="select">
            {FAQ_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`statuses.${s}`)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="label">{t("answer")}</label>
        <textarea name="answer" defaultValue={entry?.answer} className="textarea min-h-40 font-mono text-xs" required maxLength={20000} />
      </div>
    </>
  );
}

export default async function AdminFaqPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requirePermission("faq");
  const [sp, t] = await Promise.all([searchParams, getTranslations("admin.faq")]);
  const status = FAQ_STATUSES.includes(sp.status as never) ? sp.status : undefined;
  const where: Prisma.RuleFaqWhereInput = { ...(sp.game ? { gameId: sp.game } : {}), ...(status ? { status } : {}) };

  const [entries, games, allGames, total] = await Promise.all([
    db.ruleFaq.findMany({ where, include: { game: { select: { name: true } } }, orderBy: [{ askCount: "desc" }, { updatedAt: "desc" }], take: 300 }),
    db.ruleFaq.groupBy({ by: ["gameId"], _count: { _all: true } }),
    db.game.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.ruleFaq.count(),
  ]);
  const name = new Map(allGames.map((g) => [g.id, g.name]));
  const href = (next: Search) => {
    const q = new URLSearchParams();
    const m = { game: sp.game, status, ...next };
    if (m.game) q.set("game", m.game);
    if (m.status) q.set("status", m.status);
    return `/admin/faq${q.size ? `?${q}` : ""}`;
  };

  return (
    <div className="max-w-4xl space-y-6">
      <AdminHeader title={t("title")} lead={t("lead", { count: total })} />

      <details className="card">
        <summary className="cursor-pointer p-4 font-semibold">{t("add")}</summary>
        <div className="border-t border-line p-4">
          <ActionForm action={saveFaqAction.bind(null, null)} submitLabel={t("create")}>
            <div>
              <label className="label">{t("game")}</label>
              <select name="gameId" className="select" required defaultValue={sp.game ?? ""}>
                <option value="" disabled>
                  —
                </option>
                {allGames.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
            <Fields />
          </ActionForm>
        </div>
      </details>

      <div className="flex flex-wrap items-center gap-2">
        <Link href={href({ game: undefined })} className={`chip px-3 py-1 text-xs ${!sp.game ? "chip-accent" : ""}`}>
          {t("allGames")}
        </Link>
        {games
          .sort((a, b) => (name.get(a.gameId) ?? "").localeCompare(name.get(b.gameId) ?? ""))
          .map((g) => (
            <Link key={g.gameId} href={href({ game: g.gameId })} className={`chip px-3 py-1 text-xs ${sp.game === g.gameId ? "chip-accent" : ""}`}>
              {name.get(g.gameId)} ({g._count._all})
            </Link>
          ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href={href({ status: undefined })} className={`chip px-3 py-1 text-xs ${!status ? "chip-accent" : ""}`}>
          {t("allStatuses")}
        </Link>
        {FAQ_STATUSES.map((s) => (
          <Link key={s} href={href({ status: s })} className={`chip px-3 py-1 text-xs ${status === s ? "chip-accent" : ""}`}>
            {t(`statuses.${s}`)}
          </Link>
        ))}
      </div>

      {entries.length === 0 ? (
        <p className="card card-pad text-muted">{t("empty")}</p>
      ) : (
        <div className="space-y-2">
          {entries.map((e) => (
            <details key={e.id} className="card">
              <summary className="flex cursor-pointer flex-wrap items-center gap-3 p-4">
                {e.status === "VERIFIED" ? <BadgeCheck className="size-4 text-accent" /> : e.status === "HIDDEN" ? <EyeOff className="size-4 text-muted" /> : null}
                <span className={`min-w-0 flex-1 font-semibold ${e.status === "HIDDEN" ? "text-muted line-through" : ""}`}>{e.question}</span>
                <span className="chip text-[11px]">{e.game.name}</span>
                <span className="text-xs text-muted">{t("asked", { count: e.askCount })}</span>
              </summary>
              <div className="space-y-4 border-t border-line p-4">
                <p className="text-xs text-muted">{t("source", { provider: t(`providers.${e.provider ?? "manual"}`) })}</p>
                <ActionForm action={saveFaqAction.bind(null, e.id)} submitLabel={t("save")}>
                  <Fields entry={e} />
                </ActionForm>
                <form action={deleteFaqAction.bind(null, e.id)} className="flex justify-end border-t border-line pt-4">
                  <ConfirmButton message={t("deleteConfirm")}>{t("delete")}</ConfirmButton>
                </form>
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
