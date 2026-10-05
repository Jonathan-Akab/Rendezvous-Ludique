import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { requireStaff } from "@/lib/auth/guards";
import { permissionsOf, type Permission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { getSiteSettings } from "@/lib/settings";
import { MeepleAvatar } from "@/components/Meeple";
import { LocaleSwitch } from "@/components/PreferenceControls";
import { AdminNav, type AdminNavItem } from "@/modules/admin/components/AdminNav";

export async function generateMetadata() {
  return { title: { template: "%s · Admin", default: "Admin" } };
}

// The admin console is its own area with its own shell. Admins keep the normal member
// experience on the main site and come here only through "Admin console" in their menu.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();
  const allowed = permissionsOf(user);
  const [settings, t] = await Promise.all([getSiteSettings(), getTranslations("admin.nav")]);
  const pendingSignups = allowed.has("registrations") ? await db.user.count({ where: { status: "PENDING" } }) : 0;
  // The sign-ups section only matters when approval is on (or someone still waits).
  const showSignups = settings.registrationApproval || pendingSignups > 0;

  const all: (AdminNavItem & { permission?: Permission; hidden?: boolean })[] = [
    { href: "/admin", label: t("dashboard"), icon: "Gauge", group: "overview" },
    {
      href: "/admin/registrations",
      label: pendingSignups ? `${t("registrations")} (${pendingSignups})` : t("registrations"),
      icon: "UserCheck",
      group: "community",
      permission: "registrations",
      hidden: !showSignups,
    },
    { href: "/admin/members", label: t("members"), icon: "Users", group: "community" },
    { href: "/admin/suggestions", label: t("suggestions"), icon: "Lightbulb", group: "community" },
    { href: "/admin/events", label: t("events"), icon: "CalendarDays", group: "content" },
    { href: "/admin/games", label: t("games"), icon: "Swords", group: "content" },
    { href: "/admin/libraries", label: t("libraries"), icon: "LibraryBig", group: "content" },
    { href: "/admin/plays", label: t("plays"), icon: "Dices", group: "content" },
    { href: "/admin/faq", label: t("faq"), icon: "MessageCircleQuestion", group: "content" },
    { href: "/admin/bazaar", label: t("bazaar"), icon: "Store", group: "content" },
    { href: "/admin/facebook", label: t("facebook"), icon: "Users2", group: "content" },
    { href: "/admin/ai", label: t("ai"), icon: "Sparkles", group: "platform" },
    { href: "/admin/modules", label: t("modules"), icon: "Puzzle", group: "platform" },
    { href: "/admin/appearance", label: t("appearance"), icon: "Palette", group: "platform" },
    { href: "/admin/settings", label: t("settings"), icon: "Settings2", group: "platform" },
    { href: "/admin/audit", label: t("audit"), icon: "ScrollText", group: "platform" },
  ];
  // Each section needs its permission (the route's first segment is the permission name).
  const PERM: Record<string, Permission> = {
    members: "members", suggestions: "suggestions", events: "events", games: "games", faq: "faq", libraries: "libraries",
    plays: "plays", bazaar: "bazaar", facebook: "facebook", ai: "ai", modules: "modules", appearance: "appearance", settings: "settings", audit: "audit",
  };
  const items: AdminNavItem[] = all
    .filter((i) => {
      if (i.hidden) return false;
      const p = i.permission ?? PERM[i.href.split("/")[2] ?? ""];
      return !p || allowed.has(p);
    })
    .map(({ permission: _p, hidden: _h, ...i }) => i);
  const groups = { overview: t("groups.overview"), community: t("groups.community"), content: t("groups.content"), platform: t("groups.platform") };

  return (
    <div
      className="min-h-dvh lg:grid lg:grid-cols-[260px_1fr]"
      style={
        {
          "--console-bg": "color-mix(in oklab, #14161b 88%, var(--accent) 12%)",
          "--console-ink": "#eef0f3",
          "--console-muted": "#9aa1ab",
        } as React.CSSProperties
      }
    >
      <aside className="flex flex-col gap-6 bg-[var(--console-bg)] p-4 text-[var(--console-ink)] lg:sticky lg:top-0 lg:h-dvh lg:overflow-y-auto">
        <div className="flex items-center gap-3 px-2 pt-2">
          <span className="grid size-10 place-items-center rounded-xl bg-accent text-accent-ink">
            <ShieldCheck className="size-5" />
          </span>
          <div className="leading-tight">
            <p className="font-display text-lg font-bold">{t("title")}</p>
            <p className="text-xs text-[var(--console-muted)]">{settings.siteName}</p>
          </div>
        </div>
        <AdminNav items={items} groups={groups} />
        <div className="mt-auto space-y-3 border-t border-white/10 pt-4">
          <div className="flex items-center gap-2 px-2 text-sm">
            <MeepleAvatar color={user.meepleColor} size={30} />
            <span className="flex-1 truncate">{user.displayName}</span>
            <LocaleSwitch />
          </div>
          <Link href="/home" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold hover:bg-white/10">
            <ArrowLeft className="size-4" /> {t("backToSite")}
          </Link>
        </div>
      </aside>
      <main className="min-w-0 p-4 sm:p-8">{children}</main>
    </div>
  );
}
