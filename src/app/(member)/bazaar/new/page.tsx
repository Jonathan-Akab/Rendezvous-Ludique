import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth/guards";
import { requireModule } from "@/lib/modules";
import { FadeIn } from "@/components/Motion";
import { getMyKallaxGames } from "@/modules/kallax/service";
import { ListingForm } from "@/modules/bazaar/components/ListingForm";
import { createListingAction } from "@/modules/bazaar/actions";

export async function generateMetadata() {
  return { title: (await getTranslations("bazaar"))("sell") };
}

export default async function NewListingPage({ searchParams }: { searchParams: Promise<{ game?: string }> }) {
  const [user, mod, { game }, t] = await Promise.all([requireUser(), requireModule("bazaar"), searchParams, getTranslations("bazaar")]);
  const myGames = await getMyKallaxGames(user.id);

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
          myGames={myGames}
          game={game}
        />
      </div>
    </FadeIn>
  );
}
