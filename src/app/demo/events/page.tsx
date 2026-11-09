import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { CalendarPlus, MapPin } from "lucide-react";
import { EventCard } from "@/modules/events/components/EventCard";
import { demoEvents } from "@/modules/demo/data";

export default async function DemoEvents() {
  const [t, te, locale] = await Promise.all([getTranslations("demo"), getTranslations("events"), getLocale()]);
  const events = demoEvents(locale === "en" ? "en" : "fr");
  const km = [4, 11, 38, 17];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">{t("events.title")}</h1>
          <p className="text-muted">{t("events.lead")}</p>
        </div>
        <Link href="/demo/events/new" className="btn btn-primary">
          <CalendarPlus className="size-4" /> {t("quick.announce")}
        </Link>
      </div>
      <div className="card flex flex-wrap items-center gap-2 p-3 text-sm">
        <MapPin className="size-4 text-accent" />
        <span className="font-semibold">{t("events.near")}</span>
        {(["GAME_NIGHT", "BOARD_GAME_EVENT", "TOURNAMENT", "CONVENTION"] as const).map((k) => (
          <span key={k} className="chip">
            {te(`kinds.${k}`)}
          </span>
        ))}
      </div>
      <div data-guide="demo-events" className="grid gap-4 sm:grid-cols-2">
        {events.map((e, i) => (
          <EventCard key={e.id} event={e} distanceKm={km[i]} />
        ))}
      </div>
    </div>
  );
}
