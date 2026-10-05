// Game types for the "Coup de dé" filters. The Ludothèque only stores free-text categories
// (written by members or the AI, in French or English), so each type is recognised from
// keywords in the categories / description, plus a few rules on players, length and weight.

export const GAME_TYPES = [
  "PARTY",
  "FAMILY",
  "STRATEGY",
  "COOP",
  "DUEL",
  "SOLO",
  "KIDS",
  "TEAMS",
  "DEDUCTION",
  "WORDS",
  "CARDS",
  "DECK",
  "TILES",
  "WORKERS",
  "DICE",
  "ENGINE",
  "ECONOMY",
  "AREA",
  "ADVENTURE",
  "ABSTRACT",
  "PUZZLE",
  "DEXTERITY",
] as const;
export type GameType = (typeof GAME_TYPES)[number];

const KEYWORDS: Partial<Record<GameType, string[]>> = {
  PARTY: ["party", "ambiance", "festif", "apéro", "apero", "rire", "humour", "humor"],
  FAMILY: ["famil"],
  STRATEGY: ["stratég", "strateg", "expert", "optimisation", "optimization"],
  COOP: ["coop", "collabor"],
  DUEL: ["duel", "2 joueurs", "two-player", "two player", "1 contre 1", "1v1", "head-to-head"],
  SOLO: ["solo"],
  KIDS: ["enfant", "children", "kids", "jeunesse"],
  TEAMS: ["équipe", "equipe", "team"],
  DEDUCTION: ["déduction", "deduction", "bluff", "rôle caché", "role caché", "hidden role", "traître", "traitor", "enquête", "mystère", "mystery", "loup-garou", "werewolf", "social deduction"],
  WORDS: ["mot", "word", "quiz", "trivia", "question", "dessin", "drawing", "devinette", "guess"],
  CARDS: ["carte", "card", "gestion de main", "hand management", "levée", "trick"],
  DECK: ["deck", "construction de deck", "deck-building", "deckbuilding", "draft"],
  TILES: ["tuile", "tile", "pose de"],
  WORKERS: ["placement d'ouvrier", "placement d’ouvrier", "worker placement", "ouvrier"],
  DICE: ["dé", "dés", "dice", "roll", "lancer de"],
  ENGINE: ["moteur", "engine", "construction de tableau", "tableau building", "combo"],
  ECONOMY: ["économ", "econom", "gestion", "management", "commerce", "trading", "marché", "market", "ressource", "resource", "réseau", "network", "négociation", "negotiation"],
  AREA: ["contrôle de territoire", "contrôle de zone", "area control", "area majority", "majorité", "guerre", "war", "conquête", "conquest", "combat", "militaire", "wargame"],
  ADVENTURE: ["aventure", "adventure", "campagne", "campaign", "exploration", "narratif", "narrative", "histoire", "story", "donjon", "dungeon", "rpg", "fantasy", "fantastique", "science-fiction", "horreur", "horror", "legacy"],
  ABSTRACT: ["abstrait", "abstract"],
  PUZZLE: ["puzzle", "casse-tête", "logique", "logic", "spatial", "polyomino", "escape"],
  DEXTERITY: ["adresse", "dexterity", "dextérité", "rapidité", "speed", "réflexe", "reflex", "temps réel", "real-time", "real time", "empilement", "stacking"],
};

// "dé"/"dés" also appear inside other words (idée, décision…): match them as whole words only.
const WHOLE_WORD = new Set(["dé", "dés", "mot", "word", "solo", "roll", "war", "rpg", "dice", "team"]);

const FROM_DESCRIPTION = new Set<GameType>(["PARTY", "COOP", "DEDUCTION", "DEXTERITY"]);

function has(text: string, keyword: string) {
  if (!WHOLE_WORD.has(keyword)) return text.includes(keyword);
  return new RegExp(`(^|[^\\p{L}])${keyword}s?([^\\p{L}]|$)`, "u").test(text);
}

export function classifyGame(g: {
  name: string;
  categories: string | null;
  description: string | null;
  minPlayers: number | null;
  maxPlayers: number | null;
  playTimeMin: number | null;
  minAge: number | null;
  weight: number | null;
}): GameType[] {
  // "gestion de main" is about cards, not about running an economy
  const categories = (g.categories ?? "").toLowerCase().replace(/gestion de main|hand management/g, "cartes en main");
  const description = (g.description ?? "").toLowerCase();
  const out = new Set<GameType>();
  for (const [type, words] of Object.entries(KEYWORDS) as [GameType, string[]][]) {
    if (words.some((w) => has(categories, w))) out.add(type);
    // descriptions are prose: only trust them for the unmistakable types
    else if (FROM_DESCRIPTION.has(type) && words.some((w) => has(description, w))) out.add(type);
  }
  // Rules from the numbers
  if (g.minPlayers === 1) out.add("SOLO");
  if (g.maxPlayers === 2) out.add("DUEL");
  if (g.minAge != null && g.minAge <= 6) out.add("KIDS");
  const light = g.weight != null && g.weight < 1.9;
  // big groups, quick and light: a party game even when the categories don't say so
  if ((g.maxPlayers ?? 0) >= 6 && light && (g.playTimeMin ?? 99) <= 45) out.add("PARTY");
  if (out.has("PARTY") && g.weight != null && g.weight >= 2.6) out.delete("PARTY");
  if (light && (g.minAge ?? 99) <= 10 && !out.has("PARTY")) out.add("FAMILY");
  if (g.weight != null && g.weight >= 3) out.add("STRATEGY");
  if (out.has("DECK")) out.add("CARDS");
  return GAME_TYPES.filter((t) => out.has(t));
}

/** Complexity bands (BGG-style weight, 1 to 5). */
export const LEVELS = ["LIGHT", "MEDIUM", "HEAVY"] as const;
export type Level = (typeof LEVELS)[number];
export function levelOf(weight: number | null): Level | null {
  if (weight == null) return null;
  return weight < 2 ? "LIGHT" : weight < 3 ? "MEDIUM" : "HEAVY";
}

/** Length bands. */
export const LENGTHS = ["QUICK", "SHORT", "MEDIUM", "LONG"] as const;
export type Length = (typeof LENGTHS)[number];
export function lengthOf(min: number | null): Length | null {
  if (min == null) return null;
  return min <= 30 ? "QUICK" : min <= 60 ? "SHORT" : min <= 120 ? "MEDIUM" : "LONG";
}
