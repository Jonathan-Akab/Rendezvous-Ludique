import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { getModule } from "@/lib/modules";
import { getSiteSettings } from "@/lib/settings";
import { toLocalInput } from "@/lib/time";
import { AdminHeader } from "@/modules/admin/components/AdminUi";
import { EventForm } from "@/modules/events/components/EventForm";
import { updateEventAction } from "@/modules/events/actions";

export default async function AdminEditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, mod, { timeZone }, t] = await Promise.all([params, getModule("events"), getSiteSettings(), getTranslations("admin.events")]);
  const event = await db.event.findUnique({
    where: { id },
    include: { games: { include: { game: true } }, host: { select: { displayName: true } } },
  });
  if (!event) notFound();

  return (
    <div className="max-w-3xl space-y-4">
      <Link href="/admin/events" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> {t("back")}
      </Link>
      <AdminHeader title={event.title} lead={t("hostedBy", { name: event.host.displayName })} />
      <div className="card card-pad">
        <EventForm
          action={updateEventAction.bind(null, event.id)}
          returnTo="admin"
          allowHomeGames
          allowPublic
          submitLabel={t("save")}
          values={{
            ...event,
            startsAt: toLocalInput(event.startsAt, timeZone),
            endsAt: event.endsAt ? toLocalInput(event.endsAt, timeZone) : "",
            games: event.games.map((g) => g.game.name).join(", "),
          }}
        />
      </div>
      {!mod.enabled && <p className="text-sm text-danger">{t("moduleOff")}</p>}
    </div>
  );
}
