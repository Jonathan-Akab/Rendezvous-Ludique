import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { getModuleStates } from "@/lib/modules";
import { requireStaff } from "@/lib/auth/guards";
import { permissionsOf, type Permission } from "@/lib/auth/permissions";
import { MODULES } from "@/modules/registry";
import { MeepleAvatar } from "@/components/Meeple";
import { Stagger, StaggerItem } from "@/components/Motion";
import { AdminHeader } from "@/modules/admin/components/AdminUi";

export default async function AdminDashboard() {
  const [me, t, tm, format, modules] = await Promise.all([requireStaff(), getTranslations("admin.dashboard"), getTranslations("nav"), getFormatter(), getModuleStates()]);
  // Each card only for staff who have that section's right.
  const allowed = permissionsOf(me);
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [members, newMembers, suspended, upcoming, games, libraries, plays, recentUsers, recentAudit] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { createdAt: { gte: weekAgo } } }),
    db.user.count({ where: { status: "SUSPENDED" } }),
    db.event.count({ where: { startsAt: { gte: now }, status: "SCHEDULED" } }),
    db.game.count(),
    db.library.count(),
    db.play.count(),
    db.user.findMany({ orderBy: { createdAt: "desc" }, take: 6, select: { id: true, displayName: true, username: true, meepleColor: true, createdAt: true, role: true } }),
    db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { actor: { select: { displayName: true } } } }),
  ]);

  const stats = [
    { label: t("members"), value: members, sub: t("newThisWeek", { count: newMembers }), href: "/admin/members", perm: "members" },
    { label: t("upcomingEvents"), value: upcoming, href: "/admin/events", perm: "events" },
    { label: t("games"), value: games, href: "/admin/games", perm: "games" },
    { label: t("libraries"), value: libraries, href: "/admin/libraries", perm: "libraries" },
    { label: t("plays"), value: plays, href: "/admin/plays", perm: "plays" },
    { label: t("suspended"), value: suspended, href: "/admin/members?status=SUSPENDED", perm: "members" },
  ].filter((s) => allowed.has(s.perm as Permission));

  return (
    <div className="space-y-8">
      <AdminHeader title={t("title")} lead={t("lead")} />
      <Stagger className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {stats.map((s) => (
          <StaggerItem key={s.label}>
            <Link href={s.href} className="card block p-4 hover:border-accent">
              <p className="font-display text-3xl font-black">{s.value}</p>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">{s.label}</p>
              {s.sub && <p className="mt-1 text-xs text-accent">{s.sub}</p>}
            </Link>
          </StaggerItem>
        ))}
      </Stagger>

      <div className="grid gap-6 lg:grid-cols-3">
        {allowed.has("modules") && (
        <section className="card card-pad">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="section-title text-base">{t("modules")}</h2>
            <Link href="/admin/modules" className="link text-xs">
              {t("manage")}
            </Link>
          </div>
          <ul className="space-y-2 text-sm">
            {MODULES.map((m) => (
              <li key={m.key} className="flex items-center justify-between">
                <span>{tm(m.key)}</span>
                <span className={`chip ${modules[m.key].enabled ? "text-success" : "text-danger"}`}>
                  {modules[m.key].enabled ? t("on") : t("off")}
                </span>
              </li>
            ))}
          </ul>
        </section>
        )}

        {allowed.has("members") && (
        <section className="card card-pad">
          <h2 className="section-title mb-3 text-base">{t("newMembers")}</h2>
          <ul className="space-y-2">
            {recentUsers.map((u) => (
              <li key={u.id}>
                <Link href={`/admin/members/${u.id}`} className="flex items-center gap-2 text-sm hover:text-accent">
                  <MeepleAvatar color={u.meepleColor} size={28} />
                  <span className="flex-1 truncate">{u.displayName}</span>
                  <span className="text-xs text-muted">{format.relativeTime(u.createdAt, now)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
        )}

        {allowed.has("audit") && (
        <section className="card card-pad">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="section-title text-base">{t("activity")}</h2>
            <Link href="/admin/audit" className="link text-xs">
              {t("seeAll")}
            </Link>
          </div>
          {recentAudit.length === 0 ? (
            <p className="text-sm text-muted">—</p>
          ) : (
            <ul className="space-y-2 text-xs">
              {recentAudit.map((a) => (
                <li key={a.id} className="flex gap-2">
                  <span className="shrink-0 text-muted">{format.relativeTime(a.createdAt, now)}</span>
                  <span className="truncate">
                    <b>{a.actor?.displayName ?? "—"}</b> · <code>{a.action}</code> {a.target}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        )}
      </div>
    </div>
  );
}
