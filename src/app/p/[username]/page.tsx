import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getSiteSettings } from "@/lib/settings";
import { Meeple } from "@/components/Meeple";
import { canViewProfile, getProfileData } from "@/modules/profiles/service";
import { ProfileView } from "@/modules/profiles/components/ProfileView";

// Shareable profile link that works for people without an account,
// when the member chose "public" and admins allow public profiles.

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }) {
  return { title: `@${(await params).username}` };
}

export default async function PublicProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const [{ username }, viewer, settings, t] = await Promise.all([params, getCurrentUser(), getSiteSettings(), getTranslations("profile")]);
  const data = await getProfileData(username.toLowerCase());
  if (!data || !(await canViewProfile(data.user, viewer?.id ?? null))) notFound();

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <header className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-display text-lg font-bold">
          <Meeple color="var(--accent)" size={28} /> {settings.siteName}
        </Link>
        {!viewer && (
          <Link href="/register" className="btn btn-primary btn-sm">
            {t("joinCta")}
          </Link>
        )}
      </header>
      <ProfileView data={data} viewerId={viewer?.id ?? null} />
    </div>
  );
}
