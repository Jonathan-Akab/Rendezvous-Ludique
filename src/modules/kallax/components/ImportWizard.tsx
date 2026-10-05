"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { Camera, Check, ClipboardList, Gift, Images, KeyRound, LoaderCircle, Sparkles } from "lucide-react";
import { FormMessage, SubmitButton } from "@/components/forms";
import { GameCover } from "@/modules/games/components/GameCover";
import { EnrichProgress } from "@/modules/games/components/EnrichProgress";
import { LIBRARY_GAME_STATUSES } from "@/lib/constants";
import { importGamesAction } from "../actions";
import { ProviderSwitch, type Provider, type ProviderInfo } from "@/modules/ai/components/ProviderSwitch";
import { EMPTY_DETAILS, ImportReview, type KallaxBase, type Match, type Row } from "./ImportReview";

/** The AI choices for reading photos (same as the rules AI). */
export type PhotoAi = { info: ProviderInfo; initial: Provider; anyAvailable: boolean };

type Candidate = {
  name: string;
  year?: number | null;
  minPlayers?: number | null;
  maxPlayers?: number | null;
  playTimeMin?: number | null;
  imageUrl?: string | null;
  status?: string;
  confidence?: "high" | "medium" | "low";
  match: Match | null;
  suggestions: Match[];
};
export type ImportSource = "box" | "shelf" | "list";
type Source = ImportSource;

/** Shrinks a photo in the browser before sending it (faster, and fits free AI limits). */
async function shrink(file: File, max = 1600): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
  return blob ? new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" }) : file;
}

export function ImportWizard({
  libraries,
  ai,
  enrich,
  bases,
  source: fixedSource,
  defaultLibraryId,
}: {
  libraries: { id: string; name: string }[];
  ai: PhotoAi;
  /** the free AI completes the imported games */
  enrich: boolean;
  /** base games already in the member's Kallax (for attaching expansions) */
  bases: KallaxBase[];
  /** when set (from "Add a game"), the source is chosen outside and its tiles are hidden */
  source?: Source;
  defaultLibraryId?: string;
}) {
  const t = useTranslations("kallax.import");
  const tk = useTranslations("kallax");
  const tp = useTranslations("ai.provider");
  const [innerSource, setSource] = useState<Source>(ai.anyAvailable ? "box" : "list");
  const [provider, setProvider] = useState<Provider>(ai.initial);
  const [readBy, setReadBy] = useState<{ provider: Provider; switched: boolean } | null>(null);
  const source = fixedSource ?? innerSource;
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [useAsCover, setUseAsCover] = useState(true);
  const [state, action] = useActionState(importGamesAction, undefined);
  // Once imported, the review closes (so the same games can't be imported twice).
  useEffect(() => {
    if (state?.ok) setRows(null);
  }, [state]);
  const coverInput = useRef<HTMLInputElement>(null);
  const [libraryId, setLibraryId] = useState(defaultLibraryId ?? libraries[0]?.id ?? "");
  const libraryBases = bases.filter((b) => b.libraryId === libraryId);

  const sources: { key: Source; icon: typeof Camera; available: boolean }[] = [
    { key: "box", icon: Camera, available: ai.anyAvailable },
    { key: "shelf", icon: Images, available: ai.anyAvailable },
    { key: "list", icon: ClipboardList, available: true },
  ];

  // Each found game waits for the free AI, then for the member's decision (validate / skip).
  const toRows = (items: Candidate[]): Row[] =>
    items.map((c, i) => ({
      key: `${i}-${c.name}`,
      name: c.name,
      status: c.status,
      confidence: c.confidence,
      match: c.match,
      chosen: c.match,
      suggestions: c.suggestions,
      decision: "pending",
      details: {
        ...EMPTY_DETAILS,
        year: c.year ?? null,
        minPlayers: c.minPlayers ?? null,
        maxPlayers: c.maxPlayers ?? null,
        playTimeMin: c.playTimeMin ?? null,
      },
      image: c.imageUrl ?? null,
      imageKnown: false,
      ai: enrich ? "waiting" : "none",
      isExpansion: false,
      baseGame: null,
      parent: null,
      editing: false,
    }));

  async function preview(body: BodyInit, json: boolean) {
    setLoading(true);
    setError(null);
    setRows(null);
    try {
      const res = await fetch("/api/kallax/import", { method: "POST", body, headers: json ? { "Content-Type": "application/json" } : undefined });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "unknown");
      setRows(toRows(data.items));
      setReadBy(data.provider ? { provider: data.provider, switched: Boolean(data.switched) } : null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function onPhotos(files: FileList | null) {
    const list = Array.from(files ?? []).slice(0, source === "box" ? 1 : 4);
    const small = await Promise.all(list.map((f) => shrink(f)));
    setPhotos(small);
    setPreviews(small.map((f) => URL.createObjectURL(f)));
    setRows(null);
  }

  // Only validated games are imported; an expansion points to its base game (in the Kallax,
  // or to another validated game of this import by its position in the list).
  const selected = rows?.filter((r) => r.decision === "ok") ?? [];
  const payload = JSON.stringify(
    selected.map((r) => {
      const parentRow = r.parent?.kind === "row" ? selected.findIndex((x) => x.key === (r.parent as { key: string }).key) : -1;
      return {
        name: r.chosen?.name ?? r.name,
        gameId: r.chosen?.id,
        ...r.details,
        imageUrl: r.image && !r.imageKnown && r.image.startsWith("https://") ? r.image : null,
        status: r.status,
        parentId: r.parent?.kind === "kallax" ? r.parent.id : null,
        parentIndex: parentRow >= 0 ? parentRow : null,
      };
    }),
  );
  const needImages = (state?.data?.needImages as { id: string; name: string }[] | undefined) ?? [];
  const addedGames = (state?.data?.addedGames as { id: string; name: string }[] | undefined) ?? [];

  return (
    <div className="space-y-6">
      <div className={`grid grid-cols-2 gap-2 md:grid-cols-4 ${fixedSource ? "hidden" : ""}`}>
        {sources.map((s) => (
          <button
            key={s.key}
            type="button"
            disabled={!s.available}
            onClick={() => {
              setSource(s.key);
              setRows(null);
              setPhotos([]);
              setPreviews([]);
              setError(null);
            }}
            className={`relative flex flex-col items-start gap-1 rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-45 ${
              source === s.key ? "border-accent bg-accent/10" : "border-line/70 bg-surface/70 hover:border-accent/50"
            }`}
          >
            <s.icon className={`size-6 ${source === s.key ? "text-accent" : "text-muted"}`} />
            <span className="text-sm font-bold">{t(`sources.${s.key}.title`)}</span>
            <span className="text-xs text-muted">{s.available ? t(`sources.${s.key}.text`) : t(`sources.${s.key}.unavailable`)}</span>
          </button>
        ))}
      </div>

      <div className="glass space-y-4 rounded-3xl p-5">
        {fixedSource && <p className="text-sm text-muted">{t(`sources.${fixedSource}.text`)}</p>}
        {(source === "box" || source === "shelf") && (
          <>
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("whoReads")}</p>
              <ProviderSwitch value={provider} onChange={setProvider} info={ai.info} />
            </div>
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-line p-6 text-center hover:border-accent">
              <Camera className="size-8 text-accent" />
              <span className="font-semibold">{source === "box" ? t("takeBox") : t("takeShelf")}</span>
              <span className="text-xs text-muted">{source === "box" ? t("boxHint") : t("shelfHint")}</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                multiple={source === "shelf"}
                className="sr-only"
                onChange={(e) => onPhotos(e.target.files)}
              />
            </label>
            {previews.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {previews.map((src) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={src} src={src} alt="" className="h-28 rounded-xl border border-line object-cover" />
                ))}
              </div>
            )}
            <button
              type="button"
              className="btn btn-primary"
              disabled={!photos.length || loading}
              onClick={() => {
                const fd = new FormData();
                fd.set("mode", source);
                fd.set("provider", provider);
                photos.forEach((p) => fd.append("images", p));
                preview(fd, false);
              }}
            >
              {loading ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />} {t("recognize")}
            </button>
            <p className="text-xs text-muted">{t("checkNote")}</p>
            {readBy && rows && (
              <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                {readBy.provider === "free" ? <Gift className="size-3.5 text-[#c78f1f]" /> : readBy.provider === "own" ? <KeyRound className="size-3.5 text-[#3b82f6]" /> : <Sparkles className="size-3.5 text-accent" />}
                {t("readBy", {
                  who: readBy.provider === "own" ? tp("own") : readBy.provider === "claude" ? tp("claudeSite", { site: ai.info.siteName }) : tp("free", { name: ai.info.freeName }),
                })}
                {readBy.switched && <span className="text-[#c78f1f]">{t("switched")}</span>}
              </p>
            )}
          </>
        )}

        {source === "list" && (
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              const names = String(new FormData(e.currentTarget).get("names") ?? "")
                .split(/\r?\n|;/)
                .map((s) => s.trim())
                .filter(Boolean);
              if (names.length) preview(JSON.stringify({ source: "list", names }), true);
            }}
          >
            <label className="label" htmlFor="names">
              {t("listLabel")}
            </label>
            <textarea id="names" name="names" className="textarea min-h-40" placeholder={"Azul\nCatan\nWingspan"} required />
            <button className="btn btn-primary" disabled={loading}>
              {loading ? <LoaderCircle className="size-4 animate-spin" /> : <ClipboardList className="size-4" />} {t("listCheck")}
            </button>
          </form>
        )}

        {error && <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{t(`errors.${["visionUnavailable", "visionQuota", "visionBusy", "visionError", "noImage", "badImage", "ai_blocked", "ai_limit", "ai_budget", "ai_notConfigured", "ai_claudeUnavailable", "ai_freeUnavailable", "ai_ownUnavailable", "ai_ownKeyInvalid", "ai_ownKeyCredit"].includes(error) ? error : "unknown"}`)}</p>}
      </div>

      <AnimatePresence>
        {rows && (
          <motion.form action={action} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <input type="hidden" name="items" value={payload} />
            <h2 className="section-title">{t("review", { count: rows.length })}</h2>
            {rows.length === 0 ? (
              <p className="glass rounded-2xl p-4 text-sm text-muted">{t("noneFound")}</p>
            ) : (
              <ImportReview rows={rows} setRows={setRows} bases={libraryBases} aiEnabled={enrich} />
            )}

            {rows.length > 0 && (
              <div className="glass flex flex-wrap items-end gap-3 rounded-2xl p-4">
                <div>
                  <label className="label" htmlFor="imp-lib">
                    {t("into")}
                  </label>
                  <select id="imp-lib" name="libraryId" className="select" value={libraryId} onChange={(e) => setLibraryId(e.target.value)}>
                    {libraries.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="imp-status">
                    {t("as")}
                  </label>
                  <select id="imp-status" name="status" className="select" defaultValue="OWNED">
                    {LIBRARY_GAME_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {tk(`status.${s}`)}
                      </option>
                    ))}
                  </select>
                </div>
                {source === "box" && selected.length === 1 && photos[0] && (
                  <label className="flex items-center gap-2 pb-2 text-sm">
                    <input type="checkbox" checked={useAsCover} onChange={(e) => setUseAsCover(e.target.checked)} className="size-4 accent-[var(--accent)]" />
                    {t("useMyPhoto")}
                    {useAsCover && (
                      <input
                        ref={(el) => {
                          coverInput.current = el;
                          if (el && photos[0]) {
                            const dt = new DataTransfer();
                            dt.items.add(photos[0]);
                            el.files = dt.files;
                          }
                        }}
                        type="file"
                        name="cover"
                        className="hidden"
                      />
                    )}
                  </label>
                )}
                <SubmitButton disabled={!selected.length}>{t("importN", { count: selected.length })}</SubmitButton>
              </div>
            )}
            <FormMessage state={state} />
          </motion.form>
        )}
      </AnimatePresence>

      {state?.ok && (
        <div className="space-y-4">
          <p className="rounded-xl bg-success/10 px-3 py-2 text-sm text-success">{state.message}</p>
          <Link href="/kallax" className="btn btn-secondary">
            {t("seeKallax")}
          </Link>
          {(addedGames.length > 0 || needImages.length > 0) && (
            <div className="card card-pad">
              {/* details were filled during the review: only pictures still missing are proposed */}
              <EnrichProgress key={addedGames.map((g) => g.id).join()} games={addedGames} needPicture={needImages} enabled={false} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
