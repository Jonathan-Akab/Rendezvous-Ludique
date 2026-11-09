import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Clock, Search, Users } from "lucide-react";
import { Stagger, StaggerItem } from "@/components/Motion";
import { GameCover } from "@/modules/games/components/GameCover";
import { MeepleRating } from "@/modules/games/components/MeepleRating";
import { demoLibrary } from "@/modules/demo/data";

/** The demo Ludothèque: the real page's layout with the made-up members' games. */
export default async function DemoLudotheque({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const [{ q = "" }, t, tg] = await Promise.all([searchParams, getTranslations("demo"), getTranslations("games")]);
  const needle = q.trim().toLowerCase();
  const games = demoLibrary().filter((g) => !needle || g.name.toLowerCase().includes(needle));
  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">{t("nav.games")}</h1>
        <p className="text-muted">{t("ludo.lead")}</p>
      </div>
      <form className="glass flex flex-wrap items-end gap-3 rounded-2xl p-4" role="search">
        <div className="min-w-56 flex-1">
          <label className="label" htmlFor="q">
            {tg("search")}
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <input id="q" name="q" defaultValue={q} className="input pl-9" placeholder={tg("searchPlaceholder")} />
          </div>
        </div>
        <button className="btn btn-secondary">{tg("filter")}</button>
      </form>
      <Stagger data-guide="demo-ludo" className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" step={0.03}>
        {games.map((g) => (
          <StaggerItem key={g.id}>
            <Link href={`/demo/games/${g.id}`} className="group card-hover flex h-full flex-col gap-3 rounded-2xl p-3">
              <GameCover name={g.name} src={null} size="fill" tilt />
              <div className="min-w-0 space-y-1">
                <p className="truncate font-display font-bold group-hover:text-accent">{g.name}</p>
                <p className="flex flex-wrap gap-x-2 text-xs text-muted">
                  <span className="inline-flex items-center gap-0.5">
                    <Users className="size-3" /> {g.minPlayers}–{g.maxPlayers}
                  </span>
                  <span className="inline-flex items-center gap-0.5">
                    <Clock className="size-3" /> {g.playTimeMin}′
                  </span>
                  <span>{g.year}</span>
                </p>
                <div className="flex items-center justify-between">
                  <MeepleRating avg={g.rating.avg} count={g.rating.count} compact label={tg("rating.site")} />
                  <span className="text-[11px] text-muted">{tg("inKallax", { count: g.owners })}</span>
                </div>
              </div>
            </Link>
          </StaggerItem>
        ))}
      </Stagger>
    </div>
  );
}
