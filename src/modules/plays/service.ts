import "server-only";
import { db } from "@/lib/db";
import { PUBLIC_USER } from "@/modules/friends/service";
import type { Prisma } from "@/generated/prisma/client";

export const PLAY_INCLUDE = {
  game: { select: { id: true, name: true } },
  createdBy: { select: PUBLIC_USER },
  participants: { include: { user: { select: PUBLIC_USER } }, orderBy: [{ isWinner: "desc" }, { score: "desc" }] },
} satisfies Prisma.PlayInclude;

export type PlayWithDetails = Prisma.PlayGetPayload<{ include: typeof PLAY_INCLUDE }>;

/** Plays that count in a member's log: the ones they confirmed being part of. */
export function confirmedPlaysWhere(userId: string): Prisma.PlayWhereInput {
  return { participants: { some: { userId, status: "CONFIRMED" } } };
}

export async function getPlays(userId: string, take = 50) {
  return db.play.findMany({ where: confirmedPlaysWhere(userId), include: PLAY_INCLUDE, orderBy: { playedAt: "desc" }, take });
}

export async function getPendingPlays(userId: string) {
  return db.playParticipant.findMany({
    where: { userId, status: "PENDING" },
    include: { play: { include: PLAY_INCLUDE } },
    orderBy: { play: { playedAt: "desc" } },
  });
}

export async function getPlayStats(userId: string) {
  const plays = await db.play.findMany({
    where: confirmedPlaysWhere(userId),
    select: {
      game: { select: { name: true } },
      durationMin: true,
      participants: { select: { userId: true, isWinner: true, status: true, user: { select: { displayName: true, username: true, meepleColor: true } } } },
    },
  });
  const byGame = new Map<string, number>();
  const partners = new Map<string, { name: string; username: string; color: string; count: number }>();
  let wins = 0;
  let minutes = 0;
  for (const p of plays) {
    byGame.set(p.game.name, (byGame.get(p.game.name) ?? 0) + 1);
    minutes += p.durationMin ?? 0;
    for (const part of p.participants) {
      if (part.userId === userId && part.isWinner) wins++;
      if (part.userId && part.userId !== userId && part.user && part.status !== "DECLINED") {
        const cur = partners.get(part.userId) ?? { name: part.user.displayName, username: part.user.username, color: part.user.meepleColor, count: 0 };
        cur.count++;
        partners.set(part.userId, cur);
      }
    }
  }
  return {
    total: plays.length,
    wins,
    hours: Math.round(minutes / 6) / 10,
    distinctGames: byGame.size,
    topGames: [...byGame.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
    topPartners: [...partners.values()].sort((a, b) => b.count - a.count).slice(0, 5),
  };
}
