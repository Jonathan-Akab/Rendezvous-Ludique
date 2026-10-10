import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { MessageSquareReply, Trash2 } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { requireModule } from "@/lib/modules";
import { db } from "@/lib/db";
import { SUGGESTION_STATUSES } from "@/lib/constants";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmButton } from "@/components/forms";
import { VoteButton } from "@/modules/suggestions/components/VoteButton";
import { NewSuggestionButton } from "@/modules/suggestions/components/NewSuggestionButton";
import { deleteMySuggestionAction } from "@/modules/suggestions/actions";
import type { Prisma } from "@/generated/prisma/client";

export async function generateMetadata() {
  return { title: (await getTranslations("suggestions"))("title") };
}

type Search = { sort?: string; status?: string; focus?: string };

const STATUS_STYLE: Record<string, string> = {
  OPEN: "",
  PLANNED: "chip-accent",
  DONE: "bg-success/15 text-success border-success/30",
  DECLINED: "text-muted line-through",
};

export default async function SuggestionsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const [user, mod, sp, t, format] = await Promise.all([requireUser(), requireModule("suggestions"), searchParams, getTranslations("suggestions"), getFormatter()]);
  if (!mod.settings.showToMembers) notFound();

  const sort = sp.sort === "recent" ? "recent" : "popular";
  const status = SUGGESTION_STATUSES.includes(sp.status as never) ? sp.status : undefined;
  // A notification can point at one suggestion (even a declined one): it always shows, highlighted.
  const focus = sp.focus ?? null;
  const base: Prisma.SuggestionWhereInput = status ? { status } : { status: { not: "DECLINED" } };
  const where: Prisma.SuggestionWhereInput = focus ? { OR: [base, { id: focus }] } : base;
  const suggestions = await db.suggestion.findMany({
    where,
    include: { _count: { select: { votes: true } }, votes: { where: { userId: user.id }, select: { userId: true } } },
    orderBy: sort === "recent" ? { createdAt: "desc" } : [{ votes: { _count: "desc" } }, { createdAt: "desc" }],
    take: 200,
  });

  const href = (next: Search) => {
    const q = new URLSearchParams();
    const merged = { sort, status, ...next };
    if (merged.sort === "recent") q.set("sort", "recent");
    if (merged.status) q.set("status", merged.status);
    const s = q.toString();
    return s ? `/suggestions?${s}` : "/suggestions";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">{t("title")}</h1>
          <p className="text-muted">{t("lead")}</p>
        </div>
        <NewSuggestionButton label={t("newSuggestion")} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl border border-line p-0.5 text-xs font-semibold">
          {(["popular", "recent"] as const).map((s) => (
            <Link key={s} href={href({ sort: s })} className={`rounded-lg px-3 py-1.5 ${sort === s ? "bg-accent text-accent-ink" : "text-muted"}`}>
              {t(`sort.${s}`)}
            </Link>
          ))}
        </div>
        <Link href={href({ status: undefined })} className={`chip px-3 py-1 text-xs ${!status ? "chip-accent" : ""}`}>
          {t("filterAll")}
        </Link>
        {SUGGESTION_STATUSES.map((s) => (
          <Link key={s} href={href({ status: s })} className={`chip px-3 py-1 text-xs ${status === s ? "chip-accent" : ""}`}>
            {t(`status.${s}`)}
          </Link>
        ))}
      </div>

      {suggestions.length === 0 ? (
        <EmptyState title={t("empty")} text={t("emptyHint")}>
          <NewSuggestionButton label={t("newSuggestion")} />
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {suggestions.map((s) => (
            <li key={s.id} id={`s-${s.id}`} className={`card flex scroll-mt-24 gap-4 p-4 ${s.id === focus ? "ring-2 ring-accent" : ""}`}>
              <VoteButton suggestionId={s.id} votes={s._count.votes} voted={s.votes.length > 0} />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{s.title}</p>
                  <span className={`chip text-[11px] ${STATUS_STYLE[s.status] ?? ""}`}>{t(`status.${s.status}`)}</span>
                  {s.authorId === user.id && <span className="text-[11px] text-accent">{t("mine")}</span>}
                </div>
                {s.details && <p className="whitespace-pre-line text-sm text-muted">{s.details}</p>}
                {s.adminNote && (
                  <div className="flex gap-2 rounded-xl bg-accent/10 px-3 py-2 text-sm">
                    <MessageSquareReply className="mt-0.5 size-4 shrink-0 text-accent" />
                    <p>
                      <span className="font-semibold">{t("adminReply")} </span>
                      {s.adminNote}
                    </p>
                  </div>
                )}
                <div className="flex items-center gap-3 text-xs text-muted">
                  <span>{format.relativeTime(s.createdAt)}</span>
                  {s.authorId === user.id && s._count.votes <= 1 && (
                    <form action={deleteMySuggestionAction.bind(null, s.id)}>
                      <ConfirmButton message={t("deleteConfirm")} className="inline-flex items-center gap-1 hover:text-danger">
                        <Trash2 className="size-3" /> {t("delete")}
                      </ConfirmButton>
                    </form>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
