import "server-only";
import { getTranslations } from "next-intl/server";
import { getModuleStates, getOrderedModules } from "@/lib/modules";
import type { NavItem } from "@/components/shell/MemberNav";

/** Member menu: home + enabled modules, in the admin's default order, then the member's own. */
export async function getMenuItems(navOrder: string | null): Promise<NavItem[]> {
  const [modules, ordered, t] = await Promise.all([getModuleStates(), getOrderedModules(), getTranslations("nav")]);
  const items: NavItem[] = [
    { href: "/home", label: t("home"), icon: "House" },
    ...ordered.filter((m) => m.href && modules[m.key].enabled)// The suggestion box opens a popup rather than a page.
      .map((m) => ({ href: m.href!, label: t(m.key), icon: m.icon, ...(m.key === "suggestions" ? { dialog: "suggestions" as const } : {}) })),
  ];

  let order: string[] = [];
  try {
    order = navOrder ? JSON.parse(navOrder) : [];
  } catch {
    order = [];
  }
  // "Soutenir le projet" closes the menu (a popup, like the suggestion box)
  const support: NavItem[] = modules.donations.enabled ? [{ href: "/support", label: t("support"), icon: "Heart", dialog: "donate" }] : [];
  if (!order.length) return [...items, ...support];
  const rank = (href: string) => {
    const i = order.indexOf(href);
    return i === -1 ? order.length + items.findIndex((x) => x.href === href) : i;
  };
  return [...[...items].sort((a, b) => rank(a.href) - rank(b.href)), ...support];
}
