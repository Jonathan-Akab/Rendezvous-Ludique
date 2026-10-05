import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight, Bell, CalendarPlus, Dices, LibraryBig, Sparkles, UserPlus } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { PlayInProgress } from "@/modules/plays/components/PlayInProgress";
import { getModuleStates } from "@/lib/modules";
import { db } from "@/lib/db";
import { FadeIn, Stagger, StaggerItem } from "@/components/Motion";
import { Meeple } from "@/components/Meeple";
import { ThemePicture } from "@/components/ThemePicture";
import { getSiteSettings } from "@/lib/settings";
import { listEvents } from "@/modules/events/service";
import { EventCard } from "@/modules/events/components/EventCard";
import { unreadBazaarCount } from "@/modules/bazaar/service";

export async function generateMetadata() {
  return { title: (await getTranslations("nav"))("home") };
}

export default async function HomePage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const [user, modules, sp, t, settings] = await Promise.all([requireUser(), getModuleStates(), searchParams, getTranslations("home"), getSiteSettings()]);
  const ev = modules.events;

  const [mine, nearby, friendReqs, playReqs, libraryInvites, joinReqs, bazaarUnread] = await Promise.all([
    ev.enabled ? listEvents(user.id, { mine: true }) : Promise.resolve([]),
    ev.enabled
      ? listEvents(user.id, {
          near:
            user.latitude != null && user.longitude != null
              ? { lat: user.latitude, lng: user.longitude, radiusKm: Number(ev.settings.defaultRadiusKm) || 50 }
              : undefined,
        })
      : Promise.resolve([]),
    modules.friends.enabled ? db.friendship.count({ where: { addresseeId: user.id, status: "PENDING" } }) : 0,
    modules.plays.enabled ? db.playParticipant.count({ where: { userId: user.id, status: "PENDING" } }) : 0,
    modules.kallax.enabled ? db.libraryMember.count({ where: { userId: user.id, status: "PENDING" } }) : 0,
    ev.enabled ? db.eventAttendee.count({ where: { status: "REQUESTED", event: { hostId: user.id } } }) : 0,
    modules.bazaar.enabled ? unreadBazaarCount(user.id) : 0,
  ]);

  const todo = [
    { count: friendReqs, href: "/friends", label: t("todo.friends", { count: friendReqs }) },
    { count: playReqs, href: "/plays", label: t("todo.plays", { count: playReqs }) },
    { count: libraryInvites, href: "/kallax", label: t("todo.kallax", { count: libraryInvites }) },
    { count: joinReqs, href: "/events?tab=mine", label: t("todo.joinRequests", { count: joinReqs }) },
    { count: bazaarUnread, href: "/bazaar?tab=mine", label: t("todo.bazaar", { count: bazaarUnread }) },
  ].filter((x) => x.count > 0);

  const quick = [
    ev.enabled && { href: "/events/new", icon: CalendarPlus, label: t("quick.announce"), color: "#2f6b4f" },
    modules.plays.enabled && { href: "/plays/new", icon: Dices, label: t("quick.log"), color: "#d9480f" },
    modules.kallax.enabled && { href: "/kallax", icon: LibraryBig, label: t("quick.kallax"), color: "#1c5fbf" },
    modules.ai.enabled && { href: "/ai", icon: Sparkles, label: t("quick.ai"), color: "#0c8599" },
    modules.friends.enabled && { href: "/friends", icon: UserPlus, label: t("quick.friends"), color: "#6741d9" },
  ].filter(Boolean) as { href: string; icon: typeof Dices; label: string; color: string }[];

  const mineIds = new Set(mine.map((e) => e.id));
  const discover = nearby.filter((e) => !mineIds.has(e.id)).slice(0, 6);

  return (
    <div className="space-y-10">
      <FadeIn className="relative overflow-hidden rounded-[2rem] border border-white/10 shadow-[0_30px_80px_-30px_rgb(0_0_0/0.6)]">
        <ThemePicture theme={user.theme} images={settings.themeImages} className="absolute inset-0 h-full w-full scale-105" />
        <div className="absolute inset-0 bg-gradient-to-r from-[color-mix(in_oklab,var(--bg)_92%,transparent)] via-[color-mix(in_oklab,var(--bg)_65%,transparent)] to-transparent" />
        <div className="relative flex min-h-56 flex-wrap items-center gap-5 p-6 sm:p-10">
          <div className="grid size-20 place-items-center rounded-3xl bg-surface/70 shadow-card backdrop-blur">
            <Meeple color={user.meepleColor} size={60} />
          </div>
          <div className="max-w-lg">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-accent">{sp.welcome ? t("welcomeNew") : t("welcomeBack")}</p>
            <h1 className="font-display text-4xl font-black tracking-tight sm:text-5xl">
              {t("helloPrefix")} <span className="text-gradient">{user.displayName}</span>
            </h1>
            <p className="mt-1 text-muted">{t("heroLead")}</p>
          </div>
        </div>
      </FadeIn>

      {/* a play started and not saved yet */}
      {modules.plays.enabled && <PlayInProgress userId={user.id} />}

      {todo.length > 0 && (
        <FadeIn delay={0.1} className="card border-accent/50 p-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-bold">
            <Bell className="size-4 text-accent" /> {t("todo.title")}
          </p>
          <ul className="flex flex-wrap gap-2">
            {todo.map((x) => (
              <li key={x.href}>
                <Link href={x.href} className="chip-accent chip py-1 hover:brightness-110">
                  {x.label} <ArrowRight className="size-3" />
                </Link>
              </li>
            ))}
          </ul>
        </FadeIn>
      )}

      <Stagger className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {quick.map((q) => (
          <StaggerItem key={q.href}>
            <Link href={q.href} className="card-hover group flex h-full items-center gap-3 rounded-2xl p-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl text-white shadow-[0_8px_20px_-8px_currentColor] transition group-hover:rotate-[-8deg] group-hover:scale-110" style={{ background: q.color }}>
                <q.icon className="size-5" />
              </span>
              <span className="text-sm font-bold">{q.label}</span>
            </Link>
          </StaggerItem>
        ))}
      </Stagger>

      {ev.enabled && (
        <>
          <section className="space-y-3">
            <div className="flex items-end justify-between">
              <h2 className="section-title">{t("myTable")}</h2>
              <Link href="/events?tab=mine" className="link text-sm">
                {t("seeAll")}
              </Link>
            </div>
            {mine.length === 0 ? (
              <p className="card p-5 text-sm text-muted">{t("noMine")}</p>
            ) : (
              <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {mine.slice(0, 3).map((e) => (
                  <StaggerItem key={e.id}>
                    <EventCard event={e} />
                  </StaggerItem>
                ))}
              </Stagger>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-end justify-between">
              <h2 className="section-title">{user.latitude != null ? t("nearYou") : t("upcoming")}</h2>
              <Link href="/events" className="link text-sm">
                {t("seeAll")}
              </Link>
            </div>
            {user.latitude == null && (
              <p className="text-xs text-muted">
                {t("setLocation")}{" "}
                <Link href="/settings" className="link">
                  {t("settingsLink")}
                </Link>
              </p>
            )}
            {discover.length === 0 ? (
              <p className="card p-5 text-sm text-muted">{t("noNearby")}</p>
            ) : (
              <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {discover.map((e) => (
                  <StaggerItem key={e.id}>
                    <EventCard event={e} distanceKm={e.distanceKm} />
                  </StaggerItem>
                ))}
              </Stagger>
            )}
          </section>
        </>
      )}
    </div>
  );
}
