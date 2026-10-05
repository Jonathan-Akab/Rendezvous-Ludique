"use client";

import { useEffect, useState, useTransition } from "react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { Check, ImageOff, ImagePlus, LoaderCircle } from "lucide-react";
import { setKallaxImageAction } from "@/modules/kallax/actions";

type Result = { url: string; thumb: string; title: string; source: string };

/** Box picture suggestions for a game; clicking one makes it the game's picture. */
/** `kallaxGameId`: the Kallax record that receives the chosen picture. */
export function ImageSuggestions({ kallaxGameId, name, onChosen }: { kallaxGameId: string; name: string; onChosen?: () => void }) {
  const t = useTranslations("games.images");
  const [results, setResults] = useState<Result[] | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    let alive = true;
    fetch(`/api/images/search?q=${encodeURIComponent(name)}`)
      .then((r) => r.json())
      .then((d) => alive && setResults(d.results ?? []))
      .catch(() => alive && setResults([]));
    return () => {
      alive = false;
    };
  }, [name]);

  const choose = (r: Result) =>
    start(async () => {
      const res = await setKallaxImageAction(kallaxGameId, r.url);
      if (res.ok) {
        setChosen(r.url);
        onChosen?.();
      }
    });

  if (results === null) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted">
        <LoaderCircle className="size-4 animate-spin" /> {t("searching", { name })}
      </p>
    );
  }
  if (results.length === 0) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted">
        <ImageOff className="size-4" /> {t("none")}
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">{chosen ? t("chosen") : t("pick", { name })}</p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {results.slice(0, 12).map((r) => (
          <motion.button
            key={r.url}
            type="button"
            whileHover={{ y: -3 }}
            disabled={pending}
            onClick={() => choose(r)}
            title={`${r.title} — ${r.source}`}
            className={`relative aspect-square overflow-hidden rounded-xl border-2 bg-surface-2 transition ${chosen === r.url ? "border-accent" : "border-transparent hover:border-line"}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={r.thumb} alt={r.title} className="h-full w-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
            {chosen === r.url && (
              <span className="absolute inset-0 grid place-items-center bg-accent/40">
                <Check className="size-7 text-white" />
              </span>
            )}
          </motion.button>
        ))}
      </div>
      <p className="text-[11px] text-muted">{t("note", { source: results[0].source })}</p>
    </div>
  );
}

/** "Find a picture" button that opens the suggestions on demand. */
export function FindImage({ kallaxGameId, name, label }: { kallaxGameId: string; name: string; label: string }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>
        <ImagePlus className="size-4" /> {label}
      </button>
    );
  }
  return (
    <div className="w-full rounded-2xl border border-dashed border-accent/50 p-3">
      <ImageSuggestions kallaxGameId={kallaxGameId} name={name} />
    </div>
  );
}