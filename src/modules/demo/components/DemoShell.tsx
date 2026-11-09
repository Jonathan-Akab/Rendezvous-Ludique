"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { Compass, LogIn, MessageCircleQuestion, UserPlus } from "lucide-react";
import { Popup } from "@/components/Popup";
import { openDemoAsk } from "./DemoAsk";
import { ModuleIcon } from "@/components/icons";
import { Meeple } from "@/components/Meeple";
import { isDemoTourActive, openDemoTour } from "./DemoTour";

export const DEMO_NAV = [
  { href: "/demo", key: "home", icon: "House" },
  { href: "/demo/events", key: "events", icon: "CalendarDays" },
  { href: "/demo/kallax", key: "kallax", icon: "LibraryBig" },
  { href: "/demo/games", key: "games", icon: "Boxes" },
  { href: "/demo/plays", key: "plays", icon: "Dices" },
  { href: "/demo/picker", key: "picker", icon: "Dices" },
  { href: "/demo/ai", key: "ai", icon: "Sparkles" },
  { href: "/demo/facebook", key: "facebook", icon: "Facebook" },
] as const;

const active = (pathname: string, href: string) => (href === "/demo" ? pathname === "/demo" : pathname === href || pathname.startsWith(`${href}/`));
/** Links the demo may follow: its own pages, sign-in / sign-up, and other websites. */
const allowed = (href: string) => !href.startsWith("/") || href.startsWith("/demo") || href === "/" || href.startsWith("/register") || href.startsWith("/#");

/** A members' page shown by a real component (event card, shelf…) → its demo version, if any. */
function demoVersion(href: string) {
  const path = href.split(/[?#]/)[0];
  const exact: Record<string, string> = { "/home": "/demo", "/events": "/demo/events", "/events/new": "/demo/events/new", "/kallax": "/demo/kallax", "/games": "/demo/games", "/plays": "/demo/plays", "/plays/new": "/demo/plays", "/picker": "/demo/picker", "/ai": "/demo/ai", "/facebook": "/demo/facebook" };
  if (exact[path]) return exact[path];
  const event = path.match(/^\/events\/(demo-[\w-]+)$/);
  if (event) return `/demo/events/${event[1]}`;
  const game = path.match(/^\/(?:games|kallax)\/(?:demo-k-)?(g-[\w-]+)$/);
  if (game) return `/demo/games/${game[1]}`;
  return null;
}

const VIEWS_KEY = "rl-demo-views";
const NUDGE_EVERY = 5; // pages explored between two "a question?" popups

export function DemoShell({ siteName, children }: { siteName: string; children: ReactNode }) {
  const t = useTranslations("demo");
  const pathname = usePathname();
  const router = useRouter();
  const [notice, setNotice] = useState(false);
  const [nudge, setNudge] = useState(false);

  // exploring on their own: every few pages, offer help or an account
  useEffect(() => {
    if (isDemoTourActive()) return;
    try {
      const views = Number(sessionStorage.getItem(VIEWS_KEY) ?? 0) + 1;
      sessionStorage.setItem(VIEWS_KEY, String(views));
      if (views % NUDGE_EVERY === 0) setNudge(true);
    } catch {}
  }, [pathname]);

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(false), 4500);
    return () => clearTimeout(id);
  }, [notice]);

  return (
    <div className="grain min-h-dvh">
      <div className="aurora" aria-hidden>
        <span />
        <span />
        <span />
      </div>

      {/* always visible: this is not real */}
      <div data-guide="demo-banner" className="sticky top-0 z-50 border-b border-[#e8a90c]/60 bg-[#ffd43b] px-3 py-2 text-[#3d2a00] shadow-lg">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2">
          <p className="min-w-0 flex-1 text-sm">
            <span className="font-black uppercase tracking-wider">🎲 {t("banner.title")}</span> <span className="hidden sm:inline">— {t("banner.text")}</span>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={openDemoTour} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold hover:bg-black/10">
              <Compass className="size-4" /> <span className="hidden sm:inline">{t("banner.tour")}</span>
            </button>
            <Link href="/" className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold hover:bg-black/10">
              <LogIn className="size-4" /> <span className="hidden sm:inline">{t("banner.signIn")}</span>
            </Link>
            <Link href="/register" className="inline-flex items-center gap-1.5 rounded-lg bg-[#3d2a00] px-3 py-1.5 text-xs font-bold text-[#ffd43b] hover:brightness-125">
              <UserPlus className="size-4" /> {t("banner.signUp")}
            </Link>
          </div>
        </div>
      </div>

      <div className="relative mx-auto flex max-w-7xl gap-6 px-3 py-4 lg:px-6">
        {/* menu: a column on large screens, a scrolling row on phones */}
        <aside className="glass sticky top-16 hidden h-fit w-56 shrink-0 rounded-3xl p-3 lg:block">
          <div className="flex items-center gap-2 px-2 pb-4 pt-1">
            <Meeple color="var(--accent)" size={30} />
            <span className="font-display text-base font-black leading-tight">{siteName}</span>
          </div>
          <nav data-guide="demo-nav" className="flex flex-col gap-1">
            {DEMO_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition ${active(pathname, item.href) ? "bg-accent text-accent-ink" : "text-muted hover:bg-surface-2 hover:text-ink"}`}
              >
                <ModuleIcon name={item.icon} className="size-4.5" />
                {t(`nav.${item.key}`)}
              </Link>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 flex-1 space-y-4">
          <nav data-guide="demo-nav" className="glass -mx-1 flex gap-1 overflow-x-auto rounded-2xl p-1 lg:hidden">
            {DEMO_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold ${active(pathname, item.href) ? "bg-accent text-accent-ink" : "text-muted"}`}
              >
                <ModuleIcon name={item.icon} className="size-4" />
                {t(`nav.${item.key}`)}
              </Link>
            ))}
          </nav>

          {/* links to members' pages stay inside the demo */}
          <main
            onClickCapture={(e) => {
              const a = (e.target as HTMLElement).closest("a");
              const href = a?.getAttribute("href");
              if (!a || !href || a.target === "_blank" || allowed(href)) return;
              e.preventDefault();
              e.stopPropagation();
              const target = demoVersion(href);
              if (target) router.push(target);
              else setNotice(true);
            }}
          >
            {children}
          </main>
        </div>
      </div>

      <Popup open={nudge} onClose={() => setNudge(false)} title={t("nudge.title")} icon={<MessageCircleQuestion className="size-5" />} closeLabel={t("nudge.keepGoing")}>
        <p className="text-sm text-muted">{t("nudge.text")}</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            onClick={() => {
              setNudge(false);
              openDemoAsk();
            }}
            className="btn btn-secondary"
          >
            <MessageCircleQuestion className="size-4" /> {t("nudge.ask")}
          </button>
          <Link href="/register" className="btn btn-primary">
            <UserPlus className="size-4" /> {t("banner.signUp")}
          </Link>
          <button type="button" onClick={() => setNudge(false)} className="btn btn-ghost">
            {t("nudge.keepGoing")}
          </button>
        </div>
      </Popup>

      <AnimatePresence>
        {notice && (
          <motion.div
            role="status"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="card fixed inset-x-3 bottom-20 z-[60] mx-auto max-w-md p-4 text-sm shadow-2xl"
          >
            <p className="font-semibold">{t("blocked.title")}</p>
            <p className="text-muted">{t("blocked.text")}</p>
            <Link href="/register" className="btn btn-primary btn-sm mt-3">
              <UserPlus className="size-4" /> {t("banner.signUp")}
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
