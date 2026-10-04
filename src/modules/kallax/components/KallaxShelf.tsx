import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Clock, Users } from "lucide-react";
import { Meeple } from "@/components/Meeple";
import { GameCover } from "@/modules/games/components/GameCover";
import { MeepleRating } from "@/modules/games/components/MeepleRating";
import { coverUrl } from "@/modules/games/service";
import { GameCubeActions } from "./GameCubeActions";

export type ShelfGame = {
  id: string;
  status: string;
  notes: string | null;
  game: {
    id: string;
    name: string;
    minPlayers: number | null;
    maxPlayers: number | null;
    playTimeMin: number | null;
    year: number | null;
    coverFileId: string | null;
    imageUrl: string | null;
  };
  owner: { displayName: string; meepleColor: string } | null;
  rating?: { avg: number | null; count: number };
  myRating?: number | null;
};

const STATUS_STYLE: Record<string, string> = {
  OWNED: "",
  WISHLIST: "opacity-60 grayscale-[40%]",
  FOR_TRADE: "",
  PREORDERED: "opacity-80",
};

function players(g: ShelfGame["game"]) {
  if (!g.minPlayers || !g.maxPlayers) return null;
  return g.minPlayers === g.maxPlayers ? `${g.minPlayers}` : `${g.minPlayers}–${g.maxPlayers}`;
}

/** The shelf: each game box stands in a square cube, like the famous Swedish bookcase. */
export async function KallaxShelf({
  games,
  editable,
  shared,
  view = "shelf",
  sellable = false,
}: {
  games: ShelfGame[];
  editable: boolean;
  shared: boolean;
  view?: "shelf" | "list";
  /** show a "sell in the bazar" shortcut on each game */
  sellable?: boolean;
}) {
  const t = await getTranslations("kallax");

  if (view === "list") {
    return (
      <div className="card divide-y divide-line">
        {games.map((g) => (
          <div key={g.id} className="group flex items-center gap-4 p-3">
            <Link href={`/games/${g.game.id}`}>
              <GameCover name={g.game.name} src={coverUrl(g.game)} size="sm" />
            </Link>
            <div className="min-w-0 flex-1">
              <Link href={`/games/${g.game.id}`} className="font-display text-lg font-bold hover:text-accent">
                {g.game.name}
              </Link>
              <p className="flex flex-wrap items-center gap-x-3 text-xs text-muted">
                {players(g.game) && (
                  <span className="inline-flex items-center gap-1">
                    <Users className="size-3" /> {players(g.game)}
                  </span>
                )}
                {g.game.playTimeMin && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3" /> {g.game.playTimeMin}′
                  </span>
                )}
                {g.game.year && <span>{g.game.year}</span>}
                {g.status !== "OWNED" && <span className="chip">{t(`status.${g.status}`)}</span>}
              </p>
            </div>
            {g.rating && <MeepleRating avg={g.rating.avg} count={g.rating.count} compact label={t("siteRating")} />}
            {g.myRating != null && <span className="text-xs text-muted">{t("myRating", { score: g.myRating })}</span>}
            {shared && g.owner && <Meeple color={g.owner.meepleColor} size={20} title={g.owner.displayName} />}
            {editable && (
              <div className="w-40">
                <GameCubeActions id={g.id} status={g.status} name={g.game.name} sellHref={sellable ? `/bazaar/new?game=${g.game.id}` : undefined} />
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-3xl border-[10px] border-[color-mix(in_oklab,var(--surface-2)_70%,var(--ink)_12%)] bg-[color-mix(in_oklab,var(--surface-2)_80%,var(--ink)_6%)] p-1.5 shadow-[0_30px_60px_-30px_rgb(0_0_0/0.6)]">
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
        {games.map((g) => (
          <div
            key={g.id}
            className="group relative flex aspect-square flex-col items-center justify-end overflow-hidden bg-[linear-gradient(180deg,color-mix(in_oklab,var(--surface)_92%,black),var(--surface))] px-3 pb-2 pt-4 shadow-[inset_0_10px_18px_-8px_rgb(0_0_0/0.45)]"
          >
            <Link href={`/games/${g.game.id}`} className={`flex w-full flex-1 items-end justify-center ${STATUS_STYLE[g.status]}`}>
              <GameCover name={g.game.name} src={coverUrl(g.game)} size="fill" tilt className="max-h-full max-w-[62%]" />
            </Link>
            {/* shelf lip */}
            <div className="mt-1 h-1 w-full rounded-full bg-black/20" />
            <div className="mt-1 flex w-full items-center justify-between gap-1">
              <span className="truncate text-xs font-semibold">{g.game.name}</span>
              {g.rating && <MeepleRating avg={g.rating.avg} count={g.rating.count} compact label={t("siteRating")} />}
            </div>
            <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
              {g.status !== "OWNED" && <span className="chip bg-surface/90 px-1.5 text-[10px] backdrop-blur">{t(`status.${g.status}`)}</span>}
            </div>
            {shared && g.owner && (
              <span className="absolute right-2 top-2" title={g.owner.displayName}>
                <Meeple color={g.owner.meepleColor} size={18} title={g.owner.displayName} />
              </span>
            )}
            {editable && (
              <div className="absolute inset-x-2 bottom-8 translate-y-2 rounded-lg bg-surface/95 p-1 opacity-0 shadow-card backdrop-blur transition group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
                <GameCubeActions id={g.id} status={g.status} name={g.game.name} sellHref={sellable ? `/bazaar/new?game=${g.game.id}` : undefined} />
              </div>
            )}
          </div>
        ))}
        {Array.from({ length: (4 - (games.length % 4)) % 4 }).map((_, i) => (
          <div key={`empty-${i}`} className="hidden aspect-square bg-surface shadow-[inset_0_10px_18px_-8px_rgb(0_0_0/0.45)] lg:block" />
        ))}
      </div>
    </div>
  );
}
