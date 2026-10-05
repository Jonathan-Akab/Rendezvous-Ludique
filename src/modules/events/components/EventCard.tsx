import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { MapPin, Navigation, Users } from "lucide-react";
import { MeepleAvatar } from "@/components/Meeple";
import { seatsTaken, type EventWithDetails } from "../service";

export const KIND_COLORS: Record<string, string> = {
  GAME_NIGHT: "#d9480f",
  BOARD_GAME_EVENT: "#2f6b4f",
  HOME_GAME: "#d9480f", // former kind, now a game night
  TOURNAMENT: "#6741d9",
  CONVENTION: "#1c5fbf",
};

/** Event as a game-card: a coloured date "tile" plus details. */
export async function EventCard({ event, distanceKm }: { event: EventWithDetails; distanceKm?: number | null }) {
  const [t, format] = await Promise.all([getTranslations("events"), getFormatter()]);
  const taken = seatsTaken(event);
  const color = KIND_COLORS[event.kind] ?? "var(--accent)";
  const cancelled = event.status === "CANCELLED";

  return (
    <Link
      href={`/events/${event.id}`}
      className={`card group flex h-full gap-4 p-4 transition hover:-translate-y-0.5 hover:border-accent ${cancelled ? "opacity-60" : ""}`}
    >
      <div
        className="flex w-16 shrink-0 flex-col items-center justify-center rounded-xl text-white shadow-card"
        style={{ background: color }}
      >
        <span className="text-[11px] font-bold uppercase tracking-wider opacity-90">
          {format.dateTime(event.startsAt, { month: "short" })}
        </span>
        <span className="font-display text-3xl font-black leading-none">{format.dateTime(event.startsAt, { day: "numeric" })}</span>
        <span className="text-[11px] font-semibold opacity-90">{format.dateTime(event.startsAt, { weekday: "short" })}</span>
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="chip border-transparent text-white" style={{ background: color }}>
            {t(`kinds.${event.kind}`)}
          </span>
          {cancelled && <span className="chip text-danger">{t("cancelled")}</span>}
          {event.visibility === "FRIENDS" && <span className="chip">{t("visibility.FRIENDS")}</span>}
        </div>
        <h3 className="truncate font-display text-lg font-bold group-hover:text-accent">{event.title}</h3>
        <p className="text-sm text-muted">
          {format.dateTime(event.startsAt, { hour: "2-digit", minute: "2-digit" })}
          {event.city && (
            <>
              {" · "}
              <MapPin className="inline size-3.5" aria-hidden /> {event.city}
            </>
          )}
          {distanceKm != null && (
            <>
              {" · "}
              <Navigation className="inline size-3.5" aria-hidden /> {t("distance", { km: Math.round(distanceKm) })}
            </>
          )}
        </p>
        {event.games.length > 0 && (
          <p className="truncate text-xs text-muted">🎲 {event.games.map((g) => g.game.name).join(", ")}</p>
        )}
        <div className="flex items-center justify-between pt-1">
          <span className="flex items-center gap-2 text-xs text-muted">
            <MeepleAvatar color={event.host.meepleColor} size={22} /> {event.host.displayName}
          </span>
          <span className="flex items-center gap-1 text-xs font-semibold">
            <Users className="size-3.5" aria-hidden />
            {event.maxPlayers ? `${taken}/${event.maxPlayers}` : taken}
          </span>
        </div>
      </div>
    </Link>
  );
}
