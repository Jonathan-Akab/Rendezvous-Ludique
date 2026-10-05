import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Check, Plus, X } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { requireModule } from "@/lib/modules";
import { FadeIn, Stagger, StaggerItem } from "@/components/Motion";
import { Meeple } from "@/components/Meeple";
import { EmptyState } from "@/components/EmptyState";
import { getPendingPlays, getPlays, getPlayStats } from "@/modules/plays/service";
import { respondPlayAction } from "@/modules/plays/actions";
import { PlayCard } from "@/modules/plays/components/PlayCard";
import { PlayInProgress } from "@/modules/plays/components/PlayInProgress";

export async function generateMetadata() {
  return { title: (await getTranslations("nav"))("plays") };
}

export default async function PlaysPage({ searchParams }: { searchParams: Promise<{ logged?: string }> }) {
  const [user, sp, t] = await Promise.all([requireUser(), searchParams, getTranslations("plays"), requireModule("plays")]);
  const [plays, pending, stats] = await Promise.all([getPlays(user.id), getPendingPlays(user.id), getPlayStats(user.id)]);

  const tiles = [
    { label: t("stats.plays"), value: stats.total },
    { label: t("stats.games"), value: stats.distinctGames },
    { label: t("stats.wins"), value: stats.wins },
    { label: t("stats.hours"), value: stats.hours },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">{t("title")}</h1>
          <p className="text-muted">{t("lead")}</p>
        </div>
        <Link href="/plays/new" className="btn btn-primary">
          <Plus className="size-4" /> {t("log")}
        </Link>
      </div>

      {sp.logged && (
        <FadeIn className="rounded-xl bg-success/10 px-4 py-3 text-sm font-semibold text-success">{t("logged")}</FadeIn>
      )}
      <PlayInProgress userId={user.id} />

      <Stagger className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((tile) => (
          <StaggerItem key={tile.label} className="card p-4 text-center">
            <p className="font-display text-3xl font-black text-accent">{tile.value}</p>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{tile.label}</p>
          </StaggerItem>
        ))}
      </Stagger>

      {pending.length > 0 && (
        <section className="space-y-3">
          <h2 className="section-title">{t("pendingTitle")}</h2>
          <p className="text-sm text-muted">{t("pendingLead")}</p>
          <div className="grid gap-3 md:grid-cols-2">
            {pending.map((p) => (
              <PlayCard key={p.id} play={p.play} viewerId={user.id}>
                <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
                  <span className="flex-1 text-xs text-muted">{t("loggedBy", { name: p.play.createdBy.displayName })}</span>
                  <form action={respondPlayAction.bind(null, p.id, true)}>
                    <button className="btn btn-primary btn-sm">
                      <Check className="size-3.5" /> {t("addToMine")}
                    </button>
                  </form>
                  <form action={respondPlayAction.bind(null, p.id, false)}>
                    <button className="btn btn-ghost btn-sm">
                      <X className="size-3.5" /> {t("notMe")}
                    </button>
                  </form>
                </div>
              </PlayCard>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <section className="space-y-3">
          <h2 className="section-title">{t("history")}</h2>
          {plays.length === 0 ? (
            <EmptyState title={t("emptyTitle")} text={t("emptyText")}>
              <Link href="/plays/new" className="btn btn-primary">
                <Plus className="size-4" /> {t("log")}
              </Link>
            </EmptyState>
          ) : (
            <Stagger className="space-y-3">
              {plays.map((p) => (
                <StaggerItem key={p.id}>
                  <PlayCard play={p} viewerId={user.id} />
                </StaggerItem>
              ))}
            </Stagger>
          )}
        </section>
        <aside className="space-y-4">
          <div className="card card-pad">
            <h2 className="section-title mb-3 text-base">{t("stats.topGames")}</h2>
            {stats.topGames.length === 0 ? (
              <p className="text-sm text-muted">—</p>
            ) : (
              <ol className="space-y-2 text-sm">
                {stats.topGames.map(([name, count], i) => (
                  <li key={name} className="flex items-center gap-2">
                    <span className="grid size-6 place-items-center rounded-md bg-surface-2 text-xs font-bold">{i + 1}</span>
                    <span className="flex-1 truncate">{name}</span>
                    <span className="font-semibold text-accent">{count}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
          <div className="card card-pad">
            <h2 className="section-title mb-3 text-base">{t("stats.topPartners")}</h2>
            {stats.topPartners.length === 0 ? (
              <p className="text-sm text-muted">—</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {stats.topPartners.map((p) => (
                  <li key={p.username} className="flex items-center gap-2">
                    <Meeple color={p.color} size={20} />
                    <Link href={`/members/${p.username}`} className="flex-1 truncate hover:text-accent">
                      {p.name}
                    </Link>
                    <span className="font-semibold text-accent">{p.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
