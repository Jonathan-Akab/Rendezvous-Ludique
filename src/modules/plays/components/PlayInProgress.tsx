import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronRight, Timer } from "lucide-react";
import { getPlayDraft } from "../service";
import { LiveClock } from "./PlayTimer";

/** "Partie en cours": brings the member back to the play they started (home, Parties jouées). */
export async function PlayInProgress({ userId }: { userId: string }) {
  const draft = await getPlayDraft(userId);
  if (!draft) return null;
  const t = await getTranslations("plays.draft");
  const running = draft.clock.startedAt != null;
  const started = running || draft.clock.savedMs > 0;
  return (
    <Link href="/plays/new" className="card flex items-center gap-3 border-accent/60 bg-accent/10 p-4 transition hover:border-accent">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-accent-ink">
        <Timer className={`size-5 ${running ? "animate-pulse" : ""}`} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display font-bold">{t("banner")}</span>
        <span className="block truncate text-sm text-muted">
          {draft.gameName ?? t("noGame")}
          {started && (
            <>
              {" · "}
              <LiveClock clock={draft.clock} /> {running ? "" : `(${t("paused")})`}
            </>
          )}
        </span>
      </span>
      <span className="btn btn-primary btn-sm">
        {t("resume")} <ChevronRight className="size-4" />
      </span>
    </Link>
  );
}
