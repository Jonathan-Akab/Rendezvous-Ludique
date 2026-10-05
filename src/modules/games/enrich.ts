import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import { getModule } from "@/lib/modules";
import { textSimilarity } from "@/lib/similarity";
import { completeFree, extractJson, freeConfigured } from "@/modules/ai/free";
import { searchGameImages } from "./images";
import { coverUrl, normalizeName } from "./service";
import { attachExpansion, findBaseInLibrary } from "@/modules/kallax/service";

// Fills in what we don't know about games added to a Kallax, with the FREE AI only:
//  - details (year, players, time, age, designer, publisher; plus weight, categories and a
//    short description for the Ludothèque) — only empty fields, never what a member typed;
//  - a box picture: free image search (BGG / Wikimedia), then the free AI looks at the
//    candidates and keeps one only if it really shows that game's box.

export const ENRICH_FIELDS = ["year", "players", "playTime", "minAge", "designer", "publisher", "description", "image", "expansion"] as const;
export type EnrichField = (typeof ENRICH_FIELDS)[number];
export type EnrichResult = { id: string; name: string; filled: EnrichField[]; image: string | null; expansionOf: string | null };

export async function enrichAvailable() {
  const [ai, games] = await Promise.all([getModule("ai"), getModule("games")]);
  return ai.enabled && Boolean(ai.settings.freeEnabled) && freeConfigured(String(ai.settings.freeBaseUrl)) && Boolean(games.settings.autoEnrich);
}

const int = (min: number, max: number) => z.number().int().min(min).max(max).nullable().catch(null);
const text = (max: number) => z.string().trim().min(1).max(max).nullable().catch(null);
const factsSchema = z.object({
  games: z.array(
    z.object({
      input: z.string(),
      known: z.boolean().catch(false),
      name: text(150),
      year: int(1800, 2100),
      minPlayers: int(1, 100),
      maxPlayers: int(1, 100),
      playTimeMin: int(1, 6000),
      minAge: int(1, 99),
      designer: text(200),
      publisher: text(200),
      weight: z.number().min(1).max(5).nullable().catch(null),
      categories: text(300),
      description: text(1200),
      isExpansion: z.boolean().catch(false),
      baseGame: text(150),
    }),
  ),
});
export type Facts = z.infer<typeof factsSchema>["games"][number];

/** Asks the free AI what it knows about several games at once (one call). */
export async function lookUpFacts(names: string[], language: string): Promise<Map<string, Facts>> {
  const prompt = `You are a board game encyclopedia. For each board game below, give the facts you are SURE about for its best-known edition. Use null for anything you are not sure about — never guess. If you don't know the game, set "known": false.
Write "description" (2 short sentences: theme and what players do) and "categories" (comma-separated; start with the kind of game — party game, family, strategy, cooperative, two-player, children — then the mechanics, e.g. "strategy, worker placement, economic") in ${language === "en" ? "English" : "French"}. "weight" is the complexity from 1 (light) to 5 (heavy).
If the item is an EXPANSION (it needs another game to be played), set "isExpansion": true and "baseGame" to the title of the game it extends. A standalone game, a new edition or a deluxe/big box version of a game is NOT an expansion.

Games:
${names.map((n) => `- ${n}`).join("\n")}

Answer with JSON only: {"games":[{"input":"<name as given>","known":true,"name":"<official title>","year":2017,"minPlayers":2,"maxPlayers":4,"playTimeMin":45,"minAge":8,"designer":"…","publisher":"…","weight":1.8,"categories":"…","description":"…","isExpansion":false,"baseGame":null}]}`;
  const parsed = factsSchema.safeParse(extractJson(await completeFree(prompt)));
  const out = new Map<string, Facts>();
  if (!parsed.success) return out;
  for (const g of parsed.data.games) {
    if (!g.known) continue;
    // Which requested game is this? Models don't always copy the name back exactly.
    const best = names
      .map((n) => ({ n, score: Math.max(textSimilarity(n, g.input), g.name ? textSimilarity(n, g.name) : 0) }))
      .sort((a, b) => b.score - a.score)[0];
    // Only trust facts about the same game (not a look-alike the AI confused it with).
    if (!best || best.score < 0.6 || out.has(best.n.trim().toLowerCase())) continue;
    out.set(best.n.trim().toLowerCase(), g);
  }
  return out;
}

/** Downloads a candidate thumbnail as a data URL (the AI looks at it). */
async function asDataUrl(url: string) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "RendezvousLudique/1.0 (board game community site)" }, cache: "no-store" });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !/^image\/(jpeg|png|webp)/.test(type)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 3_000_000) return null;
    return `data:${type.split(";")[0]};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

/** Finds a box picture for the game and has the free AI confirm it before we use it. */
export async function findBoxPicture(name: string): Promise<string | null> {
  const { results } = await searchGameImages(name);
  const candidates = results.slice(0, 4);
  if (!candidates.length) return null;
  const images = (await Promise.all(candidates.map((c) => asDataUrl(c.thumb)))).map((data, i) => ({ data, url: candidates[i].url })).filter((x) => x.data);
  if (!images.length) return null;
  const answer = extractJson(
    await completeFree([
      {
        type: "text",
        text: `Here are ${images.length} pictures numbered from 0. Which one is the box (cover) of the board game "${name}"? Only choose a picture that clearly shows that game's box or cover art — not a different game, not a photo of people or a board in play. Answer with JSON only: {"index": <number or null>}.`,
      },
      ...images.map((img) => ({ type: "image_url", image_url: { url: img.data } })),
    ]),
  ) as { index?: unknown } | null;
  const index = typeof answer?.index === "number" ? answer.index : null;
  return index != null && images[index] ? images[index].url : null;
}

/**
 * Fills the empty details (and picture) of these Kallax games — and of their Ludothèque
 * entries. Returns what was added for each.
 */
export async function enrichKallaxGames(ids: string[], language: string): Promise<EnrichResult[]> {
  const kgs = await db.kallaxGame.findMany({ where: { id: { in: ids } }, include: { game: true } });
  const needsFacts = kgs.filter(
    (kg) =>
      // not attached yet: also asks whether it's an expansion
      !kg.parentId ||
      [kg.year, kg.minPlayers, kg.maxPlayers, kg.playTimeMin, kg.minAge, kg.designer, kg.publisher].some((v) => v == null) ||
      [kg.game.weight, kg.game.categories, kg.game.description].some((v) => v == null),
  );
  const facts = needsFacts.length ? await lookUpFacts(needsFacts.map((kg) => kg.name), language) : new Map<string, Facts>();

  const results: EnrichResult[] = [];
  for (const kg of kgs) {
    const f = facts.get(kg.name.trim().toLowerCase());
    const filled = new Set<EnrichField>();
    const fill = <T>(current: T | null, value: T | null | undefined, field: EnrichField) => {
      if (current != null || value == null) return undefined;
      filled.add(field);
      return value;
    };

    if (f) {
      const players = f.minPlayers && f.maxPlayers && f.minPlayers > f.maxPlayers ? { min: f.maxPlayers, max: f.minPlayers } : { min: f.minPlayers, max: f.maxPlayers };
      // The member's own record: only what's empty.
      await db.kallaxGame.update({
        where: { id: kg.id },
        data: {
          year: fill(kg.year, f.year, "year"),
          minPlayers: fill(kg.minPlayers, players.min, "players"),
          maxPlayers: fill(kg.maxPlayers, players.max, "players"),
          playTimeMin: fill(kg.playTimeMin, f.playTimeMin, "playTime"),
          minAge: fill(kg.minAge, f.minAge, "minAge"),
          designer: fill(kg.designer, f.designer, "designer"),
          publisher: fill(kg.publisher, f.publisher, "publisher"),
        },
      });
      // The Ludothèque entry: same rule, plus the shared-only details.
      const g = kg.game;
      await db.game.update({
        where: { id: g.id },
        data: {
          year: g.year ?? f.year ?? undefined,
          minPlayers: g.minPlayers ?? players.min ?? undefined,
          maxPlayers: g.maxPlayers ?? players.max ?? undefined,
          playTimeMin: g.playTimeMin ?? f.playTimeMin ?? undefined,
          minAge: g.minAge ?? f.minAge ?? undefined,
          designer: g.designer ?? f.designer ?? undefined,
          publisher: g.publisher ?? f.publisher ?? undefined,
          weight: g.weight ?? f.weight ?? undefined,
          categories: g.categories ?? f.categories ?? undefined,
          description: fill(g.description, f.description, "description"),
        },
      });
    }

    // Picture: only when neither the Kallax record nor the Ludothèque has one.
    let image: string | null = null;
    if (!kg.coverFileId && !kg.imageUrl && !kg.game.coverFileId && !kg.game.imageUrl) {
      image = await findBoxPicture(f?.name ?? kg.name).catch((e) => {
        console.error("[enrich] picture failed:", e);
        return null;
      });
      if (image) {
        await db.kallaxGame.update({ where: { id: kg.id }, data: { imageUrl: image } });
        await db.game.updateMany({ where: { id: kg.gameId, coverFileId: null, imageUrl: null }, data: { imageUrl: image } });
        filled.add("image");
      }
    }
    let expansionOf: string | null = null;
    if (f?.isExpansion && f.baseGame && !kg.parentId) {
      const base = await findBaseInLibrary(kg.libraryId, f.baseGame, kg.id);
      if (base && (await attachExpansion(kg.id, base.id))) {
        expansionOf = base.name;
        filled.add("expansion");
      }
    }
    results.push({ id: kg.id, name: kg.name, filled: [...filled], image, expansionOf });
  }
  return results;
}

// ───────────── Preview (before an import: nothing is saved) ─────────────

export type PreviewItem = { key: string; name: string; gameId?: string | null };
export type PreviewResult = {
  key: string;
  /** what the AI found, completed by the Ludothèque entry when the game is already known */
  details: {
    year: number | null;
    minPlayers: number | null;
    maxPlayers: number | null;
    playTimeMin: number | null;
    minAge: number | null;
    designer: string | null;
    publisher: string | null;
    weight: number | null;
    categories: string | null;
    description: string | null;
  };
  image: string | null;
  /** the picture comes from the Ludothèque (already chosen by members) */
  imageKnown: boolean;
  isExpansion: boolean;
  baseGame: string | null;
  found: boolean;
};

/** Details + verified picture for games about to be imported, for the member to review. */
export async function previewItems(items: PreviewItem[], language: string): Promise<PreviewResult[]> {
  const known = await db.game.findMany({ where: { id: { in: items.map((i) => i.gameId).filter((x): x is string => Boolean(x)) } } });
  const facts = await lookUpFacts(items.map((i) => i.name), language);
  const out: PreviewResult[] = [];
  for (const item of items) {
    const g = known.find((k) => k.id === item.gameId) ?? null;
    const f = facts.get(item.name.trim().toLowerCase());
    const pick = <T>(a: T | null | undefined, b: T | null | undefined) => (a ?? b ?? null) as T | null;
    const players = f?.minPlayers && f?.maxPlayers && f.minPlayers > f.maxPlayers ? { min: f.maxPlayers, max: f.minPlayers } : { min: f?.minPlayers, max: f?.maxPlayers };
    const existingImage = g ? coverUrl(g) : null;
    const image = existingImage ?? (await findBoxPicture(f?.name ?? item.name).catch(() => null));
    const baseFromLudo = g?.baseGameId ? (await db.game.findUnique({ where: { id: g.baseGameId }, select: { name: true } }))?.name ?? null : null;
    out.push({
      key: item.key,
      details: {
        year: pick(g?.year, f?.year),
        minPlayers: pick(g?.minPlayers, players.min),
        maxPlayers: pick(g?.maxPlayers, players.max),
        playTimeMin: pick(g?.playTimeMin, f?.playTimeMin),
        minAge: pick(g?.minAge, f?.minAge),
        designer: pick(g?.designer, f?.designer),
        publisher: pick(g?.publisher, f?.publisher),
        weight: pick(g?.weight, f?.weight),
        categories: pick(g?.categories, f?.categories),
        description: pick(g?.description, f?.description),
      },
      image,
      imageKnown: Boolean(existingImage),
      isExpansion: Boolean(baseFromLudo) || Boolean(f?.isExpansion),
      baseGame: baseFromLudo ?? f?.baseGame ?? null,
      found: Boolean(f) || Boolean(g),
    });
  }
  return out;
}

// ───────────── Ludothèque (staff) ─────────────

/** A Ludothèque entry is incomplete when a detail or the picture is missing. */
export const INCOMPLETE_GAME_WHERE = {
  OR: [
    { year: null },
    { minPlayers: null },
    { maxPlayers: null },
    { playTimeMin: null },
    { minAge: null },
    { designer: null },
    { publisher: null },
    { description: null },
    { AND: [{ imageUrl: null }, { coverFileId: null }] },
  ],
};

/**
 * Fills the empty details of Ludothèque entries with the free AI (never overwrites), finds
 * a verified box picture, and links an expansion to its base game when that game is known.
 */
export async function enrichGames(ids: string[], language: string): Promise<EnrichResult[]> {
  const games = await db.game.findMany({ where: { id: { in: ids } } });
  // Only ask the AI about games missing a detail (some only miss their picture).
  const needFacts = games.filter((g) =>
    [g.year, g.minPlayers, g.maxPlayers, g.playTimeMin, g.minAge, g.designer, g.publisher, g.description].some((v) => v == null),
  );
  const facts = needFacts.length ? await lookUpFacts(needFacts.map((g) => g.name), language) : new Map<string, Facts>();
  const results: EnrichResult[] = [];
  for (const g of games) {
    const f = facts.get(g.name.trim().toLowerCase());
    const filled = new Set<EnrichField>();
    const fill = <T>(current: T | null, value: T | null | undefined, field: EnrichField) => {
      if (current != null || value == null) return undefined;
      filled.add(field);
      return value;
    };
    if (f) {
      const players = f.minPlayers && f.maxPlayers && f.minPlayers > f.maxPlayers ? { min: f.maxPlayers, max: f.minPlayers } : { min: f.minPlayers, max: f.maxPlayers };
      await db.game.update({
        where: { id: g.id },
        data: {
          year: fill(g.year, f.year, "year"),
          minPlayers: fill(g.minPlayers, players.min, "players"),
          maxPlayers: fill(g.maxPlayers, players.max, "players"),
          playTimeMin: fill(g.playTimeMin, f.playTimeMin, "playTime"),
          minAge: fill(g.minAge, f.minAge, "minAge"),
          designer: fill(g.designer, f.designer, "designer"),
          publisher: fill(g.publisher, f.publisher, "publisher"),
          weight: g.weight ?? f.weight ?? undefined,
          categories: g.categories ?? f.categories ?? undefined,
          description: fill(g.description, f.description, "description"),
        },
      });
    }
    let expansionOf: string | null = null;
    if (f?.isExpansion && f.baseGame && !g.baseGameId) {
      const key = normalizeName(f.baseGame);
      const base =
        (await db.game.findUnique({ where: { normalizedName: key } })) ??
        (await db.game.findMany({ where: { baseGameId: null, id: { not: g.id } }, select: { id: true, name: true } }))
          .map((c) => ({ c, score: textSimilarity(c.name, f.baseGame!) }))
          .filter((x) => x.score >= 0.8)
          .sort((a, b) => b.score - a.score)[0]?.c ??
        null;
      if (base && base.id !== g.id) {
        await db.game.update({ where: { id: g.id }, data: { baseGameId: base.id } });
        expansionOf = base.name;
        filled.add("expansion");
      }
    }
    let image: string | null = null;
    if (!g.coverFileId && !g.imageUrl) {
      image = await findBoxPicture(f?.name ?? g.name).catch(() => null);
      if (image) {
        await db.game.update({ where: { id: g.id }, data: { imageUrl: image } });
        filled.add("image");
      }
    }
    results.push({ id: g.id, name: g.name, filled: [...filled], image, expansionOf });
  }
  return results;
}
