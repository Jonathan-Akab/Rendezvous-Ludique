"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Check, LoaderCircle, Puzzle, X } from "lucide-react";
import { attachExpansionsAction, detectExpansionsAction, type ExpansionProposal } from "../actions";

/** "Tidy my expansions": the AI proposes which games are expansions of others; the member confirms. */
export function ExpansionTidy({ libraryId }: { libraryId: string }) {
  const t = useTranslations("kallax.expansions");
  const [proposals, setProposals] = useState<(ExpansionProposal & { keep: boolean })[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const detect = () =>
    start(async () => {
      setMessage(null);
      const found = await detectExpansionsAction(libraryId);
      setProposals(found.map((p) => ({ ...p, keep: true })));
    });
  const confirm = () =>
    start(async () => {
      const n = await attachExpansionsAction(proposals!.filter((p) => p.keep).map((p) => ({ id: p.id, baseId: p.baseId })));
      setProposals(null);
      setMessage(t("attached", { count: n }));
    });

  return (
    <div className="space-y-2">
      <button type="button" onClick={detect} disabled={pending} className="btn btn-secondary btn-sm">
        {pending && !proposals ? <LoaderCircle className="size-3.5 animate-spin" /> : <Puzzle className="size-3.5" />} {t("tidy")}
      </button>
      {message && <p className="text-xs text-success">{message}</p>}
      {proposals && (
        <div className="card space-y-2 p-3 text-sm">
          {proposals.length === 0 ? (
            <p className="text-muted">{t("noneFound")}</p>
          ) : (
            <>
              <p className="font-semibold">{t("proposals", { count: proposals.length })}</p>
              <ul className="space-y-1">
                {proposals.map((p) => (
                  <li key={p.id}>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={p.keep}
                        onChange={(e) => setProposals((all) => all!.map((x) => (x.id === p.id ? { ...x, keep: e.target.checked } : x)))}
                        className="size-4 accent-[var(--accent)]"
                      />
                      <span className="font-semibold">{p.name}</span>
                      <span className="text-muted">→ {t("of2")}</span>
                      <span>{p.baseName}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className="flex gap-2">
            {proposals.some((p) => p.keep) && (
              <button type="button" onClick={confirm} disabled={pending} className="btn btn-primary btn-sm">
                {pending ? <LoaderCircle className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} {t("attach")}
              </button>
            )}
            <button type="button" onClick={() => setProposals(null)} className="btn btn-ghost btn-sm">
              <X className="size-3.5" /> {t("close")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
