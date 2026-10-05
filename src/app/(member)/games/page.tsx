import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Clock, Search, Users } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { requireModule } from "@/lib/modules";
import { Stagger, StaggerItem } from "@/components/Motion";
import { EmptyState } from "@/components/EmptyState";
import { coverUrl, listCatalogue, type CatalogueSort } from "@/modules/games/service";
import { GameCover } from "@/modules/games/components/GameCover";
import { MeepleRating } from "@/modules/games/components/MeepleRating";

export async function generateMetadata() {
  return { title: (await getTranslations("nav"))("games") };
}

type Search = { q?: string; players?: string; time?: string; sort?: string };
const SORTS: CatalogueSort[] = ["popular", "rating", "name", "recent"];

export default async function GamesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const [, , sp, t] = await Promise.all([requireUser(), requireModule("games"), searchParams, getTranslations("games")]);
  const sort = SORTS.find((s) => s === sp.sort) ?? "popular";
  const games = await listCatalogue({
    q: sp.q?.trim() || undefined,
    players: Number(sp.players) || undefined,
    maxTime: Number(sp.time) || undefined,
    sort,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">{t("title")}</h1>
          <p className="text-muted">{t("lead")}</p>
        </div>

      </div>

      <form className="glass flex flex-wrap items-end gap-3 rounded-2xl p-4" role="search">
        <div className="min-w-56 flex-1">
          <label className="label" htmlFor="q">
            {t("search")}
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <input id="q" name="q" defaultValue={sp.q} className="input pl-9" placeholder={t("searchPlaceholder")} />
          </div>
        </div>
        <div className="w-28">
          <label className="label" htmlFor="players">
            {t("players")}
          </label>
          <input id="players" name="players" type="number" min={1} defaultValue={sp.players} className="input" />
        </div>
        <div className="w-32">
          <label className="label" htmlFor="time">
            {t("maxTime")}
          </label>
          <input id="time" name="time" type="number" min={5} step={5} defaultValue={sp.time} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="sort">
            {t("sort")}
          </label>
          <select id="sort" name="sort" defaultValue={sort} className="select">
            {SORTS.map((s) => (
              <option key={s} value={s}>
                {t(`sorts.${s}`)}
              </option>
            ))}
          </select>
        </div>
        <button className="btn btn-secondary">{t("filter")}</button>
      </form>

      {games.length === 0 ? (
        <EmptyState title={t("empty")} />
      ) : (
        <Stagger className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" step={0.03}>
          {games.map((g) => (
            <StaggerItem key={g.id}>
              <Link href={`/games/${g.id}`} className="group card-hover flex h-full flex-col gap-3 rounded-2xl p-3">
                <GameCover name={g.name} src={coverUrl(g)} size="fill" tilt />
                <div className="min-w-0 space-y-1">
                  <p className="truncate font-display font-bold group-hover:text-accent">{g.name}</p>
                  <p className="flex flex-wrap gap-x-2 text-xs text-muted">
                    {g.minPlayers && (
                      <span className="inline-flex items-center gap-0.5">
                        <Users className="size-3" /> {g.minPlayers}–{g.maxPlayers}
                      </span>
                    )}
                    {g.playTimeMin && (
                      <span className="inline-flex items-center gap-0.5">
                        <Clock className="size-3" /> {g.playTimeMin}′
                      </span>
                    )}
                    {g.year && <span>{g.year}</span>}
                  </p>
                  <div className="flex items-center justify-between">
                    <MeepleRating avg={g.rating.avg} count={g.rating.count} compact label={t("rating.site")} />
                    <span className="text-[11px] text-muted">{t("inKallax", { count: g._count.kallaxGames })}</span>
                  </div>
                </div>
              </Link>
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </div>
  );
}
