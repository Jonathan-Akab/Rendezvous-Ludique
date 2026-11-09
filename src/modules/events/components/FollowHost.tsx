"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { BellPlus, BellRing } from "lucide-react";
import { Popup } from "@/components/Popup";
import { followHostAction, unfollowHostAction } from "../follow";

/** "M'avertir de ses prochaines parties": follow the host, for similar games or all of them. */
export function FollowHost({ eventId, hostId, hostName, following }: { eventId: string; hostId: string; hostName: string; following: "similar" | "all" | null }) {
  const t = useTranslations("events.follow");
  const [open, setOpen] = useState(false);
  const [state, setState] = useState(following);
  const [pending, start] = useTransition();

  const follow = (similar: boolean) =>
    start(async () => {
      await followHostAction(eventId, similar);
      setState(similar ? "similar" : "all");
      setOpen(false);
    });
  const unfollow = () =>
    start(async () => {
      await unfollowHostAction(hostId);
      setState(null);
    });

  if (state) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-accent/10 px-3 py-2 text-sm">
        <BellRing className="size-4 text-accent" />
        <span className="flex-1">{t(state === "similar" ? "followingSimilar" : "followingAll", { name: hostName })}</span>
        <button type="button" onClick={unfollow} disabled={pending} className="text-xs font-semibold text-muted underline hover:text-danger">
          {t("stop")}
        </button>
      </div>
    );
  }
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn btn-secondary btn-sm">
        <BellPlus className="size-4" /> {t("button", { name: hostName })}
      </button>
      <Popup open={open} onClose={() => setOpen(false)} title={t("title", { name: hostName })} icon={<BellPlus className="size-5" />} closeLabel={t("cancel")}>
        <p className="text-sm text-muted">{t("lead")}</p>
        <div className="grid gap-2">
          <button type="button" disabled={pending} onClick={() => follow(true)} className="rounded-2xl border-2 border-accent bg-accent/10 p-3 text-left transition hover:bg-accent/20" autoFocus>
            <span className="block font-bold text-accent">{t("similar")}</span>
            <span className="text-xs text-muted">{t("similarText")}</span>
          </button>
          <button type="button" disabled={pending} onClick={() => follow(false)} className="rounded-2xl border-2 border-line p-3 text-left transition hover:border-accent/60">
            <span className="block font-bold">{t("all")}</span>
            <span className="text-xs text-muted">{t("allText")}</span>
          </button>
        </div>
        <p className="text-xs text-muted">{t("emailNote")}</p>
      </Popup>
    </>
  );
}
