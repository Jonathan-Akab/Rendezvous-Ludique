import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/guards";
import { ROLES, USER_STATUSES, VISIBILITIES } from "@/lib/constants";
import { ActionForm } from "@/components/ActionForm";
import { ConfirmButton } from "@/components/forms";
import { MeepleAvatar } from "@/components/Meeple";
import { AdminHeader } from "@/modules/admin/components/AdminUi";
import { deleteMemberAction, resetPasswordAction, revokeSessionsAction, updateMemberAction } from "@/modules/admin/actions";

export default async function AdminMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, me, t, tp, format] = await Promise.all([
    params,
    requireRole("ADMIN"),
    getTranslations("admin.members"),
    getTranslations("profile.visibility"),
    getFormatter(),
  ]);
  const u = await db.user.findUnique({
    where: { id },
    include: {
      _count: { select: { hostedEvents: true, playsCreated: true, sessions: true, libraryMembers: true } },
      sessions: { orderBy: { createdAt: "desc" }, take: 5 },
    },
  });
  if (!u) notFound();
  const isMe = u.id === me.id;

  const field = (name: string, label: string, value: string | number | null, type = "text") => (
    <div>
      <label className="label" htmlFor={name}>
        {label}
      </label>
      <input id={name} name={name} type={type} step={type === "number" ? "any" : undefined} defaultValue={value ?? ""} className="input" />
    </div>
  );

  return (
    <div className="space-y-6">
      <Link href="/admin/members" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> {t("back")}
      </Link>
      <AdminHeader title={u.displayName} lead={`@${u.username} · ${t("joinedOn", { date: format.dateTime(u.createdAt, { dateStyle: "long" }) })}`}>
        <div className="flex items-center gap-3">
          <MeepleAvatar color={u.meepleColor} size={56} />
          <Link href={`/members/${u.username}`} className="btn btn-secondary btn-sm" target="_blank">
            <ExternalLink className="size-3.5" /> {t("viewProfile")}
          </Link>
        </div>
      </AdminHeader>

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <section className="card card-pad">
          <h2 className="section-title mb-4">{t("account")}</h2>
          <ActionForm action={updateMemberAction.bind(null, u.id)} submitLabel={t("save")}>
            <div className="grid gap-4 sm:grid-cols-2">
              {field("displayName", t("displayName"), u.displayName)}
              {field("username", t("username"), u.username)}
              {field("email", t("email"), u.email, "email")}
              <div>
                <label className="label" htmlFor="meepleColor">
                  {t("meepleColor")}
                </label>
                <input id="meepleColor" name="meepleColor" type="color" defaultValue={u.meepleColor} className="h-10 w-full rounded-xl border border-line bg-surface" />
              </div>
              <div>
                <label className="label" htmlFor="role">
                  {t("role")}
                </label>
                <select id="role" name="role" defaultValue={u.role} className="select" disabled={isMe}>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {t(`roles.${r}`)}
                    </option>
                  ))}
                </select>
                {isMe && <input type="hidden" name="role" value={u.role} />}
              </div>
              <div>
                <label className="label" htmlFor="status">
                  {t("status")}
                </label>
                <select id="status" name="status" defaultValue={u.status} className="select" disabled={isMe}>
                  {USER_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {t(`statuses.${s}`)}
                    </option>
                  ))}
                </select>
                {isMe && <input type="hidden" name="status" value={u.status} />}
              </div>
              {field("city", t("city"), u.city)}
              {field("region", t("region"), u.region)}
              {field("latitude", t("latitude"), u.latitude, "number")}
              {field("longitude", t("longitude"), u.longitude, "number")}
              <div>
                <label className="label" htmlFor="profileVisibility">
                  {t("visibility")}
                </label>
                <select id="profileVisibility" name="profileVisibility" defaultValue={u.profileVisibility} className="select">
                  {VISIBILITIES.map((v) => (
                    <option key={v} value={v}>
                      {tp(v)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="locale">
                  {t("locale")}
                </label>
                <select id="locale" name="locale" defaultValue={u.locale} className="select">
                  <option value="fr">Français</option>
                  <option value="en">English</option>
                </select>
              </div>
            </div>
            <div>
              <label className="label" htmlFor="bio">
                {t("bio")}
              </label>
              <textarea id="bio" name="bio" defaultValue={u.bio ?? ""} className="textarea" />
            </div>
            <div className="flex flex-wrap gap-6 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" name="showLibrary" defaultChecked={u.showLibrary} className="size-4 accent-[var(--accent)]" /> {t("showLibrary")}
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="showPlays" defaultChecked={u.showPlays} className="size-4 accent-[var(--accent)]" /> {t("showPlays")}
              </label>
            </div>
          </ActionForm>
        </section>

        <div className="space-y-6">
          <section className="card card-pad space-y-2 text-sm">
            <h2 className="section-title mb-2 text-base">{t("overview")}</h2>
            <p>{t("hostedEvents", { count: u._count.hostedEvents })}</p>
            <p>{t("loggedPlays", { count: u._count.playsCreated })}</p>
            <p>{t("libraries", { count: u._count.libraryMembers })}</p>
            <p>{u.lastSeenAt ? t("lastSeen", { date: format.dateTime(u.lastSeenAt, { dateStyle: "medium", timeStyle: "short" }) }) : t("neverSeen")}</p>
          </section>

          <section className="card card-pad space-y-3">
            <h2 className="section-title text-base">{t("resetPassword")}</h2>
            <ActionForm action={resetPasswordAction.bind(null, u.id)} submitLabel={t("resetPassword")} submitClassName="btn btn-secondary">
              <input name="password" type="text" minLength={8} required className="input" placeholder={t("newPassword")} autoComplete="off" />
            </ActionForm>
          </section>

          <section className="card card-pad space-y-3">
            <h2 className="section-title text-base">{t("sessions", { count: u._count.sessions })}</h2>
            <ul className="space-y-1 text-xs text-muted">
              {u.sessions.map((s) => (
                <li key={s.id} className="truncate">
                  {format.dateTime(s.createdAt, { dateStyle: "short", timeStyle: "short" })} · {s.userAgent ?? "?"}
                </li>
              ))}
            </ul>
            <form action={revokeSessionsAction.bind(null, u.id)}>
              <button className="btn btn-secondary btn-sm">{t("revokeSessions")}</button>
            </form>
          </section>

          {!isMe && (
            <section className="card card-pad space-y-3 border-danger/40">
              <h2 className="section-title text-base text-danger">{t("dangerZone")}</h2>
              <p className="text-xs text-muted">{t("deleteWarning")}</p>
              <form action={deleteMemberAction.bind(null, u.id)}>
                <ConfirmButton message={t("deleteConfirm", { name: u.displayName })}>{t("delete")}</ConfirmButton>
              </form>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
