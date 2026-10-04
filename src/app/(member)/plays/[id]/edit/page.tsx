import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { hasRole, requireUser } from "@/lib/auth/guards";
import { requireModule } from "@/lib/modules";
import { getSiteSettings } from "@/lib/settings";
import { toDateInput } from "@/lib/time";
import { db } from "@/lib/db";
import { FadeIn } from "@/components/Motion";
import { getFriends } from "@/modules/friends/service";
import { PlayForm } from "@/modules/plays/components/PlayForm";
import { updatePlayAction } from "@/modules/plays/actions";

export async function generateMetadata() {
  return { title: (await getTranslations("plays"))("editTitle") };
}

export default async function EditPlayPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, user, mod, { timeZone }, t] = await Promise.all([params, requireUser(), requireModule("plays"), getSiteSettings(), getTranslations("plays")]);
  const play = await db.play.findUnique({
    where: { id },
    include: {
      game: { select: { name: true } },
      createdBy: { select: { id: true, displayName: true, meepleColor: true } },
      participants: { where: { status: { not: "DECLINED" } }, include: { user: { select: { id: true, displayName: true, meepleColor: true } } } },
    },
  });
  if (!play || (play.createdById !== user.id && !hasRole(user.role, "ADMIN"))) notFound();

  const [friends, catalogue] = await Promise.all([
    getFriends(play.createdById),
    db.game.findMany({ select: { name: true }, orderBy: { name: "asc" }, take: 500 }),
  ]);
  // The logger always sits first.
  const seats = [...play.participants]
    .sort((a, b) => (a.userId === play.createdById ? -1 : b.userId === play.createdById ? 1 : 0))
    .map((p) => ({
      key: p.id,
      userId: p.userId ?? undefined,
      guestName: p.guestName ?? undefined,
      name: p.user?.displayName ?? p.guestName ?? "?",
      color: p.user?.meepleColor ?? "#868e96",
      score: p.score == null ? "" : String(p.score),
      isWinner: p.isWinner,
      linked: Boolean(p.userId),
    }));

  return (
    <FadeIn className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="page-title">{t("editTitle")}</h1>
        <p className="text-muted">{t("editLead")}</p>
      </div>
      <div className="card card-pad">
        <PlayForm
          me={play.createdBy}
          friends={friends}
          gameNames={catalogue.map((g) => g.name)}
          today={toDateInput(new Date(), timeZone)}
          allowGuests={Boolean(mod.settings.allowGuests)}
          requireConfirmation={Boolean(mod.settings.requireConfirmation)}
          edit={{
            action: updatePlayAction.bind(null, play.id),
            ownerId: play.createdById,
            game: play.game.name,
            playedAt: toDateInput(play.playedAt, timeZone),
            durationMin: play.durationMin,
            location: play.location,
            notes: play.notes,
            seats,
          }}
        />
      </div>
    </FadeIn>
  );
}
