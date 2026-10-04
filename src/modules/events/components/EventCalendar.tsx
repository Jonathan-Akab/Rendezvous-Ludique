import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import { toDateInput } from "@/lib/time";
import { MeepleAvatar } from "@/components/Meeple";
import { KIND_COLORS } from "./EventCard";
import type { EventWithDetails } from "../service";

/** Calendar-date helpers (time-zone free: dates are plain YYYY-MM-DD strings). */
export function monthGrid(month: string) {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7; // weeks start on Monday
  const start = new Date(first.getTime() - offset * 86400000);
  const days = Array.from({ length: 42 }, (_, i) => new Date(start.getTime() + i * 86400000).toISOString().slice(0, 10));
  return { days, first: days[0], last: days[41] };
}

export function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

export async function EventCalendar({
  events,
  month,
  selectedDay,
  today,
  timeZone,
  baseQuery,
}: {
  events: EventWithDetails[];
  month: string;
  selectedDay: string;
  today: string;
  timeZone: string;
  baseQuery: string;
}) {
  const [t, format] = await Promise.all([getTranslations("events"), getFormatter()]);
  const { days } = monthGrid(month);
  const byDay = new Map<string, EventWithDetails[]>();
  for (const e of events) {
    const k = toDateInput(e.startsAt, timeZone);
    byDay.set(k, [...(byDay.get(k) ?? []), e]);
  }
  const href = (params: Record<string, string>) => `/events?${new URLSearchParams({ ...Object.fromEntries(new URLSearchParams(baseQuery)), view: "calendar", ...params })}`;
  const monthDate = new Date(`${month}-15T12:00:00Z`);
  const weekdays = days.slice(0, 7).map((d) => format.dateTime(new Date(`${d}T12:00:00Z`), { weekday: "short", timeZone: "UTC" }));
  const dayEvents = byDay.get(selectedDay) ?? [];

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
      <div className="glass overflow-hidden rounded-3xl">
        <div className="flex items-center justify-between border-b border-line/60 px-4 py-3">
          <Link href={href({ month: shiftMonth(month, -1) })} className="btn btn-ghost btn-sm" aria-label={t("calendar.prev")}>
            <ChevronLeft className="size-4" />
          </Link>
          <div className="text-center">
            <p className="font-display text-2xl font-black capitalize">{format.dateTime(monthDate, { month: "long", year: "numeric", timeZone: "UTC" })}</p>
            <Link href={href({ month: today.slice(0, 7), day: today })} className="text-xs font-semibold text-accent">
              {t("calendar.today")}
            </Link>
          </div>
          <Link href={href({ month: shiftMonth(month, 1) })} className="btn btn-ghost btn-sm" aria-label={t("calendar.next")}>
            <ChevronRight className="size-4" />
          </Link>
        </div>
        <div className="grid grid-cols-7 border-b border-line/60 text-center text-[11px] font-bold uppercase tracking-wider text-muted">
          {weekdays.map((w) => (
            <div key={w} className="py-2">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d) => {
            const inMonth = d.startsWith(month);
            const list = byDay.get(d) ?? [];
            const isToday = d === today;
            const isSel = d === selectedDay;
            return (
              <Link
                key={d}
                href={href({ month, day: d })}
                scroll={false}
                className={`group relative min-h-24 border-b border-r border-line/40 p-1.5 transition hover:bg-accent/5 sm:min-h-28 ${
                  inMonth ? "" : "opacity-40"
                } ${isSel ? "bg-accent/10 ring-2 ring-inset ring-accent" : ""}`}
              >
                <span
                  className={`inline-grid size-7 place-items-center rounded-full text-xs font-bold ${
                    isToday ? "bg-accent text-accent-ink shadow-[0_0_16px_var(--accent)]" : ""
                  }`}
                >
                  {Number(d.slice(8))}
                </span>
                <div className="mt-1 space-y-1">
                  {list.slice(0, 3).map((e) => (
                    <span
                      key={e.id}
                      className={`block truncate rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-white sm:text-[11px] ${e.status === "CANCELLED" ? "line-through opacity-60" : ""}`}
                      style={{ background: KIND_COLORS[e.kind] }}
                      title={e.title}
                    >
                      <span className="hidden sm:inline">{format.dateTime(e.startsAt, { hour: "2-digit", minute: "2-digit" })} </span>
                      {e.title}
                    </span>
                  ))}
                  {list.length > 3 && <span className="block text-[10px] font-semibold text-muted">+{list.length - 3}</span>}
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      <aside className="space-y-3">
        <h3 className="section-title capitalize">
          {format.dateTime(new Date(`${selectedDay}T12:00:00Z`), { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}
        </h3>
        {dayEvents.length === 0 ? (
          <p className="glass rounded-2xl p-4 text-sm text-muted">{t("calendar.nothing")}</p>
        ) : (
          dayEvents.map((e) => (
            <Link key={e.id} href={`/events/${e.id}`} className="card-hover block rounded-2xl p-4">
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full" style={{ background: KIND_COLORS[e.kind] }} />
                <span className="text-xs font-semibold text-muted">
                  {format.dateTime(e.startsAt, { hour: "2-digit", minute: "2-digit" })} · {t(`kinds.${e.kind}`)}
                </span>
              </div>
              <p className="mt-1 font-display text-lg font-bold">{e.title}</p>
              <div className="mt-1 flex items-center justify-between text-xs text-muted">
                <span className="flex items-center gap-1.5">
                  <MeepleAvatar color={e.host.meepleColor} size={20} /> {e.host.displayName}
                </span>
                {e.city && (
                  <span className="flex items-center gap-1">
                    <MapPin className="size-3" /> {e.city}
                  </span>
                )}
              </div>
            </Link>
          ))
        )}
      </aside>
    </div>
  );
}
