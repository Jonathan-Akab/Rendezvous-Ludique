import "server-only";
import { db } from "@/lib/db";
import { PUBLIC_USER } from "@/modules/friends/service";
import type { Prisma } from "@/generated/prisma/client";
import { draftDataSchema, type DraftData, type PlayDraftState } from "./draft";

export const PLAY_INCLUDE = {
  game: { select: { id: true, name: true } },
  createdBy: { select: PUBLIC_USER },
  participants: { include: { user: { select: PUBLIC_USER } }, orderBy: [{ isWinner: "desc" }, { score: "desc" }] },
  expansions: { include: { game: { select: { id: true, name: true } } } },
} satisfies Prisma.PlayInclude;

export type PlayWithDetails = Prisma.PlayGetPayload<{ include: typeof PLAY_INCLUDE }>;

/** The logger, and every member who confirmed being at the table, can fix a play. */
export function isPlayEditor(play: { createdById: string; participants: { userId: string | null; status: string }[] }, userId: string) {
  return play.createdById === userId || play.participants.some((p) => p.userId === userId && p.status === "CONFIRMED");
}

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

/** The member's play in progress ("Noter une partie" not saved yet), if any. */
export async function getPlayDraft(userId: string): Promise<(PlayDraftState & { gameName: string | null; updatedAt: Date }) | null> {
  const row = await db.playDraft.findUnique({ where: { userId } });
  if (!row) return null;
  let data: DraftData;
  try {
    data = draftDataSchema.parse(JSON.parse(row.data));
  } catch {
    return null;
  }
  const game = data.gameId ? await db.game.findUnique({ where: { id: data.gameId }, select: { name: true } }) : null;
  return { data, clock: { startedAt: row.startedAt?.getTime() ?? null, savedMs: row.savedMs }, gameName: game?.name ?? null, updatedAt: row.updatedAt };
}
