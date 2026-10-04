import { getFormatter, getTranslations } from "next-intl/server";
import { MapPin } from "lucide-react";
import { Meeple } from "@/components/Meeple";
import { FadeIn, Stagger, StaggerItem } from "@/components/Motion";
import { KallaxShelf } from "@/modules/kallax/components/KallaxShelf";
import { PlayCard } from "@/modules/plays/components/PlayCard";
import type { ProfileData } from "../service";

export async function ProfileView({ data, viewerId, actions }: { data: ProfileData; viewerId: string | null; actions?: React.ReactNode }) {
  const [t, format] = await Promise.all([getTranslations("profile"), getFormatter()]);
  const { user, games, plays, stats } = data;
  const favorites = (user.favoriteGames ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <div className="space-y-8">
      <FadeIn className="card relative overflow-hidden">
        <div className="h-24" style={{ background: `linear-gradient(120deg, ${user.meepleColor}, color-mix(in oklab, ${user.meepleColor} 40%, var(--surface-2)))` }} />
        <div className="card-pad -mt-16 flex flex-wrap items-end gap-5">
          <div className="grid size-28 place-items-center rounded-3xl border-4 border-surface bg-surface-2 shadow-card">
            <Meeple color={user.meepleColor} size={84} title={user.displayName} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="page-title truncate">{user.displayName}</h1>
            <p className="text-sm text-muted">
              @{user.username}
              {(user.city || user.region) && (
                <>
                  {" · "}
                  <MapPin className="inline size-3.5" aria-hidden /> {[user.city, user.region].filter(Boolean).join(", ")}
                </>
              )}
              {" · "}
              {t("memberSince", { date: format.dateTime(user.createdAt, { month: "long", year: "numeric" }) })}
            </p>
          </div>
          {actions}
        </div>
        {(user.bio || favorites.length > 0) && (
          <div className="space-y-3 px-5 pb-6 sm:px-6">
            {user.bio && <p className="whitespace-pre-line">{user.bio}</p>}
            {favorites.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">{t("favorites")}</span>
                {favorites.map((f) => (
                  <span key={f} className="chip">
                    ♥ {f}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </FadeIn>

      <Stagger className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          [t("stats.plays"), stats.plays],
          [t("stats.games"), user.showLibrary ? stats.games : "—"],
          [t("stats.hosted"), stats.hosted],
          [t("stats.friends"), stats.friends],
        ].map(([label, value]) => (
          <StaggerItem key={String(label)} className="card p-4 text-center">
            <p className="font-display text-3xl font-black text-accent">{value}</p>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
          </StaggerItem>
        ))}
      </Stagger>

      {user.showLibrary && games.length > 0 && (
        <section className="space-y-3">
          <h2 className="section-title">{t("kallax")}</h2>
          <KallaxShelf games={games} editable={false} shared={false} />
        </section>
      )}

      {user.showPlays && plays.length > 0 && (
        <section className="space-y-3">
          <h2 className="section-title">{t("recentPlays")}</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {plays.map((p) => (
              <PlayCard key={p.id} play={p} viewerId={viewerId ?? ""} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
