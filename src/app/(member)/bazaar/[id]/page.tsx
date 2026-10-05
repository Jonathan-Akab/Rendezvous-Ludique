import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { MapPin, MessageCircle, Package, Pencil, Trash2, Truck } from "lucide-react";
import { hasRole, requireUser } from "@/lib/auth/guards";
import { can } from "@/lib/auth/permissions";
import { requireModule } from "@/lib/modules";
import { FadeIn } from "@/components/Motion";
import { MeepleAvatar } from "@/components/Meeple";
import { ActionForm } from "@/components/ActionForm";
import { ConfirmButton } from "@/components/forms";
import { GameCover } from "@/modules/games/components/GameCover";
import { MeepleRating } from "@/modules/games/components/MeepleRating";
import { coverUrl, getRatingStats } from "@/modules/games/service";
import { getListing, getThreads, LISTING_STATUSES, markThreadsRead } from "@/modules/bazaar/service";
import { deleteListingAction, sendBazaarMessageAction, setListingStatusAction } from "@/modules/bazaar/actions";
import { formatPrice, STATUS_STYLE } from "@/modules/bazaar/components/ListingCard";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const l = await getListing((await params).id);
  return { title: l?.title };
}

export default async function ListingPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, user, mod] = await Promise.all([params, requireUser(), requireModule("bazaar")]);
  const [listing, t, format, locale] = await Promise.all([getListing(id), getTranslations("bazaar"), getFormatter(), getLocale()]);
  if (!listing) notFound();

  const isSeller = listing.sellerId === user.id;
  const canManage = isSeller || can(user, "bazaar");
  const threads = await getThreads(listing.id, user.id, isSeller);
  await markThreadsRead(listing.id, user.id, isSeller);
  const rating = listing.game ? (await getRatingStats([listing.game.id])).get(listing.game.id) : null;
  const price = formatPrice(listing.price, String(mod.settings.currency) || "CAD", locale);
  const [main, ...others] = listing.photos;

  const thread = (th: (typeof threads)[number] | null, buyerId: string | null) => (
    <div className="space-y-3">
      {th?.messages.map((m) => (
        <div key={m.id} className={`flex gap-2 ${m.senderId === user.id ? "flex-row-reverse" : ""}`}>
          <MeepleAvatar color={m.sender.meepleColor} size={28} />
          <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${m.senderId === user.id ? "bg-accent text-accent-ink" : "bg-surface-2"}`}>
            <p className="whitespace-pre-line">{m.body}</p>
            <p className="mt-1 text-[10px] opacity-70">{format.dateTime(m.createdAt, { dateStyle: "short", timeStyle: "short" })}</p>
          </div>
        </div>
      ))}
      <ActionForm action={sendBazaarMessageAction.bind(null, listing.id, buyerId)} submitLabel={t("send")} submitClassName="btn btn-primary btn-sm" className="space-y-2">
        <textarea name="body" required maxLength={2000} className="textarea min-h-16" placeholder={isSeller ? t("replyPlaceholder") : t("messagePlaceholder")} />
      </ActionForm>
    </div>
  );

  return (
    <FadeIn className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <div className="space-y-3">
        <div className="relative overflow-hidden rounded-3xl border border-line/70 bg-surface-2">
          {main ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/files/${main.fileId}`} alt={listing.title} className="aspect-[4/3] w-full object-cover" />
          ) : (
            <div className="grid aspect-[4/3] place-items-center">
              <GameCover name={listing.game?.name ?? listing.title} src={listing.game ? coverUrl(listing.game) : null} size="xl" tilt />
            </div>
          )}
          {listing.status !== "ACTIVE" && (
            <span className={`chip absolute left-3 top-3 border-transparent px-3 py-1 text-sm ${STATUS_STYLE[listing.status]}`}>{t(`statuses.${listing.status}`)}</span>
          )}
        </div>
        {others.length > 0 && (
          <div className="grid grid-cols-4 gap-2">
            {others.map((p) => (
              <a key={p.id} href={`/files/${p.fileId}`} target="_blank" rel="noopener" className="overflow-hidden rounded-xl border border-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/files/${p.fileId}`} alt="" className="aspect-square w-full object-cover transition hover:scale-105" />
              </a>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="card card-pad space-y-3">
          <div className="flex flex-wrap gap-1.5">
            <span className="chip">{t(`kinds.${listing.kind}`)}</span>
            <span className="chip">{t(`conditions.${listing.condition}`)}</span>
          </div>
          <h1 className="page-title">{listing.title}</h1>
          {price && <p className="font-display text-4xl font-black text-accent">{price}</p>}
          <div className="space-y-1.5 text-sm text-muted">
            <p className="flex items-center gap-2">
              {listing.delivery === "PICKUP" ? <Package className="size-4" /> : <Truck className="size-4" />} {t(`delivery.${listing.delivery}`)}
            </p>
            {listing.city && (
              <p className="flex items-center gap-2">
                <MapPin className="size-4" /> {listing.city}
              </p>
            )}
            <p>{t("posted", { date: format.dateTime(listing.createdAt, { dateStyle: "medium" }) })}</p>
          </div>
          {listing.description && <p className="whitespace-pre-line border-t border-line pt-3 leading-relaxed">{listing.description}</p>}
          <Link href={`/members/${listing.seller.username}`} className="flex items-center gap-3 rounded-2xl bg-surface-2/60 p-3 hover:bg-surface-2">
            <MeepleAvatar color={listing.seller.meepleColor} size={40} />
            <span>
              <span className="block text-xs text-muted">{t("seller")}</span>
              <span className="font-semibold">{listing.seller.displayName}</span>
            </span>
          </Link>
          {listing.game && (
            <Link href={`/games/${listing.game.id}`} className="flex items-center gap-3 rounded-2xl bg-surface-2/60 p-3 hover:bg-surface-2">
              <GameCover name={listing.game.name} src={coverUrl(listing.game)} size="xs" />
              <span className="flex-1 text-sm font-semibold">{listing.game.name}</span>
              <MeepleRating avg={rating?.avg ?? null} count={rating?.count ?? 0} compact />
            </Link>
          )}
        </div>

        {canManage && (
          <div className="card card-pad space-y-3">
            <p className="text-sm font-semibold">{t("manage")}</p>
            <div className="flex flex-wrap gap-2">
              {LISTING_STATUSES.map((s) => (
                <form key={s} action={setListingStatusAction.bind(null, listing.id, s)}>
                  <button className={`btn btn-sm ${listing.status === s ? "btn-primary" : "btn-secondary"}`}>{t(`statuses.${s}`)}</button>
                </form>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={`/bazaar/${listing.id}/edit`} className="btn btn-ghost btn-sm">
                <Pencil className="size-4" /> {t("edit")}
              </Link>
              <form action={deleteListingAction.bind(null, listing.id)}>
                <ConfirmButton message={t("deleteConfirm")} className="btn btn-ghost btn-sm text-danger">
                  <Trash2 className="size-4" /> {t("delete")}
                </ConfirmButton>
              </form>
            </div>
          </div>
        )}

        <div className="card card-pad space-y-4">
          <h2 className="section-title flex items-center gap-2 text-base">
            <MessageCircle className="size-5 text-accent" /> {isSeller ? t("inquiries") : t("contactSeller")}
          </h2>
          {isSeller ? (
            threads.length === 0 ? (
              <p className="text-sm text-muted">{t("noInquiries")}</p>
            ) : (
              threads.map((th) => (
                <details key={th.buyer.id} className="rounded-2xl border border-line p-3" open={threads.length === 1 || th.unread > 0}>
                  <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
                    <MeepleAvatar color={th.buyer.meepleColor} size={24} /> {th.buyer.displayName}
                    {th.unread > 0 && <span className="chip-accent chip">{t("newMessages", { count: th.unread })}</span>}
                  </summary>
                  <div className="mt-3">{thread(th, th.buyer.id)}</div>
                </details>
              ))
            )
          ) : listing.status === "SOLD" ? (
            <p className="text-sm text-muted">{t("soldNote")}</p>
          ) : (
            thread(threads[0] ?? null, null)
          )}
        </div>
      </div>
    </FadeIn>
  );
}
