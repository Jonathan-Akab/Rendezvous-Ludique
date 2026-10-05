import Link from "next/link";
import { requirePermission } from "@/lib/auth/guards";
import { getFormatter, getTranslations } from "next-intl/server";
import { ChevronUp } from "lucide-react";
import { db } from "@/lib/db";
import { SUGGESTION_STATUSES } from "@/lib/constants";
import { ActionForm } from "@/components/ActionForm";
import { ConfirmButton } from "@/components/forms";
import { AdminHeader } from "@/modules/admin/components/AdminUi";
import { deleteSuggestionAction, mergeSuggestionAction, updateSuggestionAction } from "@/modules/suggestions/actions";

export async function generateMetadata() {
  return { title: (await getTranslations("admin.nav"))("suggestions") };
}

export default async function AdminSuggestionsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requirePermission("suggestions");
  const [sp, t, ts, format] = await Promise.all([searchParams, getTranslations("admin.suggestions"), getTranslations("suggestions"), getFormatter()]);
  const status = SUGGESTION_STATUSES.includes(sp.status as never) ? sp.status : undefined;
  const [suggestions, counts] = await Promise.all([
    db.suggestion.findMany({
      where: status ? { status } : {},
      include: {
        author: { select: { displayName: true, username: true } },
        votes: { include: { user: { select: { displayName: true } } }, orderBy: { createdAt: "asc" } },
      },
      orderBy: [{ votes: { _count: "desc" } }, { createdAt: "desc" }],
      take: 300,
    }),
    db.suggestion.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const count = (s?: string) => counts.filter((c) => !s || c.status === s).reduce((n, c) => n + c._count._all, 0);
  const all = await db.suggestion.findMany({ select: { id: true, title: true }, orderBy: { title: "asc" } });

  return (
    <div className="max-w-4xl space-y-6">
      <AdminHeader title={t("title")} lead={t("lead", { count: count() })} />

      <div className="flex flex-wrap gap-2">
        <Link href="/admin/suggestions" className={`chip px-3 py-1 text-xs ${!status ? "chip-accent" : ""}`}>
          {t("filterAll")} ({count()})
        </Link>
        {SUGGESTION_STATUSES.map((s) => (
          <Link key={s} href={`/admin/suggestions?status=${s}`} className={`chip px-3 py-1 text-xs ${status === s ? "chip-accent" : ""}`}>
            {ts(`status.${s}`)} ({count(s)})
          </Link>
        ))}
      </div>

      {suggestions.length === 0 ? (
        <p className="card card-pad text-muted">{t("empty")}</p>
      ) : (
        <div className="space-y-2">
          {suggestions.map((s) => (
            <details key={s.id} className="card">
              <summary className="flex cursor-pointer items-center gap-3 p-4">
                <span className="flex min-w-12 flex-col items-center rounded-xl border border-line px-2 py-1 text-sm font-bold">
                  <ChevronUp className="size-4" />
                  {s.votes.length}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{s.title}</span>
                  <span className="block text-xs text-muted">
                    {t("by", { name: s.author?.displayName ?? t("anonymous") })} · {format.relativeTime(s.createdAt)}
                  </span>
                </span>
                <span className="chip text-[11px]">{ts(`status.${s.status}`)}</span>
              </summary>
              <div className="space-y-4 border-t border-line p-4">
                {s.details && <p className="whitespace-pre-line rounded-xl bg-surface-2/60 p-3 text-sm">{s.details}</p>}
                <p className="text-xs text-muted">
                  {t("voters")} : {s.votes.map((v) => v.user.displayName).join(", ") || "—"}
                </p>
                <ActionForm action={updateSuggestionAction.bind(null, s.id)} submitLabel={t("save")}>
                  <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
                    <div>
                      <label className="label">{t("titleLabel")}</label>
                      <input name="title" defaultValue={s.title} className="input" maxLength={140} required />
                    </div>
                    <div>
                      <label className="label">{t("status")}</label>
                      <select name="status" defaultValue={s.status} className="select">
                        {SUGGESTION_STATUSES.map((x) => (
                          <option key={x} value={x}>
                            {ts(`status.${x}`)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="label">{t("note")}</label>
                    <textarea name="adminNote" defaultValue={s.adminNote ?? ""} className="textarea min-h-16" maxLength={2000} placeholder={t("notePlaceholder")} />
                  </div>
                </ActionForm>
                <div className="flex flex-wrap items-end justify-between gap-3 border-t border-line pt-4">
                  {all.length > 1 && (
                    <ActionForm action={mergeSuggestionAction.bind(null, s.id)} submitLabel={t("merge")} submitClassName="btn btn-secondary btn-sm" className="flex flex-wrap items-end gap-2">
                      <div>
                        <label className="label">{t("mergeInto")}</label>
                        <select name="targetId" className="select w-64" required defaultValue="">
                          <option value="" disabled>
                            —
                          </option>
                          {all
                            .filter((o) => o.id !== s.id)
                            .map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.title}
                              </option>
                            ))}
                        </select>
                      </div>
                    </ActionForm>
                  )}
                  <form action={deleteSuggestionAction.bind(null, s.id)}>
                    <ConfirmButton message={t("deleteConfirm")}>{t("delete")}</ConfirmButton>
                  </form>
                </div>
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
