import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, LayoutGrid, List, Search } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { requireModule } from "@/lib/modules";
import { db } from "@/lib/db";
import { ilike } from "@/lib/search";
import { EmptyState } from "@/components/EmptyState";
import { canViewProfile, getProfileData } from "@/modules/profiles/service";
import { getMyRatings, getRatingStats } from "@/modules/games/service";
import { getVisibleLibraries, kallaxCoverUrl } from "@/modules/kallax/service";
import { KallaxShelf } from "@/modules/kallax/components/KallaxShelf";
import type { Prisma } from "@/generated/prisma/client";

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }) {
  return { title: `Kallax @${(await params).username}` };
}

type Query = { lib?: string; q?: string; view?: string };

/** Someone else's Kallax, read-only — only the ones they chose to show (to friends or to every member). */
export default async function MemberKallaxPage({ params, searchParams }: { params: Promise<{ username: string }>; searchParams: Promise<Query> }) {
  const [{ username }, sp, viewer, , t] = await Promise.all([params, searchParams, requireUser(), requireModule("kallax"), getTranslations("kallax")]);
  const data = await getProfileData(username.toLowerCase());
  if (!data) notFound();
  if (data.user.id === viewer.id) redirect("/kallax");
  if (!(await canViewProfile(data.user, viewer.id))) notFound();

  const libraries = await getVisibleLibraries(data.user.id, viewer.id);
  const library = libraries.find((l) => l.id === sp.lib) ?? libraries[0];
  if (!library) {
    return (
      <div className="space-y-4">
        <Link href={`/members/${data.user.username}`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
          <ArrowLeft className="size-4" /> {data.user.displayName}
        </Link>
        <EmptyState title={t("theirs.none")} text={t("theirs.noneHint")} />
      </div>
    );
  }

  const where: Prisma.KallaxGameWhereInput = { libraryId: library.id, parentId: null };
  if (sp.q) where.OR = [{ name: ilike(sp.q) }, { expansions: { some: { name: ilike(sp.q) } } }];
  const rows = await db.kallaxGame.findMany({
    where,
    include: {
      game: { select: { coverFileId: true, imageUrl: true } },
      expansions: { select: { name: true }, orderBy: { name: "asc" } },
    },
    orderBy: { name: "asc" },
  });
  const gameIds = rows.map((r) => r.gameId);
  const [stats, mine] = await Promise.all([getRatingStats(gameIds), getMyRatings(viewer.id, gameIds)]);
  // Read-only: the owners' private notes and copy details stay private.
  const games = rows.map((r) => ({
    id: r.id,
    status: r.status,
    notes: null,
    owner: null,
    cover: kallaxCoverUrl(r),
    game: { id: r.gameId, name: r.name, minPlayers: r.minPlayers, maxPlayers: r.maxPlayers, playTimeMin: r.playTimeMin, year: r.year },
    rating: stats.get(r.gameId) ?? { avg: null, count: 0 },
    myRating: mine.get(r.gameId) ?? null,
    expansions: r.expansions.map((e) => e.name),
  }));
  const view = sp.view === "list" ? "list" : "shelf";
  const base = `/members/${data.user.username}/kallax`;

  return (
    <div className="space-y-6">
      <Link href={`/members/${data.user.username}`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> {data.user.displayName}
      </Link>
      <div>
        <h1 className="page-title">{t("theirs.title", { name: data.user.displayName })}</h1>
        <p className="text-muted">{t("theirs.readOnly")}</p>
      </div>

      {libraries.length > 1 && (
        <nav className="flex flex-wrap gap-2" aria-label={t("libraries")}>
          {libraries.map((l) => (
            <Link key={l.id} href={`${base}?lib=${l.id}`} className={`chip px-3 py-1 text-sm ${l.id === library.id ? "chip-accent" : ""}`}>
              {l.name} <span className="opacity-70">({l._count.games})</span>
            </Link>
          ))}
        </nav>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <form className="flex min-w-40 flex-1 gap-2" role="search">
          <input type="hidden" name="lib" value={library.id} />
          <input type="hidden" name="view" value={view} />
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <input name="q" defaultValue={sp.q} placeholder={t("searchPlaceholder")} className="input pl-9" aria-label={t("searchPlaceholder")} />
          </div>
          <button className="btn btn-secondary">{t("filter")}</button>
        </form>
        <div className="flex rounded-xl border border-line p-0.5 text-xs font-semibold">
          {(["shelf", "list"] as const).map((v) => (
            <Link key={v} href={`${base}?lib=${library.id}&view=${v}`} className={`flex items-center gap-1 rounded-lg px-2.5 py-1 ${view === v ? "bg-accent text-accent-ink" : "text-muted"}`}>
              {v === "shelf" ? <LayoutGrid className="size-3.5" /> : <List className="size-3.5" />} {t(`views.${v}`)}
            </Link>
          ))}
        </div>
      </div>

      {games.length === 0 ? <EmptyState title={sp.q ? t("noMatch") : t("emptyShelf")} /> : <KallaxShelf games={games} editable={false} shared={false} view={view} />}
    </div>
  );
}
