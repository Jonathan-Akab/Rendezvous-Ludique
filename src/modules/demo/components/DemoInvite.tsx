"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { Compass, Sparkles } from "lucide-react";
import { Meeple } from "@/components/Meeple";

/** Sign-in page: the invitation to the demo, above the sign-in card — made to catch the eye. */
export function DemoInvite() {
  const t = useTranslations("landing.demoInvite");
  return (
    <Link href="/demo" className="group relative block">
      {/* soft glow that breathes behind the card */}
      <motion.span
        aria-hidden
        className="absolute -inset-1 rounded-[1.75rem] bg-[conic-gradient(from_0deg,var(--accent),#f2b705,#2b8a3e,#1c5fbf,var(--accent))] opacity-60 blur-md"
        animate={{ opacity: [0.35, 0.75, 0.35], rotate: [0, 3, 0] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
      />
      <span className="relative flex items-center gap-4 overflow-hidden rounded-3xl border-2 border-accent bg-[linear-gradient(135deg,color-mix(in_oklab,var(--accent)_22%,var(--surface)),var(--surface))] p-4 shadow-2xl transition group-hover:-translate-y-0.5">
        {/* the pawn hops, like the one that guides the tour */}
        <motion.span className="shrink-0" animate={{ y: [0, -10, 0], rotate: [0, -6, 0] }} transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}>
          <Meeple color="var(--accent)" size={64} />
        </motion.span>
        <span className="min-w-0 flex-1 space-y-1">
          <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-accent-ink">
            <Sparkles className="size-3" /> {t("badge")}
          </span>
          <span className="block font-display text-xl font-black leading-tight">{t("title")}</span>
          <span className="block text-sm text-muted">{t("text")}</span>
          <span className="mt-1 inline-flex items-center gap-1.5 text-sm font-bold text-accent">
            <Compass className="size-4 transition group-hover:rotate-45" /> {t("cta")} →
          </span>
        </span>
      </span>
    </Link>
  );
}
