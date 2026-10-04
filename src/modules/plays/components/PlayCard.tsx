import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import { Clock, Crown, MapPin, Pencil, Trash2 } from "lucide-react";
import { ConfirmButton } from "@/components/forms";
import { Meeple } from "@/components/Meeple";
import { deletePlayAction } from "../actions";
import type { PlayWithDetails } from "../service";

export async function PlayCard({ play, viewerId, children }: { play: PlayWithDetails; viewerId: string; children?: React.ReactNode }) {
  const [t, format] = await Promise.all([getTranslations("plays"), getFormatter()]);
  const seats = play.participants.filter((p) => p.status !== "DECLINED");
  return (
    <article className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-bold">{play.game.name}</h3>
          <p className="flex flex-wrap items-center gap-x-3 text-xs text-muted">
            <span>{format.dateTime(play.playedAt, { dateStyle: "medium" })}</span>
            {play.durationMin && (
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3" /> {play.durationMin} min
              </span>
            )}
            {play.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3" /> {play.location}
              </span>
            )}
          </p>
        </div>
        {play.createdById === viewerId && (
          <div className="flex items-center gap-1">
            <Link href={`/plays/${play.id}/edit`} className="p-1 text-muted hover:text-accent" title={t("edit")}>
              <Pencil className="size-4" />
            </Link>
            <form action={deletePlayAction.bind(null, play.id)}>
              <ConfirmButton message={t("deleteConfirm")} className="p-1 text-muted hover:text-danger" title={t("delete")}>
                <Trash2 className="size-4" />
              </ConfirmButton>
            </form>
          </div>
        )}
      </div>
      <ul className="mt-3 flex flex-wrap gap-2">
        {seats.map((p) => (
          <li
            key={p.id}
            className={`flex items-center gap-1.5 rounded-full border py-0.5 pl-1 pr-2.5 text-xs ${
              p.isWinner ? "border-accent bg-accent/10 font-bold" : "border-line bg-surface-2"
            } ${p.status === "PENDING" ? "opacity-60" : ""}`}
            title={p.status === "PENDING" ? t("awaiting") : undefined}
          >
            <Meeple color={p.user?.meepleColor ?? "#868e96"} size={18} />
            {p.user?.displayName ?? p.guestName}
            {p.score != null && <span className="text-muted">· {p.score}</span>}
            {p.isWinner && <Crown className="size-3 text-accent" aria-label={t("form.winner")} />}
          </li>
        ))}
      </ul>
      {play.notes && <p className="mt-2 text-sm text-muted">{play.notes}</p>}
      {children}
    </article>
  );
}
