"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { Check, ImageOff, ImagePlus, LoaderCircle, Upload, X } from "lucide-react";
import { shrinkImage } from "@/lib/shrinkImage";
import { setKallaxImageAction, uploadKallaxCoverAction } from "@/modules/kallax/actions";

type Result = { url: string; thumb: string; title: string; source: string };

const fetchResults = (name: string, ai: boolean): Promise<Result[]> =>
  fetch(`/api/images/search?q=${encodeURIComponent(name)}${ai ? "&ai=1" : ""}`)
    .then((r) => r.json())
    .then((d) => (d.results ?? []) as Result[])
    .catch(() => []);

/**
 * Box picture suggestions for a game. Free sources answer at once; Claude then searches the web
 * for more. Clicking a picture only selects it: the member confirms with "Use this picture" or cancels.
 * `kallaxGameId`: the Kallax record that receives the chosen picture.
 */
export function ImageSuggestions({ kallaxGameId, name, onChosen, onCancel }: { kallaxGameId: string; name: string; onChosen?: () => void; onCancel?: () => void }) {
  const t = useTranslations("games.images");
  const router = useRouter();
  const [results, setResults] = useState<Result[] | null>(null);
  const [deep, setDeep] = useState(true); // Claude's web search still running
  const [selected, setSelected] = useState<Result | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    let alive = true;
    setResults(null);
    setDeep(true);
    // Claude's picks come first: they are the most likely to be the right box.
    const merge = (more: Result[], first: boolean) =>
      setResults((cur) => {
        const all = first ? [...more, ...(cur ?? [])] : [...(cur ?? []), ...more];
        const seen = new Set<string>();
        return all.filter((r) => !seen.has(r.url) && seen.add(r.url));
      });
    fetchResults(name, false).then((r) => alive && merge(r, false));
    fetchResults(name, true).then((r) => {
      if (!alive) return;
      merge(r, true);
      setDeep(false);
    });
    return () => {
      alive = false;
    };
  }, [name]);

  const confirm = () => {
    if (!selected) return;
    setError(false);
    start(async () => {
      const res = await setKallaxImageAction(kallaxGameId, selected.url);
      if (res.ok) {
        setSaved(true);
        onChosen?.();
        router.refresh();
      } else setError(true);
    });
  };

  if (saved) return <p className="flex items-center gap-2 text-sm font-semibold text-accent"><Check className="size-4" /> {t("chosen")}</p>;

  const loading = results === null || (deep && results.length === 0);
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold">{t("pick", { name })}</p>

      {results && results.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {results.slice(0, 18).map((r) => (
            <motion.button
              key={r.url}
              type="button"
              whileHover={{ y: -3 }}
              disabled={pending}
              onClick={() => setSelected(selected?.url === r.url ? null : r)}
              title={`${r.title} — ${r.source}`}
              aria-pressed={selected?.url === r.url}
              className={`relative aspect-square overflow-hidden rounded-xl border-2 bg-surface-2 transition ${selected?.url === r.url ? "border-accent" : "border-transparent hover:border-line"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={r.thumb} alt={r.title} className="h-full w-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
              {selected?.url === r.url && (
                <span className="absolute inset-0 grid place-items-center bg-accent/40">
                  <Check className="size-7 text-white" />
                </span>
              )}
            </motion.button>
          ))}
        </div>
      )}

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-muted">
          <LoaderCircle className="size-4 animate-spin" /> {t("searching", { name })}
        </p>
      ) : results && results.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted">
          <ImageOff className="size-4" /> {t("none")}
        </p>
      ) : deep ? (
        <p className="flex items-center gap-2 text-xs text-muted">
          <LoaderCircle className="size-3.5 animate-spin" /> {t("deepSearching")}
        </p>
      ) : null}

      {selected && (
        <p className="truncate text-xs text-muted" title={selected.title}>
          {selected.title} — {selected.source}
        </p>
      )}
      {error && <p className="text-xs text-danger">{t("saveFailed")}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-primary btn-sm" disabled={!selected || pending} onClick={confirm}>
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />} {t("use")}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => (selected ? setSelected(null) : onCancel?.())}>
          <X className="size-4" /> {t("cancel")}
        </button>
        <p className="ml-auto text-[11px] text-muted">{t("noteShort")}</p>
      </div>
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
      <ImageSuggestions kallaxGameId={kallaxGameId} name={name} onCancel={() => setOpen(false)} onChosen={() => setTimeout(() => setOpen(false), 1500)} />
    </div>
  );
}

/** "Upload box art" button: pick a photo of the box and it becomes the game's picture right away. */
export function UploadBoxArt({ kallaxGameId, label }: { kallaxGameId: string; label: string }) {
  const t = useTranslations("games.images");
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const upload = (file: File | undefined) => {
    if (!file) return;
    setError(null);
    start(async () => {
      try {
        const fd = new FormData();
        fd.set("cover", await shrinkImage(file, 1600));
        const res = await uploadKallaxCoverAction(kallaxGameId, fd);
        if (res?.error) setError(res.error);
        else router.refresh();
      } catch {
        setError(t("uploadFailed"));
      } finally {
        if (input.current) input.current.value = "";
      }
    });
  };

  return (
    <span className="inline-flex flex-col gap-1">
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files?.[0])} />
      <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => input.current?.click()}>
        {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Upload className="size-4" />} {label}
      </button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </span>
  );
}
