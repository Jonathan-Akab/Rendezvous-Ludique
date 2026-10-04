import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { MapPin, Navigation } from "lucide-react";
import { MeepleAvatar } from "@/components/Meeple";
import { GameCover } from "@/modules/games/components/GameCover";
import { listingImage, type ListingCard as Card } from "../service";

export function formatPrice(price: number | null, currency: string, locale: string) {
  if (price == null) return null;
  return new Intl.NumberFormat(locale === "fr" ? "fr-CA" : "en-CA", { style: "currency", currency, maximumFractionDigits: price % 1 ? 2 : 0 }).format(price);
}

export const STATUS_STYLE: Record<string, string> = {
  ACTIVE: "",
  RESERVED: "bg-[#f2b705] text-black",
  SOLD: "bg-danger text-white",
};

export async function ListingCard({ listing, currency, locale }: { listing: Card; currency: string; locale: string }) {
  const t = await getTranslations("bazaar");
  const img = listingImage(listing);
  const price = formatPrice(listing.price, currency, locale);
  return (
    <Link href={`/bazaar/${listing.id}`} className="card-hover group flex h-full flex-col overflow-hidden rounded-2xl">
      <div className="relative aspect-[4/3] overflow-hidden bg-surface-2">
        {listing.photos[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img!} alt={listing.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" />
        ) : (
          <div className="grid h-full place-items-center p-4">
            <GameCover name={listing.game?.name ?? listing.title} src={img} size="md" tilt />
          </div>
        )}
        <div className="absolute left-2 top-2 flex gap-1">
          {listing.status !== "ACTIVE" && <span className={`chip border-transparent ${STATUS_STYLE[listing.status]}`}>{t(`statuses.${listing.status}`)}</span>}
          {listing.kind !== "SALE" && <span className="chip border-transparent bg-accent-2 text-white">{t(`kinds.${listing.kind}`)}</span>}
        </div>
        {price && (
          <span className="absolute bottom-2 right-2 rounded-xl bg-black/70 px-2.5 py-1 font-display text-lg font-black text-white backdrop-blur">{price}</span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <p className="truncate font-display font-bold group-hover:text-accent">{listing.title}</p>
        <p className="text-xs text-muted">{t(`conditions.${listing.condition}`)}</p>
        <div className="mt-auto flex items-center justify-between text-xs text-muted">
          <span className="flex min-w-0 items-center gap-1.5">
            <MeepleAvatar color={listing.seller.meepleColor} size={20} />
            <span className="truncate">{listing.seller.displayName}</span>
          </span>
          {listing.distanceKm != null ? (
            <span className="flex shrink-0 items-center gap-1">
              <Navigation className="size-3" /> {Math.round(listing.distanceKm)} km
            </span>
          ) : (
            listing.city && (
              <span className="flex shrink-0 items-center gap-1">
                <MapPin className="size-3" /> {listing.city}
              </span>
            )
          )}
        </div>
      </div>
    </Link>
  );
}
