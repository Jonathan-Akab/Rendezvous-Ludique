"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { Lightbulb, Send, X } from "lucide-react";
import { FormMessage, SubmitButton } from "@/components/forms";
import { similarSuggestionsAction, submitSuggestionAction } from "../actions";
import type { SimilarSuggestion } from "../service";
import { VoteButton } from "./VoteButton";

const OPEN_EVENT = "rl:open-suggestions";

/** Opens the suggestion box from anywhere (sidebar, mobile menu, suggestions page). */
export function openSuggestionBox() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

/** The suggestion box popup. Mounted once in the member layout. */
export function SuggestionDialog({ showList }: { showList: boolean }) {
  const [open, setOpen] = useState(false);
  const [round, setRound] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/45 p-3 backdrop-blur-sm sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={() => setOpen(false)}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="suggestion-title"
            className="glass max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-3xl p-5 shadow-2xl"
            initial={{ y: 40, scale: 0.97 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 40, scale: 0.97 }}
            transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <SuggestionForm key={round} showList={showList} onClose={() => setOpen(false)} onAnother={() => setRound((r) => r + 1)} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function SuggestionForm({ showList, onClose, onAnother }: { showList: boolean; onClose: () => void; onAnother: () => void }) {
  const t = useTranslations("suggestions");
  const [state, action] = useActionState(submitSuggestionAction, undefined);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [similar, setSimilar] = useState<SimilarSuggestion[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Live "already proposed?" hints while typing.
  useEffect(() => {
    if (!showList) return;
    clearTimeout(timer.current);
    if (title.trim().length < 4) {
      setSimilar([]);
      return;
    }
    timer.current = setTimeout(() => {
      similarSuggestionsAction(title, details).then(setSimilar).catch(() => setSimilar([]));
    }, 350);
    return () => clearTimeout(timer.current);
  }, [title, details, showList]);

  const created = state?.ok && state.data?.created;
  const merged = state?.ok && state.data?.mergedId ? String(state.data.mergedId) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-accent to-accent-2 text-accent-ink">
          <Lightbulb className="size-5" />
        </span>
        <div className="flex-1">
          <h2 id="suggestion-title" className="font-display text-xl font-bold">
            {t("dialogTitle")}
          </h2>
          <p className="text-sm text-muted">{t("dialogLead")}</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg p-1 text-muted hover:text-ink" title={t("close")}>
          <X className="size-5" />
        </button>
      </div>

      {created ? (
        <div className="space-y-4 py-2 text-center">
          <motion.div initial={{ scale: 0.6, rotate: -10 }} animate={{ scale: 1, rotate: 0 }} className="mx-auto w-fit text-5xl">
            💡
          </motion.div>
          <p className="font-semibold">{state.message}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <button type="button" className="btn btn-secondary" onClick={onAnother}>
              {t("another")}
            </button>
            {showList && (
              <Link href="/suggestions" className="btn btn-primary" onClick={onClose}>
                {t("seeAll")}
              </Link>
            )}
          </div>
        </div>
      ) : (
        <form action={action} className="space-y-3">
          <div>
            <label className="label" htmlFor="sg-title">
              {t("titleLabel")}
            </label>
            <input
              id="sg-title"
              name="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input"
              placeholder={t("titlePlaceholder")}
              maxLength={140}
              required
              autoFocus
            />
          </div>
          <div>
            <label className="label" htmlFor="sg-details">
              {t("detailsLabel")}
            </label>
            <textarea
              id="sg-details"
              name="details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              className="textarea min-h-24"
              placeholder={t("detailsPlaceholder")}
              maxLength={2000}
            />
          </div>

          {!merged && similar.length > 0 && (
            <div className="space-y-2 rounded-2xl border border-dashed border-accent/50 p-3">
              <p className="text-xs font-semibold text-accent">{t("similarTitle")}</p>
              {similar.map((s) => (
                <div key={s.id} className="flex items-center gap-3">
                  <VoteButton suggestionId={s.id} votes={s.votes} voted={s.voted} compact />
                  <span className="flex-1 text-sm">{s.title}</span>
                  {s.status !== "OPEN" && <span className="chip text-[10px]">{t(`status.${s.status}`)}</span>}
                </div>
              ))}
            </div>
          )}

          {merged ? (
            <div className="space-y-3 rounded-2xl bg-success/10 p-3 text-sm">
              <p className="font-semibold text-success">{state?.message}</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn btn-primary btn-sm" onClick={onClose}>
                  {t("close")}
                </button>
                {state?.data?.addedVote ? <input type="hidden" name="undoVote" value={merged} /> : null}
                <SubmitButton name="force" value="1" className="btn btn-ghost btn-sm">
                  {t("forcePost")}
                </SubmitButton>
              </div>
            </div>
          ) : (
            <>
              <FormMessage state={state} />
              <div className="flex flex-wrap items-center justify-between gap-2">
                {showList ? (
                  <Link href="/suggestions" className="text-sm text-muted hover:text-accent" onClick={onClose}>
                    {t("seeAll")}
                  </Link>
                ) : (
                  <span />
                )}
                <SubmitButton>
                  <Send className="size-4" /> {t("submit")}
                </SubmitButton>
              </div>
            </>
          )}
        </form>
      )}
    </div>
  );
}
