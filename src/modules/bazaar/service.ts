import "server-only";
import { db } from "@/lib/db";
import { ilike } from "@/lib/search";
import { distanceKm } from "@/lib/geo";
import type { Prisma } from "@/generated/prisma/client";

export const LISTING_KINDS = ["SALE", "TRADE", "BOTH"] as const;
export const CONDITIONS = ["NEW", "LIKE_NEW", "GOOD", "FAIR", "POOR"] as const;
export const DELIVERY = ["PICKUP", "SHIPPING", "BOTH"] as const;
export const LISTING_STATUSES = ["ACTIVE", "RESERVED", "SOLD"] as const;

const SELLER = { id: true, username: true, displayName: true, meepleColor: true, city: true } as const;

export const LISTING_CARD = {
  seller: { select: SELLER },
  game: { select: { id: true, name: true, coverFileId: true, imageUrl: true, minPlayers: true, maxPlayers: true, playTimeMin: true } },
  photos: { orderBy: { sortOrder: "asc" }, take: 1 },
} satisfies Prisma.BazaarListingInclude;

export type ListingCard = Prisma.BazaarListingGetPayload<{ include: typeof LISTING_CARD }> & { distanceKm: number | null };

export async function listListings(opts: {
  q?: string;
  kind?: string;
  maxPrice?: number;
  city?: string;
  near?: { lat: number; lng: number; radiusKm: number };
  sellerId?: string;
  includeSold?: boolean;
}) {
  const and: Prisma.BazaarListingWhereInput[] = [];
  if (!opts.includeSold) and.push({ status: { not: "SOLD" } });
  if (opts.sellerId) and.push({ sellerId: opts.sellerId });
  if (opts.q) and.push({ OR: [{ title: ilike(opts.q) }, { description: ilike(opts.q) }, { game: { name: ilike(opts.q) } }] });
  if (opts.kind === "SALE") and.push({ kind: { in: ["SALE", "BOTH"] } });
  if (opts.kind === "TRADE") and.push({ kind: { in: ["TRADE", "BOTH"] } });
  if (opts.maxPrice != null) and.push({ price: { lte: opts.maxPrice } });
  if (opts.city) and.push({ city: ilike(opts.city) });

  const rows = await db.bazaarListing.findMany({ where: { AND: and }, include: LISTING_CARD, orderBy: { createdAt: "desc" }, take: 200 });
  const withDistance: ListingCard[] = rows.map((r) => ({
    ...r,
    distanceKm:
      opts.near && r.latitude != null && r.longitude != null ? distanceKm({ lat: opts.near.lat, lng: opts.near.lng }, { lat: r.latitude, lng: r.longitude }) : null,
  }));
  if (!opts.near) return withDistance;
  return withDistance.filter((r) => r.distanceKm != null && r.distanceKm <= opts.near!.radiusKm).sort((a, b) => a.distanceKm! - b.distanceKm!);
}

export async function getListing(id: string) {
  return db.bazaarListing.findUnique({
    where: { id },
    include: {
      seller: { select: SELLER },
      game: true,
      photos: { orderBy: { sortOrder: "asc" } },
    },
  });
}

/** Conversations on a listing: the seller sees one per interested member, a buyer sees theirs. */
export async function getThreads(listingId: string, viewerId: string, isSeller: boolean) {
  const messages = await db.bazaarMessage.findMany({
    where: { listingId, ...(isSeller ? {} : { buyerId: viewerId }) },
    include: { sender: { select: { displayName: true, meepleColor: true } }, buyer: { select: { id: true, displayName: true, username: true, meepleColor: true } } },
    orderBy: { createdAt: "asc" },
  });
  const threads = new Map<string, { buyer: (typeof messages)[number]["buyer"]; messages: typeof messages; unread: number }>();
  for (const m of messages) {
    const th = threads.get(m.buyerId) ?? { buyer: m.buyer, messages: [], unread: 0 };
    th.messages.push(m);
    if (m.senderId !== viewerId && !m.readAt) th.unread++;
    threads.set(m.buyerId, th);
  }
  return [...threads.values()];
}

/** Unread bazar messages for a member (as seller or as interested buyer). */
export async function unreadBazaarCount(userId: string) {
  return db.bazaarMessage.count({
    where: {
      readAt: null,
      senderId: { not: userId },
      OR: [{ buyerId: userId }, { listing: { sellerId: userId } }],
    },
  });
}

export async function markThreadsRead(listingId: string, viewerId: string, isSeller: boolean) {
  await db.bazaarMessage.updateMany({
    where: { listingId, readAt: null, senderId: { not: viewerId }, ...(isSeller ? {} : { buyerId: viewerId }) },
    data: { readAt: new Date() },
  });
}

export function listingImage(l: { photos: { fileId: string }[]; game: { coverFileId: string | null; imageUrl: string | null } | null }) {
  if (l.photos[0]) return `/files/${l.photos[0].fileId}`;
  if (l.game?.coverFileId) return `/files/${l.game.coverFileId}`;
  return l.game?.imageUrl ?? null;
}
