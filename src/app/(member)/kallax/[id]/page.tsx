import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { ArrowLeft, Baby, BookOpen, Clock, Dices, Download, Pencil, Puzzle, Sparkles, Store, Trash2, Users } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { getModuleStates, requireModule } from "@/lib/modules";
import { db } from "@/lib/db";
import { LIBRARY_GAME_STATUSES } from "@/lib/constants";
import { FadeIn } from "@/components/Motion";
import { Meeple } from "@/components/Meeple";
import { ActionForm } from "@/components/ActionForm";
import { ConfirmButton } from "@/components/forms";
import { GameCover } from "@/modules/games/components/GameCover";
import { GameFields } from "@/modules/games/components/GameFields";
import { MeepleRating } from "@/modules/games/components/MeepleRating";
import { RatingInput } from "@/modules/games/components/RatingInput";
import { FindImage } from "@/modules/games/components/ImageSuggestions";
import { getMyRatings, getRatingStats } from "@/modules/games/service";
import { deleteRulebookAction, uploadRulebookAction } from "@/modules/games/actions";
import { getLoggedPlayCounts, isLibraryMember, kallaxCoverUrl } from "@/modules/kallax/service";
import { addKallaxExpansionAction, removeKallaxGameAndBackAction, setKallaxParentAction, updateKallaxGameAction } from "@/modules/kallax/actions";
import { RulebookLink } from "@/modules/games/components/RulebookOverlay";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const kg = await db.kallaxGame.findUnique({ where: { id: (await params).id }, select: { name: true } });
  return { title: kg?.name };
}

export default async function KallaxGamePage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, user, , modules] = await Promise.all([params, requireUser(), requireModule("kallax"), getModuleStates()]);
  const kg = await db.kallaxGame.findUnique({
    where: { id },
    include: {
      library: { include: { members: { where: { status: "ACCEPTED" }, include: { user: { select: { id: true, displayName: true, meepleColor: true } } } } } },
      owner: { select: { displayName: true, meepleColor: true } },
      parent: { select: { id: true, name: true } },
      expansions: { select: { id: true, name: true, imageUrl: true, coverFileId: true, gameId: true }, orderBy: { name: "asc" } },
      game: { include: { rulebooks: { include: { file: true, uploadedBy: { select: { displayName: true } } }, orderBy: { createdAt: "desc" } } } },
    },
  });
  // Private to the members who share this Kallax.
  if (!kg || !(await isLibraryMember(kg.libraryId, user.id))) notFound();

  const [t, tg, format, stats, mine, loggedPlays] = await Promise.all([
    getTranslations("kallax"),
    getTranslations("games"),
    getFormatter(),
    getRatingStats([kg.gameId]),
    getMyRatings(user.id, [kg.gameId]),
    getLoggedPlayCounts(kg.libraryId, [kg.gameId]),
  ]);
  // times played: plays logged on the site + the ones typed in by hand
  const logged = loggedPlays.get(kg.gameId) ?? 0;
  const timesPlayed = logged + kg.extraPlays;
  const rating = stats.get(kg.gameId) ?? { avg: null, count: 0 };
  const cover = kallaxCoverUrl(kg);
  const shared = kg.library.members.length > 1;
  // Other base games of this Kallax (to attach expansions either way).
  const others = await db.kallaxGame.findMany({
    where: { libraryId: kg.libraryId, parentId: null, id: { not: kg.id } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const players = kg.minPlayers && kg.maxPlayers ? (kg.minPlayers === kg.maxPlayers ? `${kg.minPlayers}` : `${kg.minPlayers}–${kg.maxPlayers}`) : null;

  return (
    <div className="space-y-6">
      <Link href={`/kallax?lib=${kg.libraryId}`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> {kg.library.name}
      </Link>

      <FadeIn className="relative overflow-hidden rounded-3xl border border-line">
        <div className="absolute inset-0 -z-10 scale-125 opacity-50 blur-3xl">
          <GameCover name={kg.name} src={cover} size="fill" className="!aspect-auto h-full" />
        </div>
        <div className="glass flex flex-col gap-6 p-6 sm:flex-row sm:p-8">
          <div className="group mx-auto sm:mx-0">
            <GameCover name={kg.name} src={cover} size="xl" tilt />
          </div>
          <div className="min-w-0 flex-1 space-y-4">
            <div>
              <div className="flex flex-wrap gap-1.5">
                {kg.status !== "OWNED" && <span className="chip">{t(`status.${kg.status}`)}</span>}
                <span className="chip">
                  <Dices className="size-3 text-accent" /> {timesPlayed ? t("playedTimes", { count: timesPlayed }) : t("neverPlayed")}
                </span>
                {shared && kg.owner && (
                  <span className="chip">
                    <Meeple color={kg.owner.meepleColor} size={14} /> {kg.owner.displayName}
                  </span>
                )}
              </div>
              <h1 className="page-title">{kg.name}</h1>
              {kg.parent && (
                <p className="mt-1 flex items-center gap-1.5 text-sm">
                  <Puzzle className="size-4 text-[#3b82f6]" /> {t("expansions.of")}{" "}
                  <Link href={`/kallax/${kg.parent.id}`} className="font-semibold hover:text-accent">
                    {kg.parent.name}
                  </Link>
                </p>
              )}
              <p className="text-muted">{[kg.year, kg.designer, kg.publisher].filter(Boolean).join(" · ")}</p>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              {players && (
                <span className="flex items-center gap-1.5 rounded-xl border border-line bg-surface/70 px-3 py-1.5">
                  <Users className="size-4 text-accent" /> {players}
                </span>
              )}
              {kg.playTimeMin && (
                <span className="flex items-center gap-1.5 rounded-xl border border-line bg-surface/70 px-3 py-1.5">
                  <Clock className="size-4 text-accent" /> {kg.playTimeMin} min
                </span>
              )}
              {kg.minAge && (
                <span className="flex items-center gap-1.5 rounded-xl border border-line bg-surface/70 px-3 py-1.5">
                  <Baby className="size-4 text-accent" /> {kg.minAge}+
                </span>
              )}
            </div>
            {kg.notes && <p className="whitespace-pre-line rounded-2xl bg-surface/60 p-3 text-sm">{kg.notes}</p>}

            {/* Expansions: attached to their base game, not games of their own */}
            {!kg.parent && kg.expansions.length > 0 && (
              <div className="space-y-2 rounded-2xl bg-surface/60 p-4">
                <p className="label flex items-center gap-1.5">
                  <Puzzle className="size-3.5 text-[#3b82f6]" /> {t("expansions.title", { count: kg.expansions.length })}
                </p>
                <ul className="flex flex-wrap gap-2">
                  {kg.expansions.map((e) => (
                    <li key={e.id}>
                      <Link href={`/kallax/${e.id}`} className="flex items-center gap-2 rounded-xl border border-line bg-surface px-2 py-1 text-sm hover:border-accent">
                        <GameCover name={e.name} src={kallaxCoverUrl(e)} size="xs" />
                        {e.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <details className="rounded-2xl bg-surface/60 p-4 text-sm">
              <summary className="cursor-pointer font-semibold">
                <Puzzle className="mr-1.5 inline size-4 text-[#3b82f6]" />
                {t("expansions.manage")}
              </summary>
              <div className="mt-3 space-y-3">
                <form action={setKallaxParentAction.bind(null, kg.id)} className="flex flex-wrap items-end gap-2">
                  <label className="min-w-56 flex-1">
                    <span className="label">{t("expansions.isExpansionOf")}</span>
                    <select name="parentId" defaultValue={kg.parentId ?? ""} className="select">
                      <option value="">{t("expansions.standalone")}</option>
                      {others.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button className="btn btn-secondary btn-sm">{t("save")}</button>
                </form>
                {!kg.parent && others.length > 0 && (
                  <form action={addKallaxExpansionAction.bind(null, kg.id)} className="flex flex-wrap items-end gap-2">
                    <label className="min-w-56 flex-1">
                      <span className="label">{t("expansions.add")}</span>
                      <select name="expansionId" defaultValue="" className="select" required>
                        <option value="" disabled>
                          —
                        </option>
                        {others.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button className="btn btn-secondary btn-sm">{t("expansions.attach")}</button>
                  </form>
                )}
              </div>
            </details>

            <div className="grid gap-4 rounded-2xl bg-surface/60 p-4 sm:grid-cols-2">
              <div>
                <p className="label">{tg("rating.yours")}</p>
                <RatingInput gameId={kg.gameId} value={mine.get(kg.gameId) ?? null} />
              </div>
              <div>
                <p className="label">{tg("rating.site")}</p>
                <MeepleRating avg={rating.avg} count={rating.count} label={tg("rating.count", { count: rating.count })} />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {modules.plays.enabled && (
                <Link href={`/plays/new?game=${kg.gameId}`} className="btn btn-primary">
                  <Dices className="size-4" /> {tg("logPlay")}
                </Link>
              )}
              {modules.ai.enabled && (
                <Link href={`/ai?game=${kg.gameId}`} className="btn btn-secondary">
                  <Sparkles className="size-4" /> {tg("askAi")}
                </Link>
              )}
              {modules.bazaar.enabled && (
                <Link href={`/bazaar/new?game=${kg.gameId}`} className="btn btn-secondary">
                  <Store className="size-4" /> {t("sell")}
                </Link>
              )}
              {modules.games.enabled && (
                <Link href={`/games/${kg.gameId}`} className="btn btn-ghost">
                  {t("seeInLudo")}
                </Link>
              )}
              {!cover && <FindImage kallaxGameId={kg.id} name={kg.name} label={tg("images.find")} />}
            </div>
          </div>
        </div>
      </FadeIn>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card card-pad space-y-4">
          <h2 className="section-title flex items-center gap-2">
            <BookOpen className="size-5 text-accent" /> {tg("rulebooks.title")}
          </h2>
          <p className="text-xs text-muted">{t("rulebooksShared")}</p>
          {kg.game.rulebooks.length === 0 ? (
            <p className="text-sm text-muted">{tg("rulebooks.none")}</p>
          ) : (
            <ul className="divide-y divide-line">
              {kg.game.rulebooks.map((rb) => (
                <li key={rb.id} className="flex flex-wrap items-center gap-3 py-2">
                  <span className="grid size-10 place-items-center rounded-lg bg-danger/10 text-xs font-black text-danger">PDF</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{rb.title}</p>
                    <p className="text-xs text-muted">
                      {rb.language.toUpperCase()} · {rb.uploadedBy?.displayName ?? "—"} · {format.dateTime(rb.createdAt, { dateStyle: "medium" })}
                    </p>
                  </div>
                  <RulebookLink fileId={rb.fileId} title={rb.title} className="btn btn-ghost btn-sm">
                    <BookOpen className="size-3.5" /> {tg("rulebooks.open")}
                  </RulebookLink>
                  {(rb.uploadedById === user.id || user.role === "ADMIN") && (
                    <form action={deleteRulebookAction.bind(null, rb.id)}>
                      <ConfirmButton message={tg("rulebooks.deleteConfirm", { title: rb.title })} className="p-1 text-muted hover:text-danger">
                        <Trash2 className="size-4" />
                      </ConfirmButton>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
          {(modules.games.settings.allowRulebookUploads || user.role === "ADMIN") && (
            <details className="rounded-xl border border-dashed border-line p-3">
              <summary className="cursor-pointer text-sm font-semibold">{tg("rulebooks.upload")}</summary>
              <ActionForm action={uploadRulebookAction.bind(null, kg.gameId)} submitLabel={tg("rulebooks.uploadSubmit")} className="mt-3 space-y-3">
                <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
                  <input name="title" className="input" placeholder={tg("rulebooks.titlePlaceholder")} maxLength={120} />
                  <select name="language" className="select" defaultValue="fr">
                    <option value="fr">Français</option>
                    <option value="en">English</option>
                  </select>
                </div>
                <input name="file" type="file" accept="application/pdf" required className="input" />
                <p className="text-xs text-muted">{tg("rulebooks.hint")}</p>
              </ActionForm>
            </details>
          )}
        </section>

        <section className="card card-pad space-y-4">
          <h2 className="section-title flex items-center gap-2">
            <Pencil className="size-5 text-accent" /> {t("editTitle")}
          </h2>
          <p className="text-xs text-muted">{t("editLead")}</p>
          <ActionForm action={updateKallaxGameAction.bind(null, kg.id)} submitLabel={t("save")}>
            <GameFields values={kg} compact />
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="kg-status">
                  {t("form.status")}
                </label>
                <select id="kg-status" name="status" defaultValue={kg.status} className="select">
                  {LIBRARY_GAME_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {t(`status.${s}`)}
                    </option>
                  ))}
                </select>
              </div>
              {shared && (
                <div>
                  <label className="label" htmlFor="kg-owner">
                    {t("form.owner")}
                  </label>
                  <select id="kg-owner" name="ownerId" defaultValue={kg.ownerId ?? ""} className="select">
                    {kg.library.members.map((m) => (
                      <option key={m.user.id} value={m.user.id}>
                        {m.user.displayName}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div>
              <label className="label" htmlFor="kg-plays">
                {t("form.timesPlayed")}
              </label>
              <input id="kg-plays" name="timesPlayed" type="number" min={logged} max={100000} inputMode="numeric" defaultValue={timesPlayed} className="input w-32" />
              <p className="mt-1 text-xs text-muted">{logged ? t("form.timesPlayedLogged", { count: logged }) : t("form.timesPlayedHint")}</p>
            </div>
            <div>
              <label className="label" htmlFor="kg-notes">
                {t("form.notes")}
              </label>
              <textarea id="kg-notes" name="notes" defaultValue={kg.notes ?? ""} className="textarea min-h-16" maxLength={1000} />
            </div>
            {kg.coverFileId && (
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" name="removeCover" className="accent-[var(--accent)]" /> {tg("removeCover")}
              </label>
            )}
          </ActionForm>
          <form action={removeKallaxGameAndBackAction.bind(null, kg.id)} className="border-t border-line pt-3">
            <ConfirmButton message={t("removeConfirm", { name: kg.name })} className="btn btn-ghost btn-sm text-danger">
              <Trash2 className="size-4" /> {t("removeFromKallax")}
            </ConfirmButton>
          </form>
        </section>
      </div>
    </div>
  );
}
