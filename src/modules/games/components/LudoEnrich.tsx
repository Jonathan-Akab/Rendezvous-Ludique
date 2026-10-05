"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Gift, LoaderCircle, Sparkles, Square } from "lucide-react";

type Result = { id: string; name: string; filled: string[]; image: string | null; expansionOf: string | null };
const CHUNK = 3;

/** Staff: completes Ludothèque entries with the free AI (empty fields only), a few at a time. */
export function LudoEnrich({ ids, label, compact = false }: { ids: string[]; label: string; compact?: boolean }) {
  const t = useTranslations("games.enrich");
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [error, setError] = useState<string | null>(null);
  const stop = useRef(false);

  const run = async () => {
    setRunning(true);
    setError(null);
    setResults([]);
    stop.current = false;
    for (let i = 0; i < ids.length && !stop.current; i += CHUNK) {
      try {
        const res = await fetch("/api/admin/games/enrich", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: ids.slice(i, i + CHUNK) }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setResults((r) => [...r, ...data.results]);
      } catch (e) {
        setError((e as Error).message === "quota" ? t("quota") : t("failed"));
        break;
      }
    }
    setRunning(false);
    router.refresh();
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={run} disabled={running || !ids.length} className={`btn ${compact ? "btn-ghost btn-sm" : "btn-secondary"}`}>
          {running ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4 text-[#c78f1f]" />} {label}
        </button>
        {running && ids.length > CHUNK && (
          <>
            <span className="text-xs text-muted">
              {results.length}/{ids.length}
            </span>
            <button type="button" onClick={() => (stop.current = true)} className="btn btn-ghost btn-sm">
              <Square className="size-3.5" /> {t("stop")}
            </button>
          </>
        )}
        {!compact && (
          <span className="inline-flex items-center gap-1 text-[11px] text-muted">
            <Gift className="size-3" /> {t("free")}
          </span>
        )}
      </div>
      {error && <p className="text-xs text-[#c78f1f]">{error}</p>}
      {results.length > 0 && (
        <ul className="max-h-64 space-y-1 overflow-y-auto rounded-xl bg-surface-2/50 p-2 text-xs">
          {results.map((r) => (
            <li key={r.id}>
              <span className="font-semibold">{r.name}</span> —{" "}
              <span className="text-muted">
                {r.filled.length ? r.filled.map((f) => t(`fields.${f}`)).join(", ") : t("nothing")}
                {r.expansionOf ? ` (${r.expansionOf})` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
