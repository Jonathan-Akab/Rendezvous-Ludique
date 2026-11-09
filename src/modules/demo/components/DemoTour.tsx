"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Compass, Map as MapIcon, MessageCircleQuestion, UserPlus } from "lucide-react";
import { Popup } from "@/components/Popup";
import { GuideOverlay } from "@/modules/guide/components/GuideOverlay";

// The demo's guided tour: the pawn walks the visitor through every part of the site, opening
// each demo page in turn. Starts by itself on the first visit; "Revoir la visite" restarts it.

const OPEN_EVENT = "rl:demo-tour";
const SEEN_KEY = "rl-demo-tour";
export function openDemoTour() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}
// while the tour moves from page to page, the "a question?" nudge stays quiet
let touring = false;
export const isDemoTourActive = () => touring;

type Step = { key: string; route: string; target?: string; bullets: number };
const STEPS: Step[] = [
  { key: "welcome", route: "/demo", bullets: 3 },
  { key: "banner", route: "/demo", target: "demo-banner", bullets: 2 },
  { key: "menu", route: "/demo", target: "demo-nav", bullets: 3 },
  { key: "board", route: "/demo", target: "demo-board", bullets: 3 },
  { key: "table", route: "/demo", target: "demo-table", bullets: 3 },
  { key: "events", route: "/demo/events", target: "demo-events", bullets: 4 },
  { key: "address", route: "/demo/events/demo-e1", target: "demo-address", bullets: 4 },
  { key: "announce", route: "/demo/events/new", target: "demo-event-form", bullets: 4 },
  { key: "kallax", route: "/demo/kallax", target: "demo-kallax", bullets: 4 },
  { key: "ludo", route: "/demo/games", target: "demo-ludo", bullets: 3 },
  { key: "clock", route: "/demo/plays", target: "demo-clock", bullets: 3 },
  { key: "plays", route: "/demo/plays", target: "demo-plays", bullets: 3 },
  { key: "picker", route: "/demo/picker", target: "demo-picker", bullets: 4 },
  { key: "ai", route: "/demo/ai", target: "demo-ai", bullets: 4 },
  { key: "facebook", route: "/demo/facebook", target: "demo-facebook", bullets: 3 },
  { key: "ask", route: "/demo/facebook", target: "demo-ask", bullets: 2 },
  { key: "end", route: "/demo", bullets: 3 },
];

export function DemoTour() {
  const t = useTranslations("demo.tour");
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [index, setIndex] = useState(0);
  const step = STEPS[index];

  useEffect(() => {
    const start = () => {
      setIndex(0);
      setOpen(true);
    };
    window.addEventListener(OPEN_EVENT, start);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      // first arrival: guided tour or free exploration?
      if (!sessionStorage.getItem(SEEN_KEY)) timer = setTimeout(() => setChoosing(true), 700);
    } catch {}
    return () => {
      window.removeEventListener(OPEN_EVENT, start);
      if (timer) clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    touring = open || choosing;
  }, [open, choosing]);

  // each step opens its page
  useEffect(() => {
    if (open && step && pathname !== step.route) router.push(step.route);
  }, [open, step, pathname, router]);

  const close = useCallback(() => {
    setOpen(false);
    try {
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {}
  }, []);
  const next = useCallback(() => (index < STEPS.length - 1 ? setIndex(index + 1) : close()), [index, close]);
  const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  const explore = () => {
    setChoosing(false);
    try {
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {}
  };

  if (!step) return null;
  // wait for the step's page before pointing at something on it
  const onPage = pathname === step.route;
  return (
    <>
      <Popup open={choosing} onClose={explore} title={t("choose.title")} icon={<Compass className="size-5" />} closeLabel={t("choose.explore")}>
        <p className="text-sm text-muted">{t("choose.text")}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => {
              setChoosing(false);
              setIndex(0);
              setOpen(true);
            }}
            className="flex flex-col items-start gap-1 rounded-2xl border-2 border-accent bg-accent/10 p-3 text-left transition hover:bg-accent/20"
            autoFocus
          >
            <span className="flex items-center gap-2 font-bold text-accent">
              <Compass className="size-5" /> {t("choose.tour")}
            </span>
            <span className="text-xs text-muted">{t("choose.tourText")}</span>
          </button>
          <button type="button" onClick={explore} className="flex flex-col items-start gap-1 rounded-2xl border-2 border-line p-3 text-left transition hover:border-accent/60">
            <span className="flex items-center gap-2 font-bold">
              <MapIcon className="size-5" /> {t("choose.explore")}
            </span>
            <span className="text-xs text-muted">{t("choose.exploreText")}</span>
          </button>
        </div>
        {/* the help button stays at the bottom of every page */}
        <p className="flex items-start gap-2 rounded-xl bg-surface-2/60 px-3 py-2 text-xs text-muted">
          <MessageCircleQuestion className="mt-0.5 size-4 shrink-0 text-accent" /> {t("choose.help")}
        </p>
      </Popup>
      <GuideOverlay
        open={open}
        stepKey={step.key}
        index={index}
        total={STEPS.length}
        title={t(`steps.${step.key}.title`)}
        bullets={Array.from({ length: step.bullets }, (_, i) => t(`steps.${step.key}.b${i + 1}`))}
        target={onPage ? step.target : undefined}
        labels={{ progress: t("progress", { n: index + 1, total: STEPS.length }), skip: t("skip"), next: t("next"), previous: t("previous"), finish: t("finish") }}
        footer={
          step.key === "end" ? (
            <Link href="/register" onClick={close} className="btn btn-primary w-full">
              <UserPlus className="size-4" /> {t("signUp")}
            </Link>
          ) : undefined
        }
        onNext={next}
        onPrev={prev}
        onClose={close}
      />
    </>
  );
}
