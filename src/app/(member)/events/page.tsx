import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CalendarDays, List, Plus, Search } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { requireModule } from "@/lib/modules";
import { EVENT_KINDS } from "@/lib/constants";
import { NearMeButton } from "@/components/LocationFields";
import { Stagger, StaggerItem } from "@/components/Motion";
import { EmptyState } from "@/components/EmptyState";
import { listEvents, type EventFilters } from "@/modules/events/service";
import { EventCard } from "@/modules/events/components/EventCard";
import { EventCalendar, monthGrid } from "@/modules/events/components/EventCalendar";
import { getSiteSettings } from "@/lib/settings";
import { fromLocalInput, toDateInput } from "@/lib/time";

export async function generateMetadata() {
  return { title: (await getTranslations("nav"))("events") };
}

type Search = { q?: string; kind?: string; city?: string; when?: string; tab?: string; lat?: string; lng?: string; radius?: string; view?: string; month?: string; day?: string };

export default async function EventsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const [user, mod, sp, t, { timeZone }] = await Promise.all([requireUser(), requireModule("events"), searchParams, getTranslations("events"), getSiteSettings()]);
  const mine = sp.tab === "mine";
  const calendar = sp.view === "calendar";
  const today = toDateInput(new Date(), timeZone);
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : today.slice(0, 7);
  const selectedDay = /^\d{4}-\d{2}-\d{2}$/.test(sp.day ?? "") ? sp.day! : month === today.slice(0, 7) ? today : `${month}-01`;
  const grid = monthGrid(month);

  // "Near me": coordinates from the URL (browser location) or the member's profile.
  const lat = sp.lat ? Number(sp.lat) : user.latitude;
  const lng = sp.lng ? Number(sp.lng) : user.longitude;
  const radiusKm = Number(sp.radius) || Number(mod.settings.defaultRadiusKm) || 50;
  const nearActive = Boolean(sp.lat && sp.lng);
  const hasOrigin = lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng);

  const filters: EventFilters = {
    q: sp.q,
    kind: EVENT_KINDS.includes(sp.kind as never) ? sp.kind : undefined,
    city: sp.city,
    when: (["upcoming", "week", "month", "past"] as const).find((w) => w === sp.when),
    mine,
    near: nearActive && hasOrigin ? { lat: lat!, lng: lng!, radiusKm } : undefined,
    range: calendar
      ? { from: fromLocalInput(`${grid.first}T00:00`, timeZone)!, to: new Date(fromLocalInput(`${grid.last}T00:00`, timeZone)!.getTime() + 86400000) }
      : undefined,
  };
  const baseQuery = new URLSearchParams(
    Object.entries({ q: sp.q, kind: sp.kind, city: sp.city, tab: sp.tab, lat: sp.lat, lng: sp.lng, radius: sp.radius }).filter(([, v]) => v) as [string, string][],
  ).toString();
  const events = await listEvents(user.id, filters);

  const tabClass = (active: boolean) =>
    `rounded-xl px-4 py-2 text-sm font-semibold transition ${active ? "bg-accent text-accent-ink" : "text-muted hover:text-ink"}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">{t("title")}</h1>
          <p className="text-muted">{t("lead")}</p>
        </div>
        <Link href="/events/new" className="btn btn-primary">
          <Plus className="size-4" /> {t("announce")}
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="glass flex gap-1 rounded-2xl p-1">
          <Link href={`/events${calendar ? "?view=calendar" : ""}`} className={tabClass(!mine)}>
            {t("tabs.discover")}
          </Link>
          <Link href={`/events?tab=mine${calendar ? "&view=calendar" : ""}`} className={tabClass(mine)}>
            {t("tabs.mine")}
          </Link>
        </div>
        <div className="glass flex gap-1 rounded-2xl p-1">
          <Link href={`/events?${baseQuery}`} className={tabClass(!calendar)}>
            <List className="mr-1 inline size-4" /> {t("views.list")}
          </Link>
          <Link href={`/events?${baseQuery}&view=calendar`} className={tabClass(calendar)}>
            <CalendarDays className="mr-1 inline size-4" /> {t("views.calendar")}
          </Link>
        </div>
      </div>

      <form className="glass flex flex-wrap items-end gap-3 rounded-2xl p-4" role="search">
        {mine && <input type="hidden" name="tab" value="mine" />}
        {calendar && (
          <>
            <input type="hidden" name="view" value="calendar" />
            <input type="hidden" name="month" value={month} />
          </>
        )}
        {nearActive && (
          <>
            <input type="hidden" name="lat" value={sp.lat} />
            <input type="hidden" name="lng" value={sp.lng} />
          </>
        )}
        <div className="min-w-48 flex-1">
          <label className="label" htmlFor="q">
            {t("filters.search")}
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <input id="q" name="q" defaultValue={sp.q} className="input pl-9" placeholder={t("filters.searchPlaceholder")} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="kind">
            {t("filters.kind")}
          </label>
          <select id="kind" name="kind" defaultValue={sp.kind ?? ""} className="select">
            <option value="">{t("filters.allKinds")}</option>
            {EVENT_KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`kinds.${k}`)}
              </option>
            ))}
          </select>
        </div>
        <div className={calendar ? "hidden" : ""}>
          <label className="label" htmlFor="when">
            {t("filters.when")}
          </label>
          <select id="when" name="when" defaultValue={sp.when ?? "upcoming"} className="select">
            {(["upcoming", "week", "month", "past"] as const).map((w) => (
              <option key={w} value={w}>
                {t(`when.${w}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="w-36">
          <label className="label" htmlFor="city">
            {t("filters.city")}
          </label>
          <input id="city" name="city" defaultValue={sp.city} className="input" />
        </div>
        {nearActive && (
          <div className="w-28">
            <label className="label" htmlFor="radius">
              {t("filters.radius")}
            </label>
            <input id="radius" name="radius" type="number" min={1} defaultValue={radiusKm} className="input" />
          </div>
        )}
        <button className="btn btn-secondary">{t("filters.apply")}</button>
        <NearMeButton active={nearActive} />
      </form>

      {calendar ? (
        <EventCalendar events={events} month={month} selectedDay={selectedDay} today={today} timeZone={timeZone} baseQuery={baseQuery} />
      ) : events.length === 0 ? (
        <EmptyState title={t("empty.title")} text={mine ? t("empty.mine") : t("empty.discover")}>
          <Link href="/events/new" className="btn btn-primary">
            <Plus className="size-4" /> {t("announce")}
          </Link>
        </EmptyState>
      ) : (
        <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((e) => (
            <StaggerItem key={e.id}>
              <EventCard event={e} distanceKm={e.distanceKm} />
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </div>
  );
}
