import "server-only";
import { db } from "@/lib/db";
import { distanceKm } from "@/lib/geo";
import { ilike } from "@/lib/search";
import { getFriendIds, PUBLIC_USER } from "@/modules/friends/service";
import type { Prisma } from "@/generated/prisma/client";

export type EventFilters = {
  q?: string;
  kind?: string;
  city?: string;
  when?: "upcoming" | "week" | "month" | "past";
  near?: { lat: number; lng: number; radiusKm: number };
  mine?: boolean;
  /** explicit date window (calendar view); overrides `when` */
  range?: { from: Date; to: Date };
};

const EVENT_INCLUDE = {
  host: { select: PUBLIC_USER },
  games: { include: { game: { select: { id: true, name: true } } } },
  attendees: { include: { user: { select: PUBLIC_USER } }, orderBy: { createdAt: "asc" } },
} satisfies Prisma.EventInclude;

export type EventWithDetails = Prisma.EventGetPayload<{ include: typeof EVENT_INCLUDE }>;

/** Visibility rule shared by list and detail views. */
async function visibilityWhere(viewerId: string): Promise<Prisma.EventWhereInput> {
  const friendIds = await getFriendIds(viewerId);
  return {
    OR: [
      { visibility: { in: ["PUBLIC", "MEMBERS"] } },
      { hostId: viewerId },
      { attendees: { some: { userId: viewerId } } },
      { visibility: "FRIENDS", hostId: { in: friendIds } },
    ],
  };
}

export async function listEvents(viewerId: string, f: EventFilters) {
  const now = new Date();
  const and: Prisma.EventWhereInput[] = [await visibilityWhere(viewerId)];

  if (f.mine) and.push({ OR: [{ hostId: viewerId }, { attendees: { some: { userId: viewerId, status: { not: "DECLINED" } } } }] });
  if (f.kind) and.push({ kind: f.kind });
  if (f.city) and.push({ city: ilike(f.city) });
  if (f.q) and.push({ OR: [{ title: ilike(f.q) }, { description: ilike(f.q) }] });

  const day = 24 * 60 * 60 * 1000;
  if (f.range) and.push({ startsAt: { gte: f.range.from, lt: f.range.to } });
  else switch (f.when ?? "upcoming") {
    case "past":
      and.push({ startsAt: { lt: now } });
      break;
    case "week":
      and.push({ startsAt: { gte: now, lte: new Date(now.getTime() + 7 * day) } });
      break;
    case "month":
      and.push({ startsAt: { gte: now, lte: new Date(now.getTime() + 31 * day) } });
      break;
    default:
      and.push({ startsAt: { gte: new Date(now.getTime() - 6 * 60 * 60 * 1000) } });
  }
  if (!f.mine) and.push({ status: "SCHEDULED" });

  const events = await db.event.findMany({
    where: { AND: and },
    include: EVENT_INCLUDE,
    orderBy: { startsAt: f.when === "past" ? "desc" : "asc" },
    take: 300,
  });

  const withDistance = events.map((e) => ({
    ...e,
    distanceKm:
      f.near && e.latitude != null && e.longitude != null
        ? distanceKm({ lat: f.near.lat, lng: f.near.lng }, { lat: e.latitude, lng: e.longitude })
        : null,
  }));
  if (!f.near) return withDistance;
  // Events without coordinates can't be placed on the map; keep them out of "near me".
  return withDistance.filter((e) => e.distanceKm != null && e.distanceKm <= f.near!.radiusKm);
}

export async function getEventForViewer(id: string, viewerId: string) {
  return db.event.findFirst({ where: { AND: [{ id }, await visibilityWhere(viewerId)] }, include: EVENT_INCLUDE });
}

export function seatsTaken(e: EventWithDetails) {
  // the host takes a seat too
  return 1 + e.attendees.filter((a) => a.status === "GOING" && a.userId !== e.hostId).length;
}

/** Game-night addresses (often someone's home) are only shown to the host and confirmed players. */
export function canSeeAddress(e: EventWithDetails, viewerId: string) {
  if (e.kind !== "GAME_NIGHT" && e.kind !== "HOME_GAME") return true;
  return e.hostId === viewerId || e.attendees.some((a) => a.userId === viewerId && a.status === "GOING");
}
