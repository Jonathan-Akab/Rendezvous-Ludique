import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { ilike } from "@/lib/search";
import { requireRole } from "@/lib/auth/guards";
import { ROLES, USER_STATUSES } from "@/lib/constants";
import { MeepleAvatar } from "@/components/Meeple";
import { AdminHeader, AdminTable, SearchBar, Td } from "@/modules/admin/components/AdminUi";
import { quickSetRoleAction, setMemberStatusAction } from "@/modules/admin/actions";
import type { Prisma } from "@/generated/prisma/client";

export async function generateMetadata() {
  return { title: (await getTranslations("admin.nav"))("members") };
}

export default async function AdminMembersPage({ searchParams }: { searchParams: Promise<{ q?: string; role?: string; status?: string }> }) {
  const [me, sp, t, format] = await Promise.all([requireRole("ADMIN"), searchParams, getTranslations("admin.members"), getFormatter()]);
  const where: Prisma.UserWhereInput = {};
  if (sp.q) where.OR = [{ displayName: ilike(sp.q) }, { username: ilike(sp.q) }, { email: ilike(sp.q) }, { city: ilike(sp.q) }];
  if (ROLES.includes(sp.role as never)) where.role = sp.role;
  if (USER_STATUSES.includes(sp.status as never)) where.status = sp.status;

  const users = await db.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { _count: { select: { hostedEvents: true, playsCreated: true } } },
  });

  return (
    <div>
      <AdminHeader title={t("title")} lead={t("lead", { count: users.length })} />
      <SearchBar placeholder={t("search")} defaultValue={sp.q}>
        <select name="role" defaultValue={sp.role ?? ""} className="select w-auto" aria-label={t("role")}>
          <option value="">{t("allRoles")}</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {t(`roles.${r}`)}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={sp.status ?? ""} className="select w-auto" aria-label={t("status")}>
          <option value="">{t("allStatuses")}</option>
          {USER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`statuses.${s}`)}
            </option>
          ))}
        </select>
      </SearchBar>
      <AdminTable head={[t("member"), t("email"), t("role"), t("status"), t("activity"), t("joined"), ""]}>
        {users.map((u) => (
          <tr key={u.id} className={u.status === "SUSPENDED" ? "opacity-60" : ""}>
            <Td>
              <Link href={`/admin/members/${u.id}`} className="flex items-center gap-2 font-semibold hover:text-accent">
                <MeepleAvatar color={u.meepleColor} size={30} />
                <span>
                  {u.displayName}
                  <span className="block text-xs font-normal text-muted">@{u.username}</span>
                </span>
              </Link>
            </Td>
            <Td className="text-muted">{u.email}</Td>
            <Td>
              {u.id === me.id ? (
                <span className="chip">{t(`roles.${u.role}`)}</span>
              ) : (
                <form action={quickSetRoleAction.bind(null, u.id)} className="flex gap-1">
                  <select name="role" defaultValue={u.role} className="select w-auto py-1 text-xs" aria-label={t("role")}>
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {t(`roles.${r}`)}
                      </option>
                    ))}
                  </select>
                  <button className="btn btn-ghost btn-sm">✓</button>
                </form>
              )}
            </Td>
            <Td>
              <span className={`chip ${u.status === "ACTIVE" ? "text-success" : "text-danger"}`}>{t(`statuses.${u.status}`)}</span>
            </Td>
            <Td className="text-xs text-muted">{t("activityCount", { events: u._count.hostedEvents, plays: u._count.playsCreated })}</Td>
            <Td className="whitespace-nowrap text-xs text-muted">{format.dateTime(u.createdAt, { dateStyle: "medium" })}</Td>
            <Td>
              <div className="flex justify-end gap-1">
                {u.id !== me.id && (
                  <form action={setMemberStatusAction.bind(null, u.id, u.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE")}>
                    <button className="btn btn-ghost btn-sm">{u.status === "ACTIVE" ? t("suspend") : t("reactivate")}</button>
                  </form>
                )}
                <Link href={`/admin/members/${u.id}`} className="btn btn-secondary btn-sm">
                  {t("edit")}
                </Link>
              </div>
            </Td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}
