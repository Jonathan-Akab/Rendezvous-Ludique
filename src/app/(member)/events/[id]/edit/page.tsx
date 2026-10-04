import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { hasRole, requireUser } from "@/lib/auth/guards";
import { requireModule } from "@/lib/modules";
import { getSiteSettings } from "@/lib/settings";
import { toLocalInput } from "@/lib/time";
import { db } from "@/lib/db";
import { FadeIn } from "@/components/Motion";
import { EventForm } from "@/modules/events/components/EventForm";
import { updateEventAction } from "@/modules/events/actions";

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, user, mod, { timeZone }, t] = await Promise.all([
    params,
    requireUser(),
    requireModule("events"),
    getSiteSettings(),
    getTranslations("events"),
  ]);
  const event = await db.event.findUnique({ where: { id }, include: { games: { include: { game: true } } } });
  if (!event || (event.hostId !== user.id && !hasRole(user.role, "ADMIN"))) notFound();

  return (
    <FadeIn className="mx-auto max-w-3xl space-y-6">
      <h1 className="page-title">{t("editTitle")}</h1>
      <div className="card card-pad">
        <EventForm
          action={updateEventAction.bind(null, event.id)}
          allowHomeGames={Boolean(mod.settings.allowHomeGames) || event.kind === "HOME_GAME"}
          allowPublic={Boolean(mod.settings.allowPublicEvents)}
          submitLabel={t("save")}
          values={{
            ...event,
            startsAt: toLocalInput(event.startsAt, timeZone),
            endsAt: event.endsAt ? toLocalInput(event.endsAt, timeZone) : "",
            games: event.games.map((g) => g.game.name).join(", "),
          }}
        />
      </div>
    </FadeIn>
  );
}
