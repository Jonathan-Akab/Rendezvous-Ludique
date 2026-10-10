import { Fragment } from "react";
import { getFormatter, getTranslations } from "next-intl/server";
import { Megaphone, Pin, PinOff, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { can } from "@/lib/auth/permissions";
import { Meeple } from "@/components/Meeple";
import { ConfirmButton } from "@/components/forms";
import { deleteAnnouncementAction, toggleAnnouncementPinAction } from "../actions";
import { NewAnnouncement } from "./NewAnnouncement";
import { EditableAnnouncement } from "./EditAnnouncement";

// "Babillard" on the home page: messages from the team. Pinned ones stay on top; the latest
// others follow, older ones fold away.

const SHOWN = 3; // unpinned messages shown before "older messages"
const URL_RE = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g;

/** Plain text with its links made clickable. */
function Linkified({ text }: { text: string }) {
  return (
    <>
      {text.split(URL_RE).map((part, i) =>
        i % 2 === 1 ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="link break-all">
            {part}
          </a>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

export async function AnnouncementBoard({ user }: { user: { id: string; role: string; permissions: string | null } }) {
  const canWrite = can(user, "announcements");
  const [rows, t, format] = await Promise.all([
    db.announcement.findMany({
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      take: 30,
      include: { author: { select: { displayName: true, meepleColor: true } } },
    }),
    getTranslations("announcements"),
    getFormatter(),
  ]);
  if (!rows.length && !canWrite) return null;

  const pinned = rows.filter((r) => r.pinned);
  const others = rows.filter((r) => !r.pinned);
  const message = (a: (typeof rows)[number]) => (
    <li key={a.id} className={`rounded-2xl border p-4 ${a.pinned ? "border-accent/60 bg-accent/10" : "border-line/70 bg-surface-2/40"}`}>
      <div className="mb-2 flex items-center gap-2 text-xs text-muted">
        <Meeple color={a.author?.meepleColor ?? "#868e96"} size={18} />
        <span className="font-semibold text-ink">{a.author?.displayName ?? t("team")}</span>
        <span>· {format.relativeTime(a.createdAt)}</span>
        {a.pinned && (
          <span className="chip chip-accent gap-1 px-2 py-0 text-[10px]">
            <Pin className="size-3 fill-current" /> {t("pinned")}
          </span>
        )}
        {canWrite && (
          <span className="ml-auto flex items-center gap-1">
            <form action={toggleAnnouncementPinAction.bind(null, a.id)}>
              <button type="submit" className="rounded-lg p-1 text-muted hover:text-accent" title={a.pinned ? t("unpin") : t("pin")}>
                {a.pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
              </button>
            </form>
            <form action={deleteAnnouncementAction.bind(null, a.id)}>
              <ConfirmButton message={t("deleteConfirm")} className="rounded-lg p-1 text-muted hover:text-danger" title={t("delete")}>
                <Trash2 className="size-4" />
              </ConfirmButton>
            </form>
          </span>
        )}
      </div>
      {canWrite ? (
        <EditableAnnouncement id={a.id} body={a.body}>
          <p className="whitespace-pre-line text-sm leading-relaxed">
            <Linkified text={a.body} />
          </p>
        </EditableAnnouncement>
      ) : (
        <p className="whitespace-pre-line text-sm leading-relaxed">
          <Linkified text={a.body} />
        </p>
      )}
    </li>
  );

  return (
    <section className="card card-pad space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="section-title flex items-center gap-2">
          <Megaphone className="size-5 text-accent" /> {t("title")}
        </h2>
        {canWrite && <NewAnnouncement />}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted">{t("empty")}</p>
      ) : (
        <ul className="space-y-3">
          {pinned.map(message)}
          {others.slice(0, SHOWN).map(message)}
          {others.length > SHOWN && (
            <li>
              <details>
                <summary className="cursor-pointer list-none text-sm font-semibold text-muted hover:text-ink">{t("older", { count: others.length - SHOWN })}</summary>
                <ul className="mt-3 space-y-3">{others.slice(SHOWN).map(message)}</ul>
              </details>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
