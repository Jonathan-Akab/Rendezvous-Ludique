"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { Check, ChevronDown, Gift, LoaderCircle, Pencil, Puzzle, SkipForward, Sparkles } from "lucide-react";
import { GameCover } from "@/modules/games/components/GameCover";
import { normalizeText, textSimilarity } from "@/lib/similarity";

// Review step of an import: the free AI fills in each game first (details, a verified box
// picture, whether it's an expansion), then the member validates or skips each one.

export type Match = { id: string; name: string; year: number | null; cover: string | null; rating: number | null };
export type Details = {
  year: number | null;
  minPlayers: number | null;
  maxPlayers: number | null;
  playTimeMin: number | null;
  minAge: number | null;
  designer: string | null;
  publisher: string | null;
  weight: number | null;
  categories: string | null;
  description: string | null;
};
export type Parent = { kind: "kallax"; id: string; name: string } | { kind: "row"; key: string; name: string } | null;
export type Row = {
  key: string;
  name: string;
  status?: string;
  confidence?: "high" | "medium" | "low";
  match: Match | null;
  chosen: Match | null;
  suggestions: Match[];
  decision: "pending" | "ok" | "skip";
  details: Details;
  image: string | null;
  imageKnown: boolean;
  ai: "waiting" | "loading" | "done" | "none" | "failed";
  isExpansion: boolean;
  baseGame: string | null;
  parent: Parent;
  editing: boolean;
};
export type KallaxBase = { id: string; name: string; libraryId: string };

export const EMPTY_DETAILS: Details = {
  year: null,
  minPlayers: null,
  maxPlayers: null,
  playTimeMin: null,
  minAge: null,
  designer: null,
  publisher: null,
  weight: null,
  categories: null,
  description: null,
};

const CHUNK = 3;

/** Finds the base game named by the AI: in the Kallax first, then among the imported games. */
function findParent(baseName: string, self: string, rows: Row[], bases: KallaxBase[]): Parent {
  const same = (a: string) => normalizeText(a) === normalizeText(baseName) || textSimilarity(a, baseName) >= 0.8;
  const inKallax = bases.find((b) => same(b.name));
  if (inKallax) return { kind: "kallax", id: inKallax.id, name: inKallax.name };
  const row = rows.find((r) => r.key !== self && !r.isExpansion && same(r.chosen?.name ?? r.name));
  return row ? { kind: "row", key: row.key, name: row.chosen?.name ?? row.name } : null;
}

export function ImportReview({
  rows,
  setRows,
  bases,
  aiEnabled,
}: {
  rows: Row[];
  setRows: React.Dispatch<React.SetStateAction<Row[] | null>>;
  bases: KallaxBase[];
  aiEnabled: boolean;
}) {
  const t = useTranslations("kallax.import");
  const busy = useRef(false);
  const [aiFailed, setAiFailed] = useState<false | "busy" | "quota">(false);
  const update = (key: string, patch: Partial<Row>) => setRows((all) => all?.map((r) => (r.key === key ? { ...r, ...patch } : r)) ?? null);

  // The free AI completes waiting rows, a few at a time (free tiers have per-minute limits).
  useEffect(() => {
    if (!aiEnabled || busy.current || aiFailed) return;
    const batch = rows.filter((r) => r.ai === "waiting").slice(0, CHUNK);
    if (!batch.length) return;
    busy.current = true;
    setRows((all) => all?.map((r) => (batch.some((b) => b.key === r.key) ? { ...r, ai: "loading" } : r)) ?? null);
    (async () => {
      try {
        const res = await fetch("/api/kallax/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: batch.map((r) => ({ key: r.key, name: r.chosen?.name ?? r.name, gameId: r.chosen?.id ?? null })) }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error === "quota" ? "quota" : "busy");
        setRows((all) => {
          if (!all) return all;
          const next = all.map((r) => {
            const found = (data.results as { key: string; details: Details; image: string | null; imageKnown: boolean; isExpansion: boolean; baseGame: string | null }[]).find(
              (x) => x.key === r.key,
            );
            if (!found) return r;
            // Keep what the member already typed; the AI fills the rest.
            const details = { ...found.details };
            for (const k of Object.keys(details) as (keyof Details)[]) if (r.details[k] != null) (details as Record<string, unknown>)[k] = r.details[k];
            return { ...r, ai: "done" as const, details, image: r.image ?? found.image, imageKnown: found.imageKnown, isExpansion: found.isExpansion, baseGame: found.baseGame };
          });
          // Expansions: attach to their base game (in the Kallax or in this import).
          return next.map((r) => (r.isExpansion && r.baseGame && r.parent === null && r.ai === "done" ? { ...r, parent: findParent(r.baseGame, r.key, next, bases) } : r));
        });
      } catch (e) {
        setAiFailed((e as Error).message === "quota" ? "quota" : "busy");
        setRows((all) => all?.map((r) => (r.ai === "loading" || r.ai === "waiting" ? { ...r, ai: "failed" } : r)) ?? null);
      } finally {
        busy.current = false;
        setRows((all) => (all ? [...all] : all)); // next batch
      }
    })();
  }, [rows, aiEnabled, aiFailed, bases, setRows]);

  const pending = rows.filter((r) => r.decision === "pending").length;
  const loading = rows.filter((r) => r.ai === "waiting" || r.ai === "loading").length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {aiEnabled && loading > 0 && (
          <span className="flex items-center gap-1.5 rounded-full bg-[#f2b705]/15 px-3 py-1 text-xs font-semibold text-[#c78f1f]">
            <LoaderCircle className="size-3.5 animate-spin" /> {t("aiFilling", { count: loading })}
          </span>
        )}
        {aiFailed && <span className="text-xs text-[#c78f1f]">{aiFailed === "quota" ? t("aiQuota") : t("aiBusy")}</span>}
        <span className="ml-auto flex gap-2 text-xs">
          <button type="button" className="btn btn-secondary btn-sm" disabled={!pending} onClick={() => setRows((all) => all?.map((r) => (r.decision === "pending" ? { ...r, decision: "ok" } : r)) ?? null)}>
            <Check className="size-3.5" /> {t("validateAll", { count: pending })}
          </button>
        </span>
      </div>

      <ul className="space-y-2">
        {rows.map((r) => (
          <ReviewCard key={r.key} row={r} rows={rows} bases={bases} update={(p) => update(r.key, p)} />
        ))}
      </ul>
    </div>
  );
}

function ReviewCard({ row: r, rows, bases, update }: { row: Row; rows: Row[]; bases: KallaxBase[]; update: (p: Partial<Row>) => void }) {
  const t = useTranslations("kallax.import");
  const tf = useTranslations("games.fields");
  const tk = useTranslations("kallax");
  const name = r.chosen?.name ?? r.name;
  const d = r.details;
  const summary = [
    d.year,
    d.minPlayers || d.maxPlayers ? `${d.minPlayers ?? "?"}–${d.maxPlayers ?? "?"} ${t("players")}` : null,
    d.playTimeMin ? `${d.playTimeMin} min` : null,
    d.minAge ? `${d.minAge}+` : null,
    d.designer,
    d.publisher,
  ].filter(Boolean);
  const setDetail = (k: keyof Details, v: string, num = false) => update({ details: { ...d, [k]: v === "" ? null : num ? Number(v) : v } });
  const parentOptions = [
    ...bases.map((b) => ({ value: `k:${b.id}`, label: b.name })),
    ...rows.filter((x) => x.key !== r.key && !x.isExpansion && x.decision !== "skip").map((x) => ({ value: `r:${x.key}`, label: `${x.chosen?.name ?? x.name} ${t("fromImport")}` })),
  ];
  const parentValue = r.parent ? (r.parent.kind === "kallax" ? `k:${r.parent.id}` : `r:${r.parent.key}`) : "";

  return (
    <motion.li
      layout
      className={`card overflow-hidden border-2 transition ${r.decision === "ok" ? "border-success/60" : r.decision === "skip" ? "border-transparent opacity-50" : "border-transparent"}`}
    >
      <div className="flex flex-wrap items-start gap-3 p-3">
        <div className="relative">
          <GameCover name={name} src={r.image ?? r.chosen?.cover ?? null} size="sm" />
          {r.ai === "loading" && (
            <span className="absolute inset-0 grid place-items-center rounded-xl bg-black/40">
              <LoaderCircle className="size-5 animate-spin text-white" />
            </span>
          )}
        </div>

        <div className="min-w-56 flex-1 space-y-1.5">
          {r.chosen ? (
            <p className="font-semibold">{name}</p>
          ) : (
            <input value={r.name} onChange={(e) => update({ name: e.target.value, ai: "waiting" })} className="input py-1 font-semibold" aria-label={t("nameLabel")} />
          )}
          <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
            {r.chosen ? (
              <span className="chip border-transparent bg-success/15 text-success">
                <Check className="size-3" /> {t("inDatabase")}
              </span>
            ) : (
              <span className="chip">{t("newGame")}</span>
            )}
            {r.isExpansion && (
              <span className="chip border-transparent bg-[#1c5fbf]/15 text-[#3b82f6]">
                <Puzzle className="size-3" /> {t("expansion")}
              </span>
            )}
            {r.ai === "done" && (
              <span className="chip border-transparent bg-[#f2b705]/15 text-[#c78f1f]">
                <Sparkles className="size-3" /> {t("aiDone")}
              </span>
            )}
            {r.ai === "loading" && <span className="text-[#c78f1f]">{t("aiWorking")}</span>}
            {r.confidence === "low" && <span className="chip text-[#c78f1f]">{t("lowConfidence")}</span>}
            {r.status && r.status !== "OWNED" && <span className="chip">{tk(`status.${r.status}`)}</span>}
            {r.chosen && (
              <button type="button" className="underline" onClick={() => update({ chosen: null, ai: "waiting", parent: null, isExpansion: false })}>
                {t("notThis")}
              </button>
            )}
            {!r.chosen && r.match && (
              <button type="button" className="underline" onClick={() => update({ chosen: r.match, ai: "waiting", parent: null })}>
                {t("useMatch")}
              </button>
            )}
          </p>
          {!r.chosen && r.suggestions.length > 0 && (
            <p className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-muted">{t("didYouMean")}</span>
              {r.suggestions.map((s) => (
                <button key={s.id} type="button" onClick={() => update({ chosen: s, ai: "waiting", parent: null })} className="chip hover:border-accent hover:text-accent">
                  {s.name}
                </button>
              ))}
            </p>
          )}
          <p className="text-xs">{summary.length ? summary.join(" · ") : <span className="text-muted">{t("noDetails")}</span>}</p>

          {(r.isExpansion || r.parent) && (
            <label className="flex flex-wrap items-center gap-2 text-xs">
              <Puzzle className="size-3.5 text-[#3b82f6]" />
              <span className="font-semibold">{t("expansionOf")}</span>
              <select
                className="select w-auto py-1 text-xs"
                value={parentValue}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v) return update({ parent: null });
                  const label = parentOptions.find((o) => o.value === v)?.label ?? "";
                  update({ parent: v.startsWith("k:") ? { kind: "kallax", id: v.slice(2), name: label } : { kind: "row", key: v.slice(2), name: label } });
                }}
              >
                <option value="">{t("standalone")}</option>
                {parentOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              {r.baseGame && !r.parent && <span className="text-muted">{t("baseNotFound", { name: r.baseGame })}</span>}
            </label>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-1.5">
          <button
            type="button"
            onClick={() => update({ decision: r.decision === "ok" ? "pending" : "ok" })}
            className={`btn btn-sm ${r.decision === "ok" ? "btn-primary" : "btn-secondary"}`}
            aria-pressed={r.decision === "ok"}
          >
            <Check className="size-3.5" /> {r.decision === "ok" ? t("validated") : t("validate")}
          </button>
          <button
            type="button"
            onClick={() => update({ decision: r.decision === "skip" ? "pending" : "skip" })}
            className="btn btn-ghost btn-sm text-muted"
            aria-pressed={r.decision === "skip"}
          >
            <SkipForward className="size-3.5" /> {r.decision === "skip" ? t("skipped") : t("skip")}
          </button>
          <button type="button" onClick={() => update({ editing: !r.editing })} className="btn btn-ghost btn-sm text-muted">
            <Pencil className="size-3.5" /> {t("edit")} <ChevronDown className={`size-3 transition ${r.editing ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>

      {r.editing && (
        <div className="grid grid-cols-2 gap-2 border-t border-line/60 p-3 sm:grid-cols-4">
          {(
            [
              ["year", tf("year"), true],
              ["minPlayers", tf("minPlayers"), true],
              ["maxPlayers", tf("maxPlayers"), true],
              ["playTimeMin", tf("playTime"), true],
              ["minAge", tf("minAge"), true],
            ] as const
          ).map(([k, label]) => (
            <label key={k} className="text-xs">
              <span className="label">{label}</span>
              <input type="number" value={d[k] ?? ""} onChange={(e) => setDetail(k, e.target.value, true)} className="input py-1" />
            </label>
          ))}
          <label className="col-span-2 text-xs sm:col-span-1">
            <span className="label">{tf("designer")}</span>
            <input value={d.designer ?? ""} onChange={(e) => setDetail("designer", e.target.value)} className="input py-1" />
          </label>
          <label className="col-span-2 text-xs">
            <span className="label">{tf("publisher")}</span>
            <input value={d.publisher ?? ""} onChange={(e) => setDetail("publisher", e.target.value)} className="input py-1" />
          </label>
          <label className="col-span-2 text-xs sm:col-span-4">
            <span className="label">{tf("imageUrl")}</span>
            <input value={r.image ?? ""} onChange={(e) => update({ image: e.target.value || null, imageKnown: false })} className="input py-1" placeholder="https://…" />
          </label>
          {d.description && (
            <p className="col-span-2 text-xs text-muted sm:col-span-4">
              <Gift className="mr-1 inline size-3" />
              {d.description}
            </p>
          )}
        </div>
      )}
    </motion.li>
  );
}
