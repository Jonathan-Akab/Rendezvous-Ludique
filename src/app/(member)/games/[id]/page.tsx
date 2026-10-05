import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Baby, BookOpen, Clock, Download, Gauge, LibraryBig, Pencil, Puzzle, Users } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { can } from "@/lib/auth/permissions";
import { requireModule } from "@/lib/modules";
import { db } from "@/lib/db";
import { FadeIn } from "@/components/Motion";
import { ActionForm } from "@/components/ActionForm";
import { coverUrl, getGameDetail, getMyRatings } from "@/modules/games/service";
import { GameCover } from "@/modules/games/components/GameCover";
import { MeepleBar, MeepleRating } from "@/modules/games/components/MeepleRating";
import { addGameAction } from "@/modules/kallax/actions";
import { getMyLibraries } from "@/modules/kallax/service";
import { LIBRARY_GAME_STATUSES } from "@/lib/constants";
import { RulebookLink } from "@/modules/games/components/RulebookOverlay";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const g = await db.game.findUnique({ where: { id: (await params).id }, select: { name: true } });
  return { title: g?.name };
}

// A Ludothèque entry: read-only reference built from the members' Kallax.
export default async function LudoGamePage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, user] = await Promise.all([params, requireUser(), requireModule("games")]);
  const [detail, t, tk, format, libraries] = await Promise.all([
    getGameDetail(id),
    getTranslations("games"),
    getTranslations("kallax"),
    getFormatter(),
    getMyLibraries(user.id),
  ]);
  if (!detail) notFound();
  const { game, rating, distribution } = detail;
  const [mine, myCopy] = await Promise.all([
    getMyRatings(user.id, [game.id]),
    db.kallaxGame.findFirst({ where: { gameId: game.id, library: { members: { some: { userId: user.id, status: "ACCEPTED" } } } } }),
  ]);
  const myScore = mine.get(game.id) ?? null;
  const cover = coverUrl(game);
  const maxBar = Math.max(1, ...distribution);

  const facts = [
    game.minPlayers && { icon: Users, label: t("facts.players"), value: game.minPlayers === game.maxPlayers ? `${game.minPlayers}` : `${game.minPlayers}–${game.maxPlayers}` },
    game.playTimeMin && { icon: Clock, label: t("facts.time"), value: `${game.playTimeMin} min` },
    game.minAge && { icon: Baby, label: t("facts.age"), value: `${game.minAge}+` },
    game.weight && { icon: Gauge, label: t("facts.weight"), value: `${game.weight.toFixed(1)} / 5` },
  ].filter(Boolean) as { icon: typeof Users; label: string; value: string }[];

  return (
    <div className="space-y-8">
      <FadeIn className="relative overflow-hidden rounded-3xl border border-line">
        <div className="absolute inset-0 -z-10 scale-125 opacity-50 blur-3xl">
          <GameCover name={game.name} src={cover} size="fill" className="!aspect-auto h-full" />
        </div>
        <div className="glass flex flex-col gap-6 p-6 sm:flex-row sm:p-8">
          <div className="group mx-auto sm:mx-0">
            <GameCover name={game.name} src={cover} size="xl" tilt />
          </div>
          <div className="min-w-0 flex-1 space-y-4">
            <div>
              <p className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.2em] text-accent">
                {t("ludo")}
                {/* staff with the Ludothèque right can edit the shared entry */}
                {can(user, "games") && (
                  <Link href={`/admin/games?q=${encodeURIComponent(game.name)}`} className="chip normal-case tracking-normal hover:border-accent">
                    <Pencil className="size-3" /> {t("editLudo")}
                  </Link>
                )}
              </p>
              <h1 className="page-title">{game.name}</h1>
              <p className="text-muted">{[game.year, game.designer, game.publisher].filter(Boolean).join(" · ")}</p>
              {game.baseGame && (
                <p className="mt-1 flex items-center gap-1.5 text-sm">
                  <Puzzle className="size-4 text-[#3b82f6]" /> {tk("expansions.of")}{" "}
                  <Link href={`/games/${game.baseGame.id}`} className="font-semibold hover:text-accent">
                    {game.baseGame.name}
                  </Link>
                </p>
              )}
            </div>
            {game.expansions.length > 0 && (
              <div className="space-y-2">
                <p className="label flex items-center gap-1.5">
                  <Puzzle className="size-3.5 text-[#3b82f6]" /> {tk("expansions.title", { count: game.expansions.length })}
                </p>
                <ul className="flex flex-wrap gap-2">
                  {game.expansions.map((e) => (
                    <li key={e.id}>
                      <Link href={`/games/${e.id}`} className="flex items-center gap-2 rounded-xl border border-line bg-surface/70 px-2 py-1 text-sm hover:border-accent">
                        <GameCover name={e.name} src={coverUrl(e)} size="xs" />
                        {e.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {facts.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {facts.map((f) => (
                  <span key={f.label} className="flex items-center gap-2 rounded-xl border border-line bg-surface/70 px-3 py-1.5 text-sm">
                    <f.icon className="size-4 text-accent" aria-hidden />
                    <span className="text-muted">{f.label}</span>
                    <b>{f.value}</b>
                  </span>
                ))}
              </div>
            )}
            <div className="grid gap-4 rounded-2xl bg-surface/60 p-4 sm:grid-cols-[auto_1fr]">
              <MeepleRating avg={rating.avg} count={rating.count} label={t("rating.count", { count: rating.count })} />
              <div className="flex h-14 items-end gap-1" aria-hidden>
                {distribution.map((n, i) => (
                  <div key={i} className="flex flex-1 flex-col items-center gap-0.5">
                    <div className="w-full rounded-t bg-accent/80" style={{ height: `${(n / maxBar) * 40 + 2}px` }} />
                    <span className="text-[9px] text-muted">{i + 1}</span>
                  </div>
                ))}
              </div>
            </div>
            {myScore != null && (
              <p className="flex items-center gap-2 text-sm">
                <span className="text-muted">{t("rating.yours")}</span> <MeepleBar score={myScore} size={14} /> <b className="text-accent">{myScore}/10</b>
              </p>
            )}
            <p className="text-sm text-muted">{t("kallax.stats", { kallax: game._count.kallaxGames, plays: game._count.plays })}</p>
          </div>
        </div>
      </FadeIn>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <section className="card card-pad space-y-3">
          <h2 className="section-title flex items-center gap-2">
            <BookOpen className="size-5 text-accent" /> {t("rulebooks.title")}
          </h2>
          {game.rulebooks.length === 0 ? (
            <p className="text-sm text-muted">{t("rulebooks.noneLudo")}</p>
          ) : (
            <ul className="divide-y divide-line">
              {game.rulebooks.map((rb) => (
                <li key={rb.id} className="flex flex-wrap items-center gap-3 py-2">
                  <span className="grid size-10 place-items-center rounded-lg bg-danger/10 text-xs font-black text-danger">PDF</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{rb.title}</p>
                    <p className="text-xs text-muted">
                      {rb.language.toUpperCase()} · {rb.uploadedBy?.displayName ?? "—"} · {format.dateTime(rb.createdAt, { dateStyle: "medium" })}
                    </p>
                  </div>
                  <RulebookLink fileId={rb.fileId} title={`${game.name} — ${rb.title}`} className="btn btn-ghost btn-sm">
                    <BookOpen className="size-3.5" /> {t("rulebooks.open")}
                  </RulebookLink>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="card card-pad space-y-3">
          <h2 className="section-title flex items-center gap-2 text-base">
            <LibraryBig className="size-5 text-accent" /> {t("kallax.title")}
          </h2>
          {myCopy ? (
            <Link href={`/kallax/${myCopy.id}`} className="btn btn-secondary w-full">
              {t("kallax.open")}
            </Link>
          ) : libraries.length > 0 ? (
            <ActionForm action={addGameAction} submitLabel={t("kallax.add")} className="space-y-3">
              <input type="hidden" name="gameId" value={game.id} />
              <select name="libraryId" className="select" aria-label={t("kallax.which")}>
                {libraries.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
              <select name="status" className="select" aria-label={tk("form.status")}>
                {LIBRARY_GAME_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {tk(`status.${s}`)}
                  </option>
                ))}
              </select>
            </ActionForm>
          ) : null}
          <p className="text-xs text-muted">{t("firstAdded", { date: format.dateTime(game.createdAt, { dateStyle: "medium" }) })}</p>
        </aside>
      </div>
    </div>
  );
}
