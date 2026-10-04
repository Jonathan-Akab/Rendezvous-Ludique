import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth/guards";
import { requireModule } from "@/lib/modules";
import { getSiteSettings } from "@/lib/settings";
import { toDateInput } from "@/lib/time";
import { db } from "@/lib/db";
import { FadeIn } from "@/components/Motion";
import { getFriends } from "@/modules/friends/service";
import { PlayForm } from "@/modules/plays/components/PlayForm";

export async function generateMetadata() {
  return { title: (await getTranslations("plays"))("log") };
}

export default async function NewPlayPage({ searchParams }: { searchParams: Promise<{ game?: string }> }) {
  const [user, mod, { timeZone }, t, { game }] = await Promise.all([requireUser(), requireModule("plays"), getSiteSettings(), getTranslations("plays"), searchParams]);
  const [friends, myGames, catalogue] = await Promise.all([
    getFriends(user.id),
    db.libraryGame.findMany({
      where: { library: { members: { some: { userId: user.id, status: "ACCEPTED" } } } },
      select: { game: { select: { name: true } } },
    }),
    db.game.findMany({ select: { name: true }, orderBy: { name: "asc" }, take: 500 }),
  ]);
  // Games from the member's kallax come first in the suggestions.
  const names = Array.from(new Set([...myGames.map((g) => g.game.name).sort(), ...catalogue.map((g) => g.name)]));

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
          gameNames={names}
          today={toDateInput(new Date(), timeZone)}
          allowGuests={Boolean(mod.settings.allowGuests)}
          requireConfirmation={Boolean(mod.settings.requireConfirmation)}
          defaultGame={game?.slice(0, 150)}
        />
      </div>
    </FadeIn>
  );
}
