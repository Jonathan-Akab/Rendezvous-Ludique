import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth/guards";
import { requireModule } from "@/lib/modules";
import { getSiteSettings } from "@/lib/settings";
import { toDateInput } from "@/lib/time";
import { FadeIn } from "@/components/Motion";
import { getFriends } from "@/modules/friends/service";
import { getMyKallaxGames } from "@/modules/kallax/service";
import { PlayForm } from "@/modules/plays/components/PlayForm";

export async function generateMetadata() {
  return { title: (await getTranslations("plays"))("log") };
}

export default async function NewPlayPage({ searchParams }: { searchParams: Promise<{ game?: string }> }) {
  const [user, mod, { timeZone }, t, { game }] = await Promise.all([requireUser(), requireModule("plays"), getSiteSettings(), getTranslations("plays"), searchParams]);
  const [friends, games] = await Promise.all([getFriends(user.id), getMyKallaxGames(user.id)]);

  return (
    <FadeIn className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="page-title">{t("log")}</h1>
        <p className="text-muted">{t("logLead")}</p>
      </div>
      <div className="card card-pad">
        <PlayForm
          me={{ id: user.id, displayName: user.displayName, meepleColor: user.meepleColor }}
          friends={friends}
          games={games}
          today={toDateInput(new Date(), timeZone)}
          allowGuests={Boolean(mod.settings.allowGuests)}
          requireConfirmation={Boolean(mod.settings.requireConfirmation)}
          defaultGame={game}
        />
      </div>
    </FadeIn>
  );
}
