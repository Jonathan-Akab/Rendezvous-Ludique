import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft, Baby, BookOpen, Clock, Gauge, LibraryBig, Puzzle, Sparkles, Users } from "lucide-react";
import { FadeIn } from "@/components/Motion";
import { ActionForm } from "@/components/ActionForm";
import { LIBRARY_GAME_STATUSES } from "@/lib/constants";
import { GameCover } from "@/modules/games/components/GameCover";
import { MeepleRating } from "@/modules/games/components/MeepleRating";
import { DemoRulebook } from "@/modules/demo/components/DemoRulebook";
import { demoAddToKallaxAction } from "@/modules/demo/actions";
import { demoGame, demoGameExtras } from "@/modules/demo/data";

/** A demo Ludothèque entry: the real page's sections, with made-up content. */
export default async function DemoGamePage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, t, tg, tk, format, locale] = await Promise.all([params, getTranslations("demo"), getTranslations("games"), getTranslations("kallax"), getFormatter(), getLocale()]);
  const found = demoGame(locale === "en" ? "en" : "fr", id);
  if (!found) notFound();
  const { info: g, shelf, description, mine, owners } = found;
  const extra = demoGameExtras(id);
  const maxBar = Math.max(1, ...extra.distribution);
  const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
  const facts = [
    { icon: Users, label: tg("facts.players"), value: g.min === g.max ? `${g.min}` : `${g.min}–${g.max}` },
    { icon: Clock, label: tg("facts.time"), value: `${g.time} min` },
    { icon: Baby, label: tg("facts.age"), value: `${g.age}+` },
    { icon: Gauge, label: tg("facts.weight"), value: `${g.weight.toFixed(1)} / 5` },
  ];

  return (
    <div className="space-y-8">
      <Link href={mine ? "/demo/kallax" : "/demo/games"} className="inline-flex items-center gap-1 text-sm text-muted hover:text-accent">
        <ArrowLeft className="size-4" /> {mine ? t("nav.kallax") : t("nav.games")}
      </Link>

      <FadeIn className="relative overflow-hidden rounded-3xl border border-line">
        <div className="absolute inset-0 -z-10 scale-125 opacity-50 blur-3xl">
          <GameCover name={g.name} src={null} size="fill" className="!aspect-auto h-full" />
        </div>
        <div className="glass flex flex-col gap-6 p-6 sm:flex-row sm:p-8">
          <div className="group mx-auto sm:mx-0">
            <GameCover name={g.name} src={null} size="xl" tilt />
          </div>
          <div className="min-w-0 flex-1 space-y-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">{tg("ludo")}</p>
              <h1 className="page-title">{g.name}</h1>
              <p className="text-muted">{[g.year, extra.designer, extra.publisher].join(" · ")}</p>
            </div>
            {shelf.expansions && shelf.expansions.length > 0 && (
              <div className="space-y-2">
                <p className="label flex items-center gap-1.5">
                  <Puzzle className="size-3.5 text-[#3b82f6]" /> {tk("expansions.title", { count: shelf.expansions.length })}
                </p>
                <ul className="flex flex-wrap gap-2">
                  {shelf.expansions.map((x) => (
                    <li key={x} className="flex items-center gap-2 rounded-xl border border-line bg-surface/70 px-2 py-1 text-sm">
                      <GameCover name={x} src={null} size="xs" />
                      {x}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {facts.map((f) => (
                <span key={f.label} className="flex items-center gap-2 rounded-xl border border-line bg-surface/70 px-3 py-1.5 text-sm">
                  <f.icon className="size-4 text-accent" aria-hidden />
                  <span className="text-muted">{f.label}</span>
                  <b>{f.value}</b>
                </span>
              ))}
            </div>
            <div className="grid gap-4 rounded-2xl bg-surface/60 p-4 sm:grid-cols-[auto_1fr]">
              <MeepleRating avg={shelf.rating?.avg ?? null} count={shelf.rating?.count ?? 0} label={tg("rating.count", { count: shelf.rating?.count ?? 0 })} />
              <div className="flex h-14 items-end gap-1" aria-hidden>
                {extra.distribution.map((n, i) => (
                  <div key={i} className="flex flex-1 flex-col items-center gap-0.5">
                    <div className="w-full rounded-t bg-accent/80" style={{ height: `${(n / maxBar) * 40 + 2}px` }} />
                    <span className="text-[9px] text-muted">{i + 1}</span>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-sm text-muted">{tg("kallax.stats", { kallax: owners, plays: extra.plays })}</p>
            <p className="leading-relaxed">{description}</p>
          </div>
        </div>
      </FadeIn>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <section className="card card-pad space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="section-title flex items-center gap-2">
              <BookOpen className="size-5 text-accent" /> {tg("rulebooks.title")}
            </h2>
            <Link href="/demo/ai" className="btn btn-secondary btn-sm">
              <Sparkles className="size-4" /> {tg("rulebooks.ask")}
            </Link>
          </div>
          <ul className="divide-y divide-line">
            {extra.rulebooks.map((rb) => (
              <li key={rb.id} className="flex flex-wrap items-center gap-3 py-2">
                <span className="grid size-10 place-items-center rounded-lg bg-danger/10 text-xs font-black text-danger">PDF</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{rb.title}</p>
                  <p className="text-xs text-muted">
                    {rb.language.toUpperCase()} · {rb.by} · {format.dateTime(daysAgo(rb.days), { dateStyle: "medium" })}
                  </p>
                </div>
                <DemoRulebook title={`${g.name} — ${rb.title}`} label={tg("rulebooks.open")} />
              </li>
            ))}
          </ul>
        </section>

        <aside className="card card-pad space-y-3">
          <h2 className="section-title flex items-center gap-2 text-base">
            <LibraryBig className="size-5 text-accent" /> {tg("kallax.title")}
          </h2>
          {mine ? (
            <Link href="/demo/kallax" className="btn btn-secondary w-full">
              {tg("kallax.open")}
            </Link>
          ) : (
            <ActionForm action={demoAddToKallaxAction} submitLabel={tg("kallax.add")} className="space-y-3">
              <input type="hidden" name="name" value={g.name} />
              <select name="libraryId" className="select" aria-label={tg("kallax.which")}>
                <option>Kallax — Alex</option>
              </select>
              <select name="status" className="select" aria-label={tk("form.status")}>
                {LIBRARY_GAME_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {tk(`status.${s}`)}
                  </option>
                ))}
              </select>
            </ActionForm>
          )}
          <p className="text-xs text-muted">{tg("firstAdded", { date: format.dateTime(daysAgo(200), { dateStyle: "medium" }) })}</p>
        </aside>
      </div>
    </div>
  );
}
