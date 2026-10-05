"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { ChevronUp } from "lucide-react";
import { toggleSuggestionVoteAction } from "../actions";

/** Up-vote toggle; updates instantly and syncs with the server. */
export function VoteButton({ suggestionId, votes, voted, compact = false }: { suggestionId: string; votes: number; voted: boolean; compact?: boolean }) {
  const t = useTranslations("suggestions");
  const [state, setState] = useState({ votes, voted });
  const [pending, start] = useTransition();

  const toggle = () => {
    const optimistic = { voted: !state.voted, votes: state.votes + (state.voted ? -1 : 1) };
    setState(optimistic);
    start(async () => {
      const res = await toggleSuggestionVoteAction(suggestionId);
      if (res) setState(res);
    });
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={state.voted}
      title={state.voted ? t("unvote") : t("vote")}
      className={`flex shrink-0 flex-col items-center justify-center rounded-2xl border font-bold transition ${
        compact ? "min-w-12 px-2 py-1 text-xs" : "min-w-14 px-2 py-2 text-sm"
      } ${state.voted ? "border-accent bg-accent text-accent-ink" : "border-line/70 text-muted hover:border-accent hover:text-accent"}`}
    >
      <ChevronUp className={compact ? "size-4" : "size-5"} />
      {state.votes}
    </button>
  );
}
