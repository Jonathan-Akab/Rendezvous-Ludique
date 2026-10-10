"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Copy, LoaderCircle, Sparkles } from "lucide-react";
import { aiFillDetailsAction, copyFromLudoAction, type DetailsResult } from "../actions";

const LABELS: Record<string, string> = {
  year: "year",
  minPlayers: "minPlayers",
  maxPlayers: "maxPlayers",
  playTimeMin: "playTime",
  minAge: "minAge",
  designer: "designer",
  publisher: "publisher",
};

/** Sets an input the way typing would, so the form (and React) see the new value. */
function setField(form: HTMLFormElement, name: string, value: string | number) {
  const el = form.elements.namedItem(name);
  if (!(el instanceof HTMLInputElement)) return false;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(el, String(value));
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.classList.add("ring-2", "ring-accent");
  setTimeout(() => el.classList.remove("ring-2", "ring-accent"), 4000);
  return true;
}

/**
 * Two helpers for the details form: copy what the Ludothèque knows, or let the AI find each
 * detail (Claude searching the web). They only fill the fields — nothing is saved until the member saves.
 * `gameId`: the Ludothèque game, when known (editing); otherwise it is found by the name typed in the form.
 */
export function FillDetails({ gameId = null, nameField = "name" }: { gameId?: string | null; nameField?: string }) {
  const t = useTranslations("kallax.fill");
  const tf = useTranslations("games.fields");
  const box = useRef<HTMLDivElement>(null);
  const [pending, start] = useTransition();
  const [which, setWhich] = useState<"ludo" | "ai" | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);

  const run = (kind: "ludo" | "ai") => {
    const form = box.current?.closest("form");
    if (!form) return;
    const name = (form.elements.namedItem(nameField) as HTMLInputElement | null)?.value.trim() ?? "";
    if (kind === "ai" && name.length < 2) return setMsg({ tone: "warn", text: t("needName") });
    setMsg(null);
    setWhich(kind);
    start(async () => {
      let res: DetailsResult;
      try {
        res = kind === "ludo" ? await copyFromLudoAction(gameId, name) : await aiFillDetailsAction(name);
      } catch {
        setWhich(null);
        return setMsg({ tone: "warn", text: t("failed") });
      }
      setWhich(null);
      if (!res.ok) return setMsg({ tone: "warn", text: t(`errors.${res.error}`) });
      const filled: string[] = [];
      for (const [key, value] of Object.entries(res.fields)) {
        if (value == null || value === "") continue;
        if (setField(form, key, value)) filled.push(tf(LABELS[key] as never));
      }
      if (!filled.length) return setMsg({ tone: "warn", text: t(kind === "ludo" ? "nothingLudo" : "nothingAi") });
      setMsg({
        tone: "ok",
        text:
          t(kind === "ludo" ? "filledLudo" : "filledAi", { fields: filled.join(", ") }) + (res.source ? " " + t("source", { source: res.source }) : "") + " " + t("checkThem"),
      });
    });
  };

  return (
    <div ref={box} className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-secondary btn-sm" disabled={pending} onClick={() => run("ludo")} title={t("ludoHint")}>
          {pending && which === "ludo" ? <LoaderCircle className="size-4 animate-spin" /> : <Copy className="size-4" />} {t("ludo")}
        </button>
        <button type="button" className="btn btn-secondary btn-sm" disabled={pending} onClick={() => run("ai")} title={t("aiHint")}>
          {pending && which === "ai" ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />} {t("ai")}
        </button>
      </div>
      {pending && which === "ai" && <p className="text-xs text-muted">{t("searching")}</p>}
      {msg && (
        <p role="status" className={`text-xs ${msg.tone === "ok" ? "text-success" : "text-danger"}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
