import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Check, Search, UserMinus, UserPlus, X } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { requireModule } from "@/lib/modules";
import { db } from "@/lib/db";
import { ilike } from "@/lib/search";
import { MeepleAvatar } from "@/components/Meeple";
import { Stagger, StaggerItem } from "@/components/Motion";
import { EmptyState } from "@/components/EmptyState";
import { getFriendIds, PUBLIC_USER } from "@/modules/friends/service";
import { removeFriendship, respondFriendRequest, sendFriendRequest } from "@/modules/friends/actions";

export async function generateMetadata() {
  return { title: (await getTranslations("nav"))("friends") };
}

export default async function FriendsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const [user, mod, { q }, t] = await Promise.all([requireUser(), requireModule("friends"), searchParams, getTranslations("friends")]);

  const [friendships, incoming, outgoing, friendIds] = await Promise.all([
    db.friendship.findMany({
      where: { status: "ACCEPTED", OR: [{ requesterId: user.id }, { addresseeId: user.id }] },
      include: { requester: { select: PUBLIC_USER }, addressee: { select: PUBLIC_USER } },
    }),
    db.friendship.findMany({ where: { addresseeId: user.id, status: "PENDING" }, include: { requester: { select: PUBLIC_USER } } }),
    db.friendship.findMany({ where: { requesterId: user.id, status: "PENDING" }, include: { addressee: { select: PUBLIC_USER } } }),
    getFriendIds(user.id),
  ]);

  const query = q?.trim().replace(/^@/, "");
  const results = query
    ? await db.user.findMany({
        where: {
          id: { not: user.id },
          status: "ACTIVE",
          OR: [
            { username: query.toLowerCase() },
            { profileVisibility: { not: "PRIVATE" }, OR: [{ displayName: ilike(query) }, { username: ilike(query) }, { city: ilike(query) }] },
          ],
        },
        select: PUBLIC_USER,
        take: 20,
      })
    : [];
  const pendingIds = new Set([...incoming.map((f) => f.requesterId), ...outgoing.map((f) => f.addresseeId)]);

  const friends = friendships
    .map((f) => ({ id: f.id, user: f.requesterId === user.id ? f.addressee : f.requester }))
    .sort((a, b) => a.user.displayName.localeCompare(b.user.displayName));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">{t("title")}</h1>
        <p className="text-muted">{t("lead")}</p>
      </div>

      {mod.settings.allowRequests && (
        <section className="card card-pad space-y-4">
          <form className="flex gap-2" role="search">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
              <input name="q" defaultValue={q} className="input pl-9" placeholder={t("searchPlaceholder")} aria-label={t("searchPlaceholder")} />
            </div>
            <button className="btn btn-secondary">{t("search")}</button>
          </form>
          {query && results.length === 0 && <p className="text-sm text-muted">{t("noResults")}</p>}
          {results.length > 0 && (
            <ul className="divide-y divide-line">
              {results.map((r) => (
                <li key={r.id} className="flex items-center gap-3 py-2">
                  <MeepleAvatar color={r.meepleColor} size={36} />
                  <Link href={`/members/${r.username}`} className="flex-1 hover:text-accent">
                    <span className="font-semibold">{r.displayName}</span>{" "}
                    <span className="text-xs text-muted">
                      @{r.username}
                      {r.city && ` · ${r.city}`}
                    </span>
                  </Link>
                  {friendIds.includes(r.id) ? (
                    <span className="chip">{t("alreadyFriends")}</span>
                  ) : pendingIds.has(r.id) ? (
                    <span className="chip">{t("pending")}</span>
                  ) : (
                    <form action={sendFriendRequest.bind(null, r.id)}>
                      <button className="btn btn-primary btn-sm">
                        <UserPlus className="size-3.5" /> {t("add")}
                      </button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {incoming.length > 0 && (
        <section className="space-y-3">
          <h2 className="section-title">{t("incoming")}</h2>
          {incoming.map((f) => (
            <div key={f.id} className="card flex items-center gap-3 p-3">
              <MeepleAvatar color={f.requester.meepleColor} size={36} />
              <Link href={`/members/${f.requester.username}`} className="flex-1 font-semibold hover:text-accent">
                {f.requester.displayName}
              </Link>
              <form action={respondFriendRequest.bind(null, f.id, true)}>
                <button className="btn btn-primary btn-sm">
                  <Check className="size-3.5" /> {t("accept")}
                </button>
              </form>
              <form action={respondFriendRequest.bind(null, f.id, false)}>
                <button className="btn btn-ghost btn-sm">
                  <X className="size-3.5" /> {t("decline")}
                </button>
              </form>
            </div>
          ))}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="section-title">{t("yourFriends", { count: friends.length })}</h2>
        {friends.length === 0 ? (
          <EmptyState title={t("emptyTitle")} text={t("emptyText")} />
        ) : (
          <Stagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {friends.map((f) => (
              <StaggerItem key={f.id} className="card flex items-center gap-3 p-3">
                <MeepleAvatar color={f.user.meepleColor} size={44} />
                <Link href={`/members/${f.user.username}`} className="min-w-0 flex-1 hover:text-accent">
                  <p className="truncate font-semibold">{f.user.displayName}</p>
                  <p className="truncate text-xs text-muted">
                    @{f.user.username}
                    {f.user.city && ` · ${f.user.city}`}
                  </p>
                </Link>
                <form action={removeFriendship.bind(null, f.id)}>
                  <button className="p-1 text-muted hover:text-danger" title={t("remove")}>
                    <UserMinus className="size-4" />
                  </button>
                </form>
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </section>

      {outgoing.length > 0 && (
        <section className="space-y-2">
          <h2 className="section-title text-base">{t("outgoing")}</h2>
          <ul className="flex flex-wrap gap-2">
            {outgoing.map((f) => (
              <li key={f.id} className="chip gap-2 py-1">
                {f.addressee.displayName}
                <form action={removeFriendship.bind(null, f.id)}>
                  <button title={t("cancelRequest")} className="text-muted hover:text-danger">
                    <X className="size-3" />
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
