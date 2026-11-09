import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { CalendarPlus, LibraryBig, Megaphone, NotebookPen, Pin, Sparkles } from "lucide-react";
import { Meeple } from "@/components/Meeple";
import { EventCard } from "@/modules/events/components/EventCard";
import { DEMO_ME, demoEvents, demoMessages } from "@/modules/demo/data";

export default async function DemoHome() {
  const [t, locale] = await Promise.all([getTranslations("demo"), getLocale()]);
  const lang = locale === "en" ? "en" : "fr";
  const events = demoEvents(lang);
  const quick = [
    { href: "/demo/events/new", label: t("quick.announce"), icon: CalendarPlus, color: "#2b8a3e" },
    { href: "/demo/plays", label: t("quick.log"), icon: NotebookPen, color: "#d9480f" },
    { href: "/demo/kallax", label: t("quick.kallax"), icon: LibraryBig, color: "#1c5fbf" },
    { href: "/demo/ai", label: t("quick.ai"), icon: Sparkles, color: "#0c8599" },
  ];
  return (
    <div className="space-y-6">
      <section className="card flex flex-wrap items-center gap-5 p-6 sm:p-8">
        <span className="grid size-16 place-items-center rounded-3xl bg-surface-2">
          <Meeple color={DEMO_ME.meepleColor} size={48} />
        </span>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">{t("home.kicker")}</p>
          <h1 className="font-display text-4xl font-black">{t("home.hello", { name: DEMO_ME.displayName })}</h1>
          <p className="text-muted">{t("home.lead")}</p>
        </div>
      </section>

      <section data-guide="demo-board" className="card card-pad space-y-3">
        <h2 className="section-title flex items-center gap-2">
          <Megaphone className="size-5 text-accent" /> {t("home.board")}
        </h2>
        <ul className="space-y-3">
          {demoMessages(lang).map((m) => (
            <li key={m.id} className={`rounded-2xl border p-4 ${m.pinned ? "border-accent/60 bg-accent/10" : "border-line/70 bg-surface-2/40"}`}>
              <div className="mb-2 flex items-center gap-2 text-xs text-muted">
                <Meeple color={m.color} size={18} />
                <span className="font-semibold text-ink">{m.author}</span>
                <span>· {t("home.hoursAgo", { n: m.ago })}</span>
                {m.pinned && (
                  <span className="chip chip-accent gap-1 px-2 py-0 text-[10px]">
                    <Pin className="size-3 fill-current" /> {t("home.pinned")}
                  </span>
                )}
              </div>
              <p className="text-sm leading-relaxed">{m.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {quick.map((q) => (
          <Link key={q.href} href={q.href} className="card-hover group flex items-center gap-3 rounded-2xl p-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl text-white" style={{ background: q.color }}>
              <q.icon className="size-5" />
            </span>
            <span className="text-sm font-bold">{q.label}</span>
          </Link>
        ))}
      </div>

      <section data-guide="demo-table" className="space-y-3">
        <h2 className="section-title">{t("home.table")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {events.slice(0, 2).map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
        </div>
      </section>
    </div>
  );
}
