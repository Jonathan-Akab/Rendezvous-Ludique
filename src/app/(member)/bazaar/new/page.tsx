import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth/guards";
import { requireModule } from "@/lib/modules";
import { FadeIn } from "@/components/Motion";
import { coverUrl, getRatingStats } from "@/modules/games/service";
import { db } from "@/lib/db";
import { ListingForm } from "@/modules/bazaar/components/ListingForm";
import { createListingAction } from "@/modules/bazaar/actions";

export async function generateMetadata() {
  return { title: (await getTranslations("bazaar"))("sell") };
}

export default async function NewListingPage({ searchParams }: { searchParams: Promise<{ game?: string }> }) {
  const [user, mod, { game: gameId }, t] = await Promise.all([requireUser(), requireModule("bazaar"), searchParams, getTranslations("bazaar")]);
  // Selling a game from your kallax: the game comes pre-selected.
  const game = gameId
    ? await db.game.findUnique({ where: { id: gameId }, include: { _count: { select: { libraryGames: true } } } })
    : null;
  const rating = game ? (await getRatingStats([game.id])).get(game.id) : null;

  return (
    <FadeIn className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="page-title">{t("sell")}</h1>
        <p className="text-muted">{t("sellLead")}</p>
      </div>
      <div className="card card-pad">
        <ListingForm
          action={createListingAction}
          allowTrades={Boolean(mod.settings.allowTrades)}
          currency={String(mod.settings.currency) || "CAD"}
          maxPhotos={Number(mod.settings.maxPhotos)}
          values={{ city: user.city, latitude: user.latitude, longitude: user.longitude }}
          game={
            game
              ? {
                  id: game.id,
                  name: game.name,
                  year: game.year,
                  minPlayers: game.minPlayers,
                  maxPlayers: game.maxPlayers,
                  playTimeMin: game.playTimeMin,
                  designer: game.designer,
                  cover: coverUrl(game),
                  owners: game._count.libraryGames,
                  rating: rating ?? { avg: null, count: 0 },
                }
              : null
          }
        />
      </div>
    </FadeIn>
  );
}
