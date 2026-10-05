"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { Check, Gift, LoaderCircle, Sparkles } from "lucide-react";
import { ImageSuggestions } from "./ImageSuggestions";

type Game = { id: string; name: string };
type Result = { id: string; name: string; filled: string[]; image: string | null };

const CHUNK = 3; // games per request (the free AI has per-minute limits)

/**
 * Right after games are added to a Kallax: the free AI fills in their details and looks for
 * a box picture. Games still without a picture then get the usual picture suggestions.
 */
export function EnrichProgress({ games, needPicture, enabled }: { games: Game[]; needPicture: Game[]; enabled: boolean }) {
  const t = useTranslations("games.enrich");
  const router = useRouter();
  const [results, setResults] = useState<Result[]>([]);
  const [running, setRunning] = useState(enabled && games.length > 0);
  const [failed, setFailed] = useState<false | "busy" | "quota">(false);
  const started = useRef(false);

  useEffect(() => {
    if (!enabled || !games.length || started.current) return;
    started.current = true;
    (async () => {
      for (let i = 0; i < games.length; i += CHUNK) {
        try {
          const res = await fetch("/api/kallax/enrich", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: games.slice(i, i + CHUNK).map((g) => g.id) }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error === "quota" ? "quota" : "busy");
          setResults((r) => [...r, ...data.results]);
        } catch (e) {
          setFailed((e as Error).message === "quota" ? "quota" : "busy");
          break;
        }
      }
      setRunning(false);
      router.refresh(); // the shelf shows the new details and pictures
    })();
  }, [enabled, games, router]);

  const pictured = new Set(results.filter((r) => r.image).map((r) => r.id));
  const stillNeedPicture = running ? [] : needPicture.filter((g) => !pictured.has(g.id));

  return (
    <div className="space-y-3">
      {enabled && games.length > 0 && (
        <div className="rounded-2xl border border-dashed border-[#f2b705]/50 bg-[#f2b705]/5 p-3 text-sm">
          <p className="flex items-center gap-2 font-semibold">
            {running ? <LoaderCircle className="size-4 animate-spin text-[#c78f1f]" /> : <Sparkles className="size-4 text-[#c78f1f]" />}
            {running ? t("running", { done: results.length, total: games.length }) : t("done")}
            <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-normal text-muted">
              <Gift className="size-3" /> {t("free")}
            </span>
          </p>
          {results.length > 0 && (
            <ul className="mt-2 space-y-1">
              {results.map((r) => (
                <motion.li key={r.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2 text-xs">
                  {r.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.image} alt="" className="size-8 rounded-md object-cover" />
                  ) : (
                    <span className="grid size-8 place-items-center rounded-md bg-surface-2">
                      <Check className="size-3.5 text-muted" />
                    </span>
                  )}
                  <span className="font-semibold">{r.name}</span>
                  <span className="text-muted">
                    {r.filled.length ? r.filled.map((f) => t(`fields.${f}`)).join(", ") : t("nothing")}
                  </span>
                </motion.li>
              ))}
            </ul>
          )}
          {failed && <p className="mt-2 text-xs text-[#c78f1f]">{failed === "quota" ? t("quota") : t("failed")}</p>}
          <p className="mt-2 text-[11px] text-muted">{t("check")}</p>
        </div>
      )}

      {stillNeedPicture.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold">{t("pickPictures", { count: stillNeedPicture.length })}</p>
          {stillNeedPicture.length === 1 ? (
            <div className="rounded-2xl border border-dashed border-accent/50 p-3">
              <ImageSuggestions kallaxGameId={stillNeedPicture[0].id} name={stillNeedPicture[0].name} />
            </div>
          ) : (
            stillNeedPicture.slice(0, 15).map((g) => (
              <details key={g.id} className="rounded-2xl border border-line p-3">
                <summary className="cursor-pointer font-semibold">{g.name}</summary>
                <div className="mt-3">
                  <ImageSuggestions kallaxGameId={g.id} name={g.name} />
                </div>
              </details>
            ))
          )}
        </div>
      )}
    </div>
  );
}
