import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Baby, BookOpen, Clock, Dices, Download, Gauge, LibraryBig, Pencil, Sparkles, Trash2, Users } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { getModuleStates, requireModule } from "@/lib/modules";
import { db } from "@/lib/db";
import { FadeIn } from "@/components/Motion";
import { MeepleAvatar } from "@/components/Meeple";
import { ActionForm } from "@/components/ActionForm";
import { ConfirmButton } from "@/components/forms";
import { canEditGame, coverUrl, getGameDetail } from "@/modules/games/service";
import { GameCover } from "@/modules/games/components/GameCover";
import { MeepleBar, MeepleRating } from "@/modules/games/components/MeepleRating";
import { RatingInput } from "@/modules/games/components/RatingInput";
import { GameFields } from "@/modules/games/components/GameFields";
import { deleteRulebookAction, saveReviewAction, updateGameAction, uploadRulebookAction } from "@/modules/games/actions";
import { addGameAction } from "@/modules/kallax/actions";
import { getMyLibraries } from "@/modules/kallax/service";
import { LIBRARY_GAME_STATUSES } from "@/lib/constants";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const g = await db.game.findUnique({ where: { id: (await params).id }, select: { name: true } });
  return { title: g?.name };
}

export default async function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, user, mod, modules] = await Promise.all([params, requireUser(), requireModule("games"), getModuleStates()]);
  const [detail, t, tk, format, libraries] = await Promise.all([
    getGameDetail(id),
    getTranslations("games"),
    getTranslations("kallax"),
    getFormatter(),
    getMyLibraries(user.id),
  ]);
  if (!detail) notFound();
  const { game, ratings, rating, distribution } = detail;
  const mine = ratings.find((r) => r.userId === user.id);
  const canEdit = canEditGame(game, user, Boolean(mod.settings.communityEditing));
  const cover = coverUrl(game);
  const inMyKallax = await db.libraryGame.findFirst({
    where: { gameId: game.id, library: { members: { some: { userId: user.id, status: "ACCEPTED" } } } },
    include: { library: { select: { name: true } } },
  });
  const maxBar = Math.max(1, ...distribution);
  const tags = (game.categories ?? "").split(",").map((s) => s.trim()).filter(Boolean);

  const facts = [
    game.minPlayers && { icon: Users, label: t("facts.players"), value: game.minPlayers === game.maxPlayers ? `${game.minPlayers}` : `${game.minPlayers}–${game.maxPlayers}` },
    game.playTimeMin && { icon: Clock, label: t("facts.time"), value: `${game.playTimeMin} min` },
    game.minAge && { icon: Baby, label: t("facts.age"), value: `${game.minAge}+` },
    game.weight && { icon: Gauge, label: t("facts.weight"), value: `${game.weight.toFixed(1)} / 5` },
  ].filter(Boolean) as { icon: typeof Users; label: string; value: string }[];

  return (
    <div className="space-y-8">
      {/* Hero */}
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
              <h1 className="page-title">{game.name}</h1>
              <p className="text-muted">
                {[game.year, game.designer, game.publisher].filter(Boolean).join(" · ")}
              </p>
            </div>
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
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <Link key={tag} href={`/games?q=${encodeURIComponent(tag)}`} className="chip hover:border-accent">
                    {tag}
                  </Link>
                ))}
              </div>
            )}
            <div className="grid gap-4 rounded-2xl bg-surface/60 p-4 sm:grid-cols-[auto_1fr]">
              <MeepleRating avg={rating.avg} count={rating.count} label={t("rating.count", { count: rating.count })} />
              <div className="flex h-14 items-end gap-1" aria-hidden>
                {distribution.map((n, i) => (
                  <div key={i} className="flex flex-1 flex-col items-center gap-0.5">
                    <div className="w-full rounded-t bg-accent/80 transition-all" style={{ height: `${(n / maxBar) * 40 + 2}px` }} />
                    <span className="text-[9px] text-muted">{i + 1}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="label">{t("rating.yours")}</p>
              <RatingInput gameId={game.id} value={mine?.score ?? null} />
            </div>
            <div className="flex flex-wrap gap-2">
              {modules.ai.enabled && (
                <Link href={`/ai?game=${game.id}`} className="btn btn-primary">
                  <Sparkles className="size-4" /> {t("askAi")}
                </Link>
              )}
              {modules.plays.enabled && (
                <Link href={`/plays/new?game=${encodeURIComponent(game.name)}`} className="btn btn-secondary">
                  <Dices className="size-4" /> {t("logPlay")}
                </Link>
              )}
            </div>
          </div>
        </div>
      </FadeIn>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {game.description && (
            <section className="card card-pad">
              <h2 className="section-title mb-2">{t("about")}</h2>
              <p className="whitespace-pre-line leading-relaxed">{game.description}</p>
            </section>
          )}

          {/* Rulebooks */}
          <section className="card card-pad space-y-4">
            <h2 className="section-title flex items-center gap-2">
              <BookOpen className="size-5 text-accent" /> {t("rulebooks.title")}
            </h2>
            {game.rulebooks.length === 0 ? (
              <p className="text-sm text-muted">{t("rulebooks.none")}</p>
            ) : (
              <ul className="divide-y divide-line">
                {game.rulebooks.map((rb) => (
                  <li key={rb.id} className="flex flex-wrap items-center gap-3 py-2">
                    <span className="grid size-10 place-items-center rounded-lg bg-danger/10 text-xs font-black text-danger">PDF</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{rb.title}</p>
                      <p className="text-xs text-muted">
                        {rb.language.toUpperCase()} · {(rb.file.size / 1024 / 1024).toFixed(1)} Mo · {rb.uploadedBy?.displayName ?? "—"} ·{" "}
                        {format.dateTime(rb.createdAt, { dateStyle: "medium" })}
                      </p>
                    </div>
                    {modules.ai.enabled && (
                      <Link href={`/ai?game=${game.id}&rulebook=${rb.id}`} className="btn btn-secondary btn-sm">
                        <Sparkles className="size-3.5" /> {t("rulebooks.ask")}
                      </Link>
                    )}
                    <a href={`/files/${rb.fileId}`} target="_blank" rel="noopener" className="btn btn-ghost btn-sm">
                      <Download className="size-3.5" /> {t("rulebooks.open")}
                    </a>
                    {(rb.uploadedById === user.id || user.role === "ADMIN") && (
                      <form action={deleteRulebookAction.bind(null, rb.id)}>
                        <ConfirmButton message={t("rulebooks.deleteConfirm", { title: rb.title })} className="p-1 text-muted hover:text-danger">
                          <Trash2 className="size-4" />
                        </ConfirmButton>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {(mod.settings.allowRulebookUploads || user.role === "ADMIN") && (
              <details className="rounded-xl border border-dashed border-line p-3">
                <summary className="cursor-pointer text-sm font-semibold">{t("rulebooks.upload")}</summary>
                <ActionForm action={uploadRulebookAction.bind(null, game.id)} submitLabel={t("rulebooks.uploadSubmit")} className="mt-3 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
                    <input name="title" className="input" placeholder={t("rulebooks.titlePlaceholder")} maxLength={120} />
                    <select name="language" className="select" defaultValue="fr">
                      <option value="fr">Français</option>
                      <option value="en">English</option>
                    </select>
                  </div>
                  <input name="file" type="file" accept="application/pdf" required className="input" />
                  <p className="text-xs text-muted">{t("rulebooks.hint")}</p>
                </ActionForm>
              </details>
            )}
          </section>

          {/* Reviews */}
          <section className="card card-pad space-y-4">
            <h2 className="section-title">{t("reviews.title")}</h2>
            {mine && (
              <form action={saveReviewAction.bind(null, game.id)} className="space-y-2">
                <textarea name="review" defaultValue={mine.review ?? ""} className="textarea" placeholder={t("reviews.placeholder")} maxLength={2000} />
                <button className="btn btn-secondary btn-sm">{t("reviews.save")}</button>
              </form>
            )}
            {!mine && <p className="text-sm text-muted">{t("reviews.rateFirst")}</p>}
            <ul className="space-y-3">
              {ratings
                .filter((r) => r.review || r.userId !== user.id)
                .map((r) => (
                  <li key={r.id} className="flex gap-3">
                    <MeepleAvatar color={r.user.meepleColor} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm">
                        <Link href={`/members/${r.user.username}`} className="font-semibold hover:text-accent">
                          {r.user.displayName}
                        </Link>
                        <MeepleBar score={r.score} size={12} />
                        <b className="text-accent">{r.score}/10</b>
                      </p>
                      {r.review && <p className="mt-1 whitespace-pre-line text-sm text-muted">{r.review}</p>}
                    </div>
                  </li>
                ))}
            </ul>
          </section>
          {canEdit && (
            <details className="card card-pad">
              <summary className="flex cursor-pointer items-center gap-2 font-semibold">
                <Pencil className="size-4" /> {t("edit")}
              </summary>
              <div className="mt-4">
                <ActionForm action={updateGameAction.bind(null, game.id)} submitLabel={t("save")}>
                  <GameFields values={game} allowCover={Boolean(mod.settings.allowCoverUploads) || user.role === "ADMIN"} />
                  {game.coverFileId && (
                    <label className="flex items-center gap-2 text-xs">
                      <input type="checkbox" name="removeCover" className="accent-[var(--accent)]" /> {t("removeCover")}
                    </label>
                  )}
                </ActionForm>
              </div>
            </details>
          )}
        </div>

        <aside className="space-y-6">
          {modules.kallax.enabled && (
            <section className="card card-pad space-y-3">
              <h2 className="section-title flex items-center gap-2 text-base">
                <LibraryBig className="size-5 text-accent" /> {t("kallax.title")}
              </h2>
              {inMyKallax ? (
                <p className="text-sm text-success">{t("kallax.already", { name: inMyKallax.library.name })}</p>
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
              <p className="text-xs text-muted">{t("kallax.stats", { kallax: game._count.libraryGames, plays: game._count.plays })}</p>
            </section>
          )}

          <section className="card card-pad space-y-2 text-sm">
            <p className="text-muted">
              {t("addedBy")}{" "}
              {game.createdBy ? (
                <Link href={`/members/${game.createdBy.username}`} className="link">
                  {game.createdBy.displayName}
                </Link>
              ) : (
                "—"
              )}
            </p>
            <p className="text-xs text-muted">{t("updated", { date: format.dateTime(game.updatedAt, { dateStyle: "medium" }) })}</p>
          </section>

        </aside>
      </div>
    </div>
  );
}
