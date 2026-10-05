import { getTranslations } from "next-intl/server";
import { requirePermission } from "@/lib/auth/guards";
import { getModuleStates, getOrderedModules } from "@/lib/modules";
import { ArrowDown, ArrowDownUp, ArrowUp } from "lucide-react";
import { ActionForm } from "@/components/ActionForm";
import { ModuleIcon } from "@/components/icons";
import { AdminHeader } from "@/modules/admin/components/AdminUi";
import { moveModuleAction, saveModuleAction, applyMyMenuOrderAsDefaultAction } from "@/modules/admin/actions";
import { aiConfigured } from "@/modules/ai/service";

export async function generateMetadata() {
  return { title: (await getTranslations("admin.nav"))("modules") };
}

// Rendered straight from the module registry: a new module shows up here automatically.
export default async function AdminModulesPage() {
  await requirePermission("modules");
  const [states, ordered, t, tn] = await Promise.all([getModuleStates(), getOrderedModules(), getTranslations("admin.modules"), getTranslations("nav")]);

  return (
    <div className="space-y-6">
      <AdminHeader title={t("title")} lead={t("lead")}>
        <form action={applyMyMenuOrderAsDefaultAction}>
          <button className="btn btn-secondary btn-sm" title={t("useMyOrderHint")}>
            <ArrowDownUp className="size-4" /> {t("useMyOrder")}
          </button>
        </form>
      </AdminHeader>
      <div className="grid gap-4 xl:grid-cols-2">
        {ordered.map((m, index) => {
          const state = states[m.key];
          return (
            <section key={m.key} className="card card-pad">
              <ActionForm action={saveModuleAction.bind(null, m.key)} submitLabel={t("save")} submitClassName="btn btn-secondary btn-sm">
                <div className="flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-accent">
                    <ModuleIcon name={m.icon} className="size-5" />
                  </span>
                  <div className="flex-1">
                    <h2 className="section-title flex items-center gap-2 text-lg">
                      {tn(m.key)}
                      {m.href && (
                        <span className="ml-1 inline-flex gap-0.5">
                          <button formAction={moveModuleAction.bind(null, m.key, -1)} disabled={index === 0} className="rounded p-0.5 text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-30" title={t("moveUp")}>
                            <ArrowUp className="size-4" />
                          </button>
                          <button formAction={moveModuleAction.bind(null, m.key, 1)} disabled={index === ordered.length - 1} className="rounded p-0.5 text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-30" title={t("moveDown")}>
                            <ArrowDown className="size-4" />
                          </button>
                        </span>
                      )}
                    </h2>
                    <p className="text-sm text-muted">{t(`descriptions.${m.key}`)}</p>
                  </div>
                  {m.core ? (
                    <span className="chip">{t("core")}</span>
                  ) : (
                    <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
                      <input type="checkbox" name="enabled" defaultChecked={state.enabled} className="peer sr-only" />
                      <span className="relative h-6 w-11 rounded-full bg-line transition after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-surface after:shadow after:transition peer-checked:bg-success peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-accent" />
                      <span className="sr-only">{t("enabled")}</span>
                    </label>
                  )}
                  {m.core && <input type="hidden" name="enabled" value="on" />}
                </div>
                {m.key === "ai" && (
                  <p className={`rounded-xl px-3 py-2 text-xs ${aiConfigured() ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
                    {aiConfigured() ? t("aiKeyOk") : t("aiKeyMissing")}
                  </p>
                )}
                <div className="grid gap-3 border-t border-line pt-4 sm:grid-cols-2">
                  {m.settings.map((f) => {
                    const id = `${m.key}-${f.key}`;
                    const label = t(`settings.${m.key}.${f.key}`);
                    const value = state.settings[f.key];
                    if (f.type === "boolean") {
                      return (
                        <label key={f.key} htmlFor={id} className="flex items-center gap-2 text-sm">
                          <input id={id} type="checkbox" name={f.key} defaultChecked={Boolean(value)} className="size-4 accent-[var(--accent)]" />
                          {label}
                        </label>
                      );
                    }
                    if (f.type === "select") {
                      return (
                        <div key={f.key}>
                          <label className="label" htmlFor={id}>
                            {label}
                          </label>
                          <select id={id} name={f.key} defaultValue={String(value ?? f.default)} className="select">
                            {f.options.map((o) => (
                              <option key={o} value={o}>
                                {o}
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    }
                    return (
                      <div key={f.key} className={f.type === "url" ? "sm:col-span-2" : ""}>
                        <label className="label" htmlFor={id}>
                          {label}
                        </label>
                        <input
                          id={id}
                          name={f.key}
                          type={f.type === "number" ? "number" : f.type === "url" ? "url" : "text"}
                          min={f.type === "number" ? f.min : undefined}
                          max={f.type === "number" ? f.max : undefined}
                          step={f.type === "number" && f.decimal ? "0.01" : undefined}
                          defaultValue={String(value ?? "")}
                          className="input"
                          placeholder={f.type === "url" ? "https://" : undefined}
                        />
                      </div>
                    );
                  })}
                </div>
              </ActionForm>
            </section>
          );
        })}
      </div>
    </div>
  );
}
