import { getTranslations } from "next-intl/server";
import { ArrowDown, ArrowUp, ExternalLink } from "lucide-react";
import { db } from "@/lib/db";
import { ActionForm } from "@/components/ActionForm";
import { ConfirmButton } from "@/components/forms";
import { AdminHeader } from "@/modules/admin/components/AdminUi";
import { deleteFacebookGroupAction, moveFacebookGroupAction, saveFacebookGroupAction } from "@/modules/facebook/actions";

export async function generateMetadata() {
  return { title: (await getTranslations("admin.nav"))("facebook") };
}

type Group = { name: string; url: string; description: string | null; region: string | null; active: boolean };

async function Fields({ group }: { group?: Group }) {
  const t = await getTranslations("admin.facebook");
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <label className="label">{t("name")}</label>
        <input name="name" defaultValue={group?.name} className="input" required maxLength={100} />
      </div>
      <div>
        <label className="label">{t("region")}</label>
        <input name="region" defaultValue={group?.region ?? ""} className="input" placeholder={t("regionPlaceholder")} />
      </div>
      <div className="sm:col-span-2">
        <label className="label">{t("url")}</label>
        <input name="url" type="url" defaultValue={group?.url} className="input" required placeholder="https://www.facebook.com/groups/…" />
      </div>
      <div className="sm:col-span-2">
        <label className="label">{t("description")}</label>
        <textarea name="description" defaultValue={group?.description ?? ""} className="textarea min-h-16" maxLength={1000} />
      </div>
      {group && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="active" defaultChecked={group.active} className="size-4 accent-[var(--accent)]" /> {t("active")}
        </label>
      )}
    </div>
  );
}

export default async function AdminFacebookPage() {
  const t = await getTranslations("admin.facebook");
  const groups = await db.facebookGroup.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  return (
    <div className="max-w-4xl space-y-6">
      <AdminHeader title={t("title")} lead={t("lead")} />
      <section className="card card-pad">
        <h2 className="section-title mb-4 text-base">{t("add")}</h2>
        <ActionForm action={saveFacebookGroupAction.bind(null, null)} submitLabel={t("create")}>
          <Fields />
        </ActionForm>
      </section>
      <section className="space-y-2">
        {groups.map((g, i) => (
          <details key={g.id} className="card">
            <summary className="flex cursor-pointer flex-wrap items-center gap-3 p-4">
              <span className={`flex-1 font-semibold ${g.active ? "" : "text-muted line-through"}`}>{g.name}</span>
              {g.region && <span className="chip">{g.region}</span>}
              <a href={g.url} target="_blank" rel="noopener noreferrer" className="text-muted hover:text-accent" title={t("openLink")}>
                <ExternalLink className="size-4" />
              </a>
              <form className="flex gap-0.5">
                <button formAction={moveFacebookGroupAction.bind(null, g.id, -1)} disabled={i === 0} className="rounded p-1 text-muted hover:bg-surface-2 disabled:opacity-30" title={t("moveUp")}>
                  <ArrowUp className="size-4" />
                </button>
                <button formAction={moveFacebookGroupAction.bind(null, g.id, 1)} disabled={i === groups.length - 1} className="rounded p-1 text-muted hover:bg-surface-2 disabled:opacity-30" title={t("moveDown")}>
                  <ArrowDown className="size-4" />
                </button>
              </form>
            </summary>
            <div className="space-y-4 border-t border-line p-4">
              <ActionForm action={saveFacebookGroupAction.bind(null, g.id)} submitLabel={t("save")}>
                <Fields group={g} />
              </ActionForm>
              <form action={deleteFacebookGroupAction.bind(null, g.id)} className="flex justify-end">
                <ConfirmButton message={t("deleteConfirm", { name: g.name })}>{t("delete")}</ConfirmButton>
              </form>
            </div>
          </details>
        ))}
      </section>
    </div>
  );
}
