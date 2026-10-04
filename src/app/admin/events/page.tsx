import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { ilike } from "@/lib/search";
import { ConfirmButton } from "@/components/forms";
import { AdminHeader, AdminTable, SearchBar, Td } from "@/modules/admin/components/AdminUi";
import { adminDeleteEventAction, adminEventStatusAction } from "@/modules/admin/actions";
import type { Prisma } from "@/generated/prisma/client";

export async function generateMetadata() {
  return { title: (await getTranslations("admin.nav"))("events") };
}

export default async function AdminEventsPage({ searchParams }: { searchParams: Promise<{ q?: string; when?: string }> }) {
  const [sp, t, te, format] = await Promise.all([searchParams, getTranslations("admin.events"), getTranslations("events"), getFormatter()]);
  const where: Prisma.EventWhereInput = {};
  if (sp.q) where.OR = [{ title: ilike(sp.q) }, { city: ilike(sp.q) }, { host: { displayName: ilike(sp.q) } }];
  if (sp.when === "past") where.startsAt = { lt: new Date() };
  else if (sp.when !== "all") where.startsAt = { gte: new Date() };

  const events = await db.event.findMany({
    where,
    include: { host: { select: { displayName: true, id: true } }, _count: { select: { attendees: true } } },
    orderBy: { startsAt: sp.when === "past" ? "desc" : "asc" },
    take: 300,
  });

  return (
    <div>
      <AdminHeader title={t("title")} lead={t("lead", { count: events.length })} />
      <SearchBar placeholder={t("search")} defaultValue={sp.q}>
        <select name="when" defaultValue={sp.when ?? "upcoming"} className="select w-auto" aria-label={t("when")}>
          <option value="upcoming">{te("when.upcoming")}</option>
          <option value="past">{te("when.past")}</option>
          <option value="all">{t("all")}</option>
        </select>
      </SearchBar>
      <AdminTable head={[t("event"), t("kind"), t("date"), t("host"), t("visibility"), t("attendees"), t("status"), ""]}>
        {events.map((e) => (
          <tr key={e.id}>
            <Td>
              <Link href={`/events/${e.id}`} className="font-semibold hover:text-accent" target="_blank">
                {e.title}
              </Link>
              {e.city && <span className="block text-xs text-muted">{e.city}</span>}
            </Td>
            <Td className="text-xs">{te(`kinds.${e.kind}`)}</Td>
            <Td className="whitespace-nowrap text-xs">{format.dateTime(e.startsAt, { dateStyle: "medium", timeStyle: "short" })}</Td>
            <Td>
              <Link href={`/admin/members/${e.host.id}`} className="hover:text-accent">
                {e.host.displayName}
              </Link>
            </Td>
            <Td className="text-xs">{te(`visibility.${e.visibility}`)}</Td>
            <Td>{e._count.attendees}</Td>
            <Td>
              <span className={`chip ${e.status === "SCHEDULED" ? "text-success" : "text-danger"}`}>
                {e.status === "SCHEDULED" ? t("scheduled") : te("cancelled")}
              </span>
            </Td>
            <Td>
              <div className="flex justify-end gap-1">
                <Link href={`/admin/events/${e.id}`} className="btn btn-secondary btn-sm">
                  {t("edit")}
                </Link>
                <form action={adminEventStatusAction.bind(null, e.id, e.status === "SCHEDULED" ? "CANCELLED" : "SCHEDULED")}>
                  <button className="btn btn-ghost btn-sm">{e.status === "SCHEDULED" ? te("cancel") : te("restore")}</button>
                </form>
                <form action={adminDeleteEventAction.bind(null, e.id)}>
                  <ConfirmButton message={t("deleteConfirm", { title: e.title })}>{t("delete")}</ConfirmButton>
                </form>
              </div>
            </Td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}
