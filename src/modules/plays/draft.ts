import { z } from "zod";

// "Partie en cours": what the member typed in "Noter une partie", kept on the server
// until the play is saved or cancelled.

export const draftSeatSchema = z.object({
  key: z.string().max(80),
  userId: z.string().max(40).optional(),
  guestName: z.string().max(60).optional(),
  name: z.string().max(80),
  color: z.string().max(20),
  score: z.string().max(12),
  isWinner: z.boolean(),
  linked: z.boolean(),
});

export const draftDataSchema = z.object({
  gameId: z.string().max(40),
  playedAt: z.string().max(10),
  expansionIds: z.array(z.string().max(40)).max(40),
  seats: z.array(draftSeatSchema).max(30),
  location: z.string().max(200),
  notes: z.string().max(500),
  duration: z.string().max(6),
});

export type DraftData = z.infer<typeof draftDataSchema>;

/** The clock: running since `startedAt` (epoch ms), plus the time counted before the last pause. */
export type DraftClock = { startedAt: number | null; savedMs: number };

export type PlayDraftState = { data: DraftData; clock: DraftClock };

export const clockMs = (c: DraftClock, now: number) => c.savedMs + (c.startedAt != null ? Math.max(0, now - c.startedAt) : 0);
