import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { CalendarClock, Check, Lock, MapPin, Pencil, Trash2, Users, X } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { requireModule } from "@/lib/modules";
import { FadeIn } from "@/components/Motion";
import { MeepleAvatar } from "@/components/Meeple";
import { canSeeAddress, getEventForViewer, seatsTaken } from "@/modules/events/service";
import { KIND_COLORS } from "@/modules/events/components/EventCard";
import {
  deleteEventAction,
  respondJoinRequestAction,
  rsvpAction,
  setEventStatusAction,
} from "@/modules/events/actions";

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, user] = await Promise.all([params, requireUser(), requireModule("events")]);
  const [event, t, format] = await Promise.all([getEventForViewer(id, user.id), getTranslations("events"), getFormatter()]);
  if (!event) notFound();

  const isHost = event.hostId === user.id;
  const me = event.attendees.find((a) => a.userId === user.id);
  const going = event.attendees.filter((a) => a.status === "GOING");
  const maybe = event.attendees.filter((a) => a.status === "MAYBE");
  const requests = event.attendees.filter((a) => a.status === "REQUESTED");
  const taken = seatsTaken(event);
  const full = event.maxPlayers != null && taken >= event.maxPlayers;
  const showAddress = canSeeAddress(event, user.id);
  const color = KIND_COLORS[event.kind];
  const scheduled = event.status === "SCHEDULED";

  return (
    <FadeIn className="mx-auto max-w-4xl space-y-6">
      <div className="card overflow-hidden">
        <div className="h-3" style={{ background: color }} />
        <div className="card-pad space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip border-transparent text-white" style={{ background: color }}>
              {t(`kinds.${event.kind}`)}
            </span>
            <span className="chip">{t(`visibility.${event.visibility}`)}</span>
            {!scheduled && <span className="chip text-danger">{t("cancelled")}</span>}
          </div>
          <h1 className="page-title">{event.title}</h1>
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <p className="flex items-start gap-2">
              <CalendarClock className="mt-0.5 size-4 text-accent" aria-hidden />
              <span>
                {format.dateTime(event.startsAt, { dateStyle: "full", timeStyle: "short" })}
                {event.endsAt && <> → {format.dateTime(event.endsAt, { timeStyle: "short" })}</>}
              </span>
            </p>
            <p className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-4 text-accent" aria-hidden />
              <span>
                {[event.locationName, event.city].filter(Boolean).join(" · ") || t("noLocation")}
                {event.address && showAddress && <span className="block text-muted">{event.address}</span>}
                {event.address && !showAddress && (
                  <span className="block text-xs text-muted">
                    <Lock className="mr-1 inline size-3" aria-hidden />
                    {t("addressHidden")}
                  </span>
                )}
              </span>
            </p>
            <p className="flex items-center gap-2">
              <Users className="size-4 text-accent" aria-hidden />
              {event.maxPlayers ? t("seats", { taken, max: event.maxPlayers }) : t("seatsOpen", { taken })}
            </p>
            <p className="flex items-center gap-2">
              <MeepleAvatar color={event.host.meepleColor} size={24} />
              {t("hostedBy")}{" "}
              <Link href={`/members/${event.host.username}`} className="link">
                {event.host.displayName}
              </Link>
            </p>
          </div>
          {event.games.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {event.games.map((g) => (
                <span key={g.gameId} className="chip">
                  🎲 {g.game.name}
                </span>
              ))}
            </div>
          )}
          {event.description && <p className="whitespace-pre-line leading-relaxed">{event.description}</p>}

          {/* Player actions */}
          {!isHost && scheduled && (
            <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
              {me?.status === "GOING" ? (
                <span className="chip-accent chip">
                  <Check className="size-3" /> {t("rsvp.youreIn")}
                </span>
              ) : me?.status === "REQUESTED" ? (
                <span className="chip">{t("rsvp.requested")}</span>
              ) : me?.status === "DECLINED" ? (
                <span className="chip text-danger">{t("rsvp.declined")}</span>
              ) : (
                <form action={rsvpAction.bind(null, event.id, "GOING")}>
                  <button className="btn btn-primary" disabled={full && !event.requiresApproval}>
                    {event.requiresApproval ? t("rsvp.ask") : full ? t("rsvp.full") : t("rsvp.join")}
                  </button>
                </form>
              )}
              {me?.status !== "MAYBE" && me?.status !== "DECLINED" && me?.status !== "GOING" && (
                <form action={rsvpAction.bind(null, event.id, "MAYBE")}>
                  <button className="btn btn-secondary">{t("rsvp.maybe")}</button>
                </form>
              )}
              {me && me.status !== "DECLINED" && (
                <form action={rsvpAction.bind(null, event.id, "LEAVE")}>
                  <button className="btn btn-ghost">{t("rsvp.leave")}</button>
                </form>
              )}
            </div>
          )}

          {/* Host tools */}
          {isHost && (
            <div className="flex flex-wrap gap-2 border-t border-line pt-4">
              <Link href={`/events/${event.id}/edit`} className="btn btn-secondary">
                <Pencil className="size-4" /> {t("edit")}
              </Link>
              <form action={setEventStatusAction.bind(null, event.id, scheduled ? "CANCELLED" : "SCHEDULED")}>
                <button className="btn btn-ghost">{scheduled ? t("cancel") : t("restore")}</button>
              </form>
              <form action={deleteEventAction.bind(null, event.id)}>
                <button className="btn btn-ghost text-danger">
                  <Trash2 className="size-4" /> {t("delete")}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      {isHost && requests.length > 0 && (
        <section className="card card-pad space-y-3">
          <h2 className="section-title">{t("requests")}</h2>
          {requests.map((a) => (
            <div key={a.id} className="flex items-center gap-3">
              <MeepleAvatar color={a.user.meepleColor} size={32} />
              <Link href={`/members/${a.user.username}`} className="flex-1 font-semibold hover:text-accent">
                {a.user.displayName}
              </Link>
              <form action={respondJoinRequestAction.bind(null, a.id, true)}>
                <button className="btn btn-primary btn-sm">
                  <Check className="size-3.5" /> {t("accept")}
                </button>
              </form>
              <form action={respondJoinRequestAction.bind(null, a.id, false)}>
                <button className="btn btn-ghost btn-sm">
                  <X className="size-3.5" /> {t("decline")}
                </button>
              </form>
            </div>
          ))}
        </section>
      )}

      <section className="card card-pad space-y-4">
        <h2 className="section-title">{t("players")}</h2>
        <div className="flex flex-wrap gap-3">
          {[{ user: event.host, host: true }, ...going.filter((a) => a.userId !== event.hostId).map((a) => ({ user: a.user, host: false }))].map(
            ({ user: p, host }) => (
              <Link
                key={p.id}
                href={`/members/${p.username}`}
                className="flex items-center gap-2 rounded-full border border-line bg-surface-2 py-1 pl-1 pr-3 text-sm hover:border-accent"
              >
                <MeepleAvatar color={p.meepleColor} size={28} />
                {p.displayName}
                {host && <span className="text-xs text-accent">★ {t("host")}</span>}
              </Link>
            ),
          )}
        </div>
        {maybe.length > 0 && (
          <p className="text-sm text-muted">
            {t("maybeList")}: {maybe.map((a) => a.user.displayName).join(", ")}
          </p>
        )}
      </section>
    </FadeIn>
  );
}
