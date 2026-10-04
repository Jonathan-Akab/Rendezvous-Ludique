import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Megaphone } from "lucide-react";
import { requireUser, hasRole } from "@/lib/auth/guards";
import { getModuleStates, getOrderedModules } from "@/lib/modules";
import { getSiteSettings } from "@/lib/settings";
import { Meeple } from "@/components/Meeple";
import { AppSidebar, MobileNav, type NavItem } from "@/components/shell/MemberNav";
import { UserMenu } from "@/components/shell/UserMenu";
import { CommandPalette } from "@/components/shell/CommandPalette";
import { LocaleSwitch, ThemePicker } from "@/components/PreferenceControls";
import { DonateLink } from "@/modules/donations/components/DonateLink";

/** Menu items in the admin's default order, then the member's own order if they set one. */
function applyMemberOrder(items: NavItem[], navOrder: string | null) {
  let order: string[] = [];
  try {
    order = navOrder ? JSON.parse(navOrder) : [];
  } catch {
    order = [];
  }
  if (!order.length) return items;
  const rank = (href: string) => {
    const i = order.indexOf(href);
    return i === -1 ? order.length + items.findIndex((x) => x.href === href) : i;
  };
  return [...items].sort((a, b) => rank(a.href) - rank(b.href));
}

export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [modules, ordered, settings, t] = await Promise.all([getModuleStates(), getOrderedModules(), getSiteSettings(), getTranslations("nav")]);

  const items = applyMemberOrder(
    [
      { href: "/home", label: t("home"), icon: "House" },
      ...ordered
        .filter((m) => m.href && modules[m.key].enabled)
        .map((m) => ({ href: m.href!, label: t(m.key), icon: m.icon })),
    ],
    user.navOrder,
  );

  return (
    <div className="grain min-h-dvh">
      <div className="aurora" aria-hidden>
        <span />
        <span />
        <span />
      </div>

      <AppSidebar items={items} siteName={settings.siteName} meepleColor={user.meepleColor} />

      <div className="app-shell flex min-h-dvh flex-col pb-24 lg:pb-0">
        {/* Top bar: search, donations, language, theme, account */}
        <header className="glass sticky top-2 z-40 mx-2 mt-2 flex h-14 items-center gap-2 rounded-2xl px-3 lg:top-3 lg:mx-4 lg:mt-3">
          <Link href="/home" className="flex items-center gap-2 lg:hidden">
            <Meeple color={user.meepleColor} size={28} />
            <span className="hidden font-display text-base font-black sm:inline">{settings.siteName}</span>
          </Link>
          <div className="hidden w-full max-w-sm lg:block">
            <CommandPalette />
          </div>
          <div className="ml-auto flex items-center gap-1">
            <div className="lg:hidden">
              <CommandPalette compact />
            </div>
            <DonateLink placement="top" />
            <LocaleSwitch />
            <ThemePicker current={user.theme} enabled={settings.enabledThemes} images={settings.themeImages} />
            <UserMenu
              user={{ username: user.username, displayName: user.displayName, meepleColor: user.meepleColor }}
              canModerate={hasRole(user.role, "MODERATOR")}
              canAdmin={hasRole(user.role, "ADMIN")}
            />
          </div>
        </header>

        {settings.announcement && (
          <div className="mx-auto mt-4 w-full max-w-6xl px-4">
            <div className="glass flex items-center gap-2 rounded-2xl px-4 py-2 text-sm">
              <Megaphone className="size-4 shrink-0 text-accent" aria-hidden />
              {settings.announcement}
            </div>
          </div>
        )}

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 lg:px-8">{children}</main>

        <footer className="py-6 text-center text-xs text-muted">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-4 gap-y-2 px-4">
            <span>
              © {new Date().getFullYear()} {settings.siteName}
            </span>
            <DonateLink placement="footer" />
          </div>
        </footer>
      </div>

      <MobileNav items={items} />
    </div>
  );
}
