import { getFormatter, getTranslations } from "next-intl/server";
import { Check, X } from "lucide-react";
import { requirePermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { getSiteSettings } from "@/lib/settings";
import { ConfirmButton } from "@/components/forms";
import { MeepleAvatar } from "@/components/Meeple";
import { AdminHeader } from "@/modules/admin/components/AdminUi";
import { approveSignupAction, rejectSignupAction } from "@/modules/admin/actions";

export async function generateMetadata() {
  return { title: (await getTranslations("admin.nav"))("registrations") };
}

/** Sign-ups waiting for a team member's approval (against fake accounts). */
export default async function AdminRegistrationsPage() {
  await requirePermission("registrations");
  const [t, format, settings] = await Promise.all([getTranslations("admin.registrations"), getFormatter(), getSiteSettings()]);
  const pending = await db.user.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" } });

  return (
    <div className="max-w-4xl space-y-6">
      <AdminHeader title={t("title")} lead={settings.registrationApproval ? t("lead") : t("leadOff")} />
      {pending.length === 0 ? (
        <p className="card card-pad text-muted">{t("empty")}</p>
      ) : (
        <ul className="space-y-3">
          {pending.map((u) => (
            <li key={u.id} className="card flex flex-wrap items-start gap-4 p-4">
              <MeepleAvatar color={u.meepleColor} size={44} />
              <div className="min-w-56 flex-1 space-y-1">
                <p className="font-semibold">
                  {u.displayName} <span className="text-sm font-normal text-muted">@{u.username}</span>
                </p>
                <p className="text-sm text-muted">
                  {u.email} · {format.relativeTime(u.createdAt)}
                </p>
                {u.signupNote ? (
                  <p className="rounded-xl bg-surface-2/70 px-3 py-2 text-sm">
                    <span className="font-semibold">{t("note")} </span>
                    {u.signupNote}
                  </p>
                ) : (
                  <p className="text-xs text-muted">{t("noNote")}</p>
                )}
              </div>
              <div className="flex gap-2">
                <form action={approveSignupAction.bind(null, u.id)}>
                  <button className="btn btn-primary btn-sm">
                    <Check className="size-4" /> {t("approve")}
                  </button>
                </form>
                <form action={rejectSignupAction.bind(null, u.id)}>
                  <ConfirmButton message={t("rejectConfirm", { name: u.displayName })} className="btn btn-ghost btn-sm text-danger">
                    <X className="size-4" /> {t("reject")}
                  </ConfirmButton>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
