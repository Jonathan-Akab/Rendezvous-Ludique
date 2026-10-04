import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Check, LayoutGrid, List, LogOut, Search, X } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { getModule, requireModule } from "@/lib/modules";
import { db } from "@/lib/db";
import { ilike } from "@/lib/search";
import { LIBRARY_GAME_STATUSES } from "@/lib/constants";
import { FadeIn } from "@/components/Motion";
import { MeepleAvatar } from "@/components/Meeple";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmButton } from "@/components/forms";
import { getMyLibraries } from "@/modules/kallax/service";
import { getMyRatings, getRatingStats } from "@/modules/games/service";
import { KallaxShelf } from "@/modules/kallax/components/KallaxShelf";
import { AddGameForm, InviteForm } from "@/modules/kallax/components/KallaxForms";
import {
  createLibraryAction,
  removeLibraryMemberAction,
  renameLibraryAction,
  respondLibraryInviteAction,
} from "@/modules/kallax/actions";
import type { Prisma } from "@/generated/prisma/client";

export async function generateMetadata() {
  return { title: (await getTranslations("nav"))("kallax") };
}

type Search = { lib?: string; q?: string; status?: string; players?: string; view?: string };

export default async function KallaxPage({ searchParams }: { searchParams: Promise<Search> }) {
  const [user, mod, sp, t] = await Promise.all([requireUser(), requireModule("kallax"), searchParams, getTranslations("kallax")]);

  const [libraries, invites] = await Promise.all([
    getMyLibraries(user.id),
    db.libraryMember.findMany({
      where: { userId: user.id, status: "PENDING" },
      include: { library: { include: { members: { where: { status: "ACCEPTED" }, include: { user: true } } } } },
    }),
  ]);
  const library = libraries.find((l) => l.id === sp.lib) ?? libraries[0];

  const where: Prisma.LibraryGameWhereInput = { libraryId: library?.id ?? "-" };
  if (sp.q) where.game = { name: ilike(sp.q) };
  if (sp.status && LIBRARY_GAME_STATUSES.includes(sp.status as never)) where.status = sp.status;
  const players = Number(sp.players);
  if (players > 0) where.game = { ...(where.game as object), minPlayers: { lte: players }, maxPlayers: { gte: players } };

  const rows = await db.libraryGame.findMany({
    where,
    include: { game: true, owner: { select: { displayName: true, meepleColor: true } } },
    orderBy: { game: { name: "asc" } },
  });
  const gameIds = rows.map((r) => r.gameId);
  const [stats, mine] = await Promise.all([getRatingStats(gameIds), getMyRatings(user.id, gameIds)]);
  const games = rows.map((r) => ({ ...r, rating: stats.get(r.gameId) ?? { avg: null, count: 0 }, myRating: mine.get(r.gameId) ?? null }));
  const view = sp.view === "list" ? "list" : "shelf";

  const accepted = library?.members.filter((m) => m.status === "ACCEPTED") ?? [];
  const pending = library?.members.filter((m) => m.status === "PENDING") ?? [];
  const me = library?.members.find((m) => m.userId === user.id);
  const shared = accepted.length > 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">{t("title")}</h1>
          <p className="text-muted">{t("lead")}</p>
        </div>
      </div>

      {invites.map((inv) => (
        <FadeIn key={inv.id} className="card flex flex-wrap items-center gap-3 border-accent p-4">
          <p className="flex-1 text-sm">
            {t("sharing.invitedTo", {
              name: inv.library.name,
              people: inv.library.members.map((m) => m.user.displayName).join(", "),
            })}
          </p>
          <form action={respondLibraryInviteAction.bind(null, inv.id, true)}>
            <button className="btn btn-primary btn-sm">
              <Check className="size-3.5" /> {t("sharing.accept")}
            </button>
          </form>
          <form action={respondLibraryInviteAction.bind(null, inv.id, false)}>
            <button className="btn btn-ghost btn-sm">
              <X className="size-3.5" /> {t("sharing.decline")}
            </button>
          </form>
        </FadeIn>
      ))}

      {libraries.length > 1 && (
        <nav className="flex flex-wrap gap-2" aria-label={t("libraries")}>
          {libraries.map((l) => (
            <Link
              key={l.id}
              href={`/kallax?lib=${l.id}`}
              className={`chip px-3 py-1 text-sm ${l.id === library?.id ? "chip-accent" : ""}`}
            >
              {l.name} <span className="opacity-70">({l._count.games})</span>
            </Link>
          ))}
        </nav>
      )}

      {!library ? (
        <EmptyState title={t("noLibrary")}>
          <form action={createLibraryAction} className="flex gap-2">
            <input name="name" className="input" defaultValue={`Kallax — ${user.displayName}`} required />
            <button className="btn btn-primary">{t("create")}</button>
          </form>
        </EmptyState>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          <div className="space-y-4">
            <AddGameForm
              libraryId={library.id}
              members={accepted.map((m) => ({ id: m.userId, displayName: m.user.displayName }))}
            />
            <form className="flex flex-wrap items-end gap-2" role="search">
              <input type="hidden" name="lib" value={library.id} />
              <input type="hidden" name="view" value={view} />
              <div className="relative min-w-40 flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
                <input name="q" defaultValue={sp.q} placeholder={t("searchPlaceholder")} className="input pl-9" aria-label={t("searchPlaceholder")} />
              </div>
              <select name="status" defaultValue={sp.status ?? ""} className="select w-auto" aria-label={t("form.status")}>
                <option value="">{t("allStatuses")}</option>
                {LIBRARY_GAME_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(`status.${s}`)}
                  </option>
                ))}
              </select>
              <input name="players" type="number" min={1} defaultValue={sp.players} placeholder={t("playersFilter")} className="input w-28" aria-label={t("playersFilter")} />
              <button className="btn btn-secondary">{t("filter")}</button>
            </form>
            {games.length === 0 ? (
              <EmptyState title={sp.q || sp.status || sp.players ? t("noMatch") : t("emptyShelf")} text={t("emptyShelfHint")} />
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted">{t("count", { count: games.length })}</p>
                  <div className="flex rounded-xl border border-line p-0.5 text-xs font-semibold">
                    {(["shelf", "list"] as const).map((v) => (
                      <Link
                        key={v}
                        href={`/kallax?lib=${library.id}&view=${v}`}
                        className={`flex items-center gap-1 rounded-lg px-2.5 py-1 ${view === v ? "bg-accent text-accent-ink" : "text-muted"}`}
                      >
                        {v === "shelf" ? <LayoutGrid className="size-3.5" /> : <List className="size-3.5" />} {t(`views.${v}`)}
                      </Link>
                    ))}
                  </div>
                </div>
                <KallaxShelf games={games} editable shared={shared} view={view} sellable={(await getModule("bazaar")).enabled} />
              </>
            )}
          </div>

          <aside className="space-y-4">
            <div className="card card-pad space-y-4">
              <h2 className="section-title">{t("sharing.title")}</h2>
              {me?.role === "OWNER" ? (
                <form action={renameLibraryAction.bind(null, library.id)} className="flex gap-2">
                  <input name="name" defaultValue={library.name} className="input" aria-label={t("name")} />
                  <button className="btn btn-secondary btn-sm">{t("rename")}</button>
                </form>
              ) : (
                <p className="font-semibold">{library.name}</p>
              )}
              <ul className="space-y-2">
                {accepted.map((m) => (
                  <li key={m.id} className="flex items-center gap-2 text-sm">
                    <MeepleAvatar color={m.user.meepleColor} size={28} />
                    <Link href={`/members/${m.user.username}`} className="flex-1 hover:text-accent">
                      {m.user.displayName}
                    </Link>
                    {m.role === "OWNER" && <span className="text-xs text-muted">{t("sharing.owner")}</span>}
                    {me?.role === "OWNER" && m.userId !== user.id && (
                      <form action={removeLibraryMemberAction.bind(null, library.id, m.userId)}>
                        <button className="text-muted hover:text-danger" title={t("sharing.remove")}>
                          <X className="size-4" />
                        </button>
                      </form>
                    )}
                  </li>
                ))}
                {pending.map((m) => (
                  <li key={m.id} className="flex items-center gap-2 text-sm text-muted">
                    <MeepleAvatar color={m.user.meepleColor} size={28} />
                    <span className="flex-1">{m.user.displayName}</span>
                    <span className="text-xs">{t("sharing.pending")}</span>
                  </li>
                ))}
              </ul>
              {mod.settings.allowSharing && (
                <>
                  <p className="text-xs text-muted">{t("sharing.hint")}</p>
                  <InviteForm libraryId={library.id} />
                </>
              )}
              <form action={removeLibraryMemberAction.bind(null, library.id, user.id)}>
                <ConfirmButton className="btn btn-ghost btn-sm text-muted" message={shared ? t("sharing.leaveConfirm") : t("sharing.deleteConfirm")}>
                  <LogOut className="size-3.5" /> {shared ? t("sharing.leave") : t("sharing.deleteLibrary")}
                </ConfirmButton>
              </form>
            </div>
            <details className="card p-4">
              <summary className="cursor-pointer text-sm font-semibold">{t("newLibrary")}</summary>
              <form action={createLibraryAction} className="mt-3 flex gap-2">
                <input name="name" className="input" required placeholder={t("newLibraryPlaceholder")} />
                <button className="btn btn-primary btn-sm">{t("create")}</button>
              </form>
            </details>
          </aside>
        </div>
      )}
    </div>
  );
}
