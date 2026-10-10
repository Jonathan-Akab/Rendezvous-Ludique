import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Check, Lock, Pencil, Share2, UserPlus } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { isModuleEnabled } from "@/lib/modules";
import { LibraryBig } from "lucide-react";
import { getVisibleLibraries } from "@/modules/kallax/service";
import { EmptyState } from "@/components/EmptyState";
import { canViewProfile, getProfileData } from "@/modules/profiles/service";
import { ProfileView } from "@/modules/profiles/components/ProfileView";
import { getRelation } from "@/modules/friends/service";
import { respondFriendRequest, sendFriendRequest } from "@/modules/friends/actions";

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }) {
  return { title: `@${(await params).username}` };
}

export default async function MemberProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const [{ username }, viewer, t] = await Promise.all([params, requireUser(), getTranslations("profile")]);
  const data = await getProfileData(username.toLowerCase());
  if (!data) notFound();

  const isMe = data.user.id === viewer.id;
  if (!(await canViewProfile(data.user, viewer.id))) {
    return <EmptyState title={t("privateTitle")} text={t("privateText")} />;
  }

  let actions: React.ReactNode = null;
  if (isMe) {
    actions = (
      <div className="flex flex-wrap gap-2">
        <Link href="/settings" className="btn btn-secondary">
          <Pencil className="size-4" /> {t("edit")}
        </Link>
        {data.user.profileVisibility === "PUBLIC" && (
          <Link href={`/p/${data.user.username}`} className="btn btn-ghost" target="_blank">
            <Share2 className="size-4" /> {t("publicLink")}
          </Link>
        )}
      </div>
    );
  } else if (await isModuleEnabled("friends")) {
    const rel = await getRelation(viewer.id, data.user.id);
    actions =
      rel.kind === "friends" ? (
        <span className="chip-accent chip py-1">
          <Check className="size-3.5" /> {t("friends")}
        </span>
      ) : rel.kind === "sent" ? (
        <span className="chip py-1">{t("requestSent")}</span>
      ) : rel.kind === "received" ? (
        <form action={respondFriendRequest.bind(null, rel.id, true)}>
          <button className="btn btn-primary">
            <Check className="size-4" /> {t("acceptRequest")}
          </button>
        </form>
      ) : (
        <form action={sendFriendRequest.bind(null, data.user.id)}>
          <button className="btn btn-primary">
            <UserPlus className="size-4" /> {t("addFriend")}
          </button>
        </form>
      );
  }

  // Their Kallax, when they let the viewer see it.
  const theirKallax = !isMe && (await isModuleEnabled("kallax")) ? await getVisibleLibraries(data.user.id, viewer.id) : [];

  return (
    <div className="space-y-4">
      {theirKallax.length > 0 && (
        <Link href={`/members/${data.user.username}/kallax`} className="btn btn-secondary">
          <LibraryBig className="size-4" /> {t("seeKallax")}
        </Link>
      )}
      {isMe && (
        <p className="flex items-center gap-2 text-xs text-muted">
          <Lock className="size-3.5" /> {t("visibilityNote", { visibility: t(`visibility.${data.user.profileVisibility}`) })}
        </p>
      )}
      <ProfileView data={data} viewerId={viewer.id} actions={actions} />
    </div>
  );
}
