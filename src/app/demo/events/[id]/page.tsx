import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft, CalendarDays, MapPin, Users } from "lucide-react";
import { MeepleAvatar } from "@/components/Meeple";
import { KIND_COLORS } from "@/modules/events/components/EventCard";
import { seatsTaken } from "@/modules/events/service";
import { DemoJoinButton } from "@/modules/demo/components/DemoJoinButton";
import { demoEvent } from "@/modules/demo/data";

export default async function DemoEventPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, t, te, format, locale] = await Promise.all([params, getTranslations("demo"), getTranslations("events"), getFormatter(), getLocale()]);
  const found = demoEvent(locale === "en" ? "en" : "fr", id);
  if (!found) notFound();
  const { event: e, description, address } = found;
  const color = KIND_COLORS[e.kind] ?? "var(--accent)";
  const taken = seatsTaken(e);
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/demo/events" className="inline-flex items-center gap-1 text-sm text-muted hover:text-accent">
        <ArrowLeft className="size-4" /> {t("nav.events")}
      </Link>
      <article className="card card-pad space-y-4">
        <span className="chip border-transparent text-white" style={{ background: color }}>
          {te(`kinds.${e.kind}`)}
        </span>
        <h1 className="page-title">{e.title}</h1>
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <p className="flex items-center gap-2">
            <CalendarDays className="size-4 text-accent" /> {format.dateTime(e.startsAt, { dateStyle: "full", timeStyle: "short" })}
          </p>
          <p className="flex items-center gap-2">
            <MapPin className="size-4 text-accent" /> {e.city}
          </p>
          <p className="flex items-center gap-2">
            <Users className="size-4 text-accent" /> {e.maxPlayers ? te("seats", { taken, max: e.maxPlayers }) : te("seatsOpen", { taken })}
          </p>
          <p className="flex items-center gap-2">
            <MeepleAvatar color={e.host.meepleColor} size={20} /> {te("hostedBy")} {e.host.displayName}
          </p>
        </div>
        <p className="leading-relaxed">{description}</p>
        <div className="flex flex-wrap gap-2">
          {e.games.map((g) => (
            <span key={g.gameId} className="chip">
              🎲 {g.game.name}
            </span>
          ))}
        </div>
        <DemoJoinButton label={e.requiresApproval ? te("rsvp.ask") : te("rsvp.join")} approval={e.requiresApproval} address={address} />
      </article>
    </div>
  );
}
