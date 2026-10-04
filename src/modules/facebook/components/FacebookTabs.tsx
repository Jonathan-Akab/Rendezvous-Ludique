"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { ExternalLink, MapPin, Users2 } from "lucide-react";

export type FbGroup = { id: string; name: string; url: string; description: string | null; region: string | null };

// Facebook doesn't allow groups to be embedded in other sites, so each tab presents the
// group and opens it on Facebook.
export function FacebookTabs({ groups }: { groups: FbGroup[] }) {
  const t = useTranslations("facebook");
  const [active, setActive] = useState(groups[0]?.id);
  const group = groups.find((g) => g.id === active) ?? groups[0];

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label={t("title")} className="glass flex gap-1 overflow-x-auto rounded-2xl p-1">
        {groups.map((g) => (
          <button
            key={g.id}
            role="tab"
            aria-selected={g.id === group.id}
            aria-controls={`fb-panel-${g.id}`}
            onClick={() => setActive(g.id)}
            className={`relative shrink-0 rounded-xl px-4 py-2 text-sm font-semibold transition ${g.id === group.id ? "text-white" : "text-muted hover:text-ink"}`}
          >
            {g.id === group.id && <motion.span layoutId="fb-tab" className="absolute inset-0 rounded-xl bg-[#1877f2]" transition={{ type: "spring", bounce: 0.2, duration: 0.45 }} />}
            <span className="relative">{g.name}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.section
          key={group.id}
          id={`fb-panel-${group.id}`}
          role="tabpanel"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25 }}
          className="relative overflow-hidden rounded-3xl border border-line/70"
        >
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_0%,#1877f2_0%,transparent_55%),radial-gradient(circle_at_100%_100%,var(--accent)_0%,transparent_50%)] opacity-25" />
          <div className="glass flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:p-10">
            <span className="grid size-24 shrink-0 place-items-center rounded-3xl bg-[#1877f2] text-white shadow-[0_15px_40px_-15px_#1877f2]">
              <Users2 className="size-12" />
            </span>
            <div className="min-w-0 flex-1 space-y-3">
              <h2 className="font-display text-3xl font-black">{group.name}</h2>
              {group.region && (
                <p className="flex items-center gap-1.5 text-sm text-muted">
                  <MapPin className="size-4" /> {group.region}
                </p>
              )}
              {group.description && <p className="whitespace-pre-line leading-relaxed">{group.description}</p>}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <a href={group.url} target="_blank" rel="noopener noreferrer" className="btn bg-[#1877f2] text-white shadow-[0_10px_30px_-10px_#1877f2] hover:brightness-110">
                  {t("open")} <ExternalLink className="size-4" />
                </a>
                <span className="truncate text-xs text-muted">{group.url.replace(/^https:\/\/(www\.)?/, "")}</span>
              </div>
            </div>
          </div>
        </motion.section>
      </AnimatePresence>
      <p className="text-xs text-muted">{t("note")}</p>
    </div>
  );
}
