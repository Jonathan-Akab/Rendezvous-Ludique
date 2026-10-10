import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import { getModule } from "@/lib/modules";
import { extractJson, freeConfigured } from "@/modules/ai/free";
import { claudeWebSearch } from "./webImages";
import { lookUpFacts } from "./enrich";
import { findGameByName } from "./service";

// Details for the Kallax form: copied from the Ludothèque, or found by the AI (Claude searching the web).
// They only fill the form — the member checks them and saves.

export type DetailFields = {
  year: number | null;
  minPlayers: number | null;
  maxPlayers: number | null;
  playTimeMin: number | null;
  minAge: number | null;
  designer: string | null;
  publisher: string | null;
};
export const EMPTY_DETAILS: DetailFields = { year: null, minPlayers: null, maxPlayers: null, playTimeMin: null, minAge: null, designer: null, publisher: null };

/** The Ludothèque's details for a game (by id, or by exact name when it isn't picked yet). */
export async function ludoDetails(gameId: string | null, name: string): Promise<(DetailFields & { name: string }) | null> {
  const game = gameId ? await db.game.findUnique({ where: { id: gameId } }) : name.trim() ? await findGameByName(name) : null;
  if (!game) return null;
  return {
    name: game.name,
    year: game.year,
    minPlayers: game.minPlayers,
    maxPlayers: game.maxPlayers,
    playTimeMin: game.playTimeMin,
    minAge: game.minAge,
    designer: game.designer,
    publisher: game.publisher,
  };
}

const int = (min: number, max: number) => z.number().int().min(min).max(max).nullable().catch(null);
const text = (max: number) => z.string().trim().min(1).max(max).nullable().catch(null);
const schema = z.object({
  year: int(1800, 2100),
  minPlayers: int(1, 100),
  maxPlayers: int(1, 100),
  playTimeMin: int(1, 6000),
  minAge: int(1, 99),
  designer: text(150),
  publisher: text(150),
  source: z.string().max(300).nullable().catch(null),
});

export type AiDetails = { fields: DetailFields; source: string | null; via: "web" | "free" };

/**
 * Finds the details of a board game: Claude searches the web (BoardGameGeek first); when no Claude is
 * available the free AI answers from what it knows. Returns null when no AI can be used.
 */
export async function aiGameDetails(name: string, userId: string, language: string): Promise<AiDetails | null> {
  const prompt = `Find the facts about the board game "${name}" on the web (BoardGameGeek first, then the publisher's site). Use its best-known current edition. Give only facts you actually found; use null for anything you could not confirm — never guess.
Answer with JSON only: {"year":2017,"minPlayers":2,"maxPlayers":4,"playTimeMin":45,"minAge":8,"designer":"…","publisher":"…","source":"https://… (the page you relied on)"}.
"year" is the first publication year, "playTimeMin" the usual play time in minutes (the upper figure if a range), "designer" the designers separated by commas. Only the game "${name}", not a similar title or an expansion.`;
  const found = await claudeWebSearch(userId, prompt, "details");
  if (found) {
    const parsed = schema.safeParse(extractJson(found.answer));
    if (parsed.success) {
      const { source, ...fields } = parsed.data;
      const host = (u: string | null) => {
        try {
          return u ? new URL(u).hostname.replace(/^www\./, "") : null;
        } catch {
          return null;
        }
      };
      return { fields, source: host(source) ?? host(found.results[0]?.url ?? null), via: "web" };
    }
  }
  // No Claude (or no answer): the free AI, from its own knowledge.
  const ai = await getModule("ai");
  if (!found && ai.enabled && Boolean(ai.settings.freeEnabled) && freeConfigured(String(ai.settings.freeBaseUrl))) {
    const facts = (await lookUpFacts([name], language)).get(name.trim().toLowerCase());
    if (!facts) return { fields: EMPTY_DETAILS, source: null, via: "free" };
    return {
      fields: {
        year: facts.year,
        minPlayers: facts.minPlayers,
        maxPlayers: facts.maxPlayers,
        playTimeMin: facts.playTimeMin,
        minAge: facts.minAge,
        designer: facts.designer,
        publisher: facts.publisher,
      },
      source: null,
      via: "free",
    };
  }
  return found ? { fields: EMPTY_DETAILS, source: null, via: "web" } : null;
}
