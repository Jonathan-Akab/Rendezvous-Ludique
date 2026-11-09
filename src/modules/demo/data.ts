import type { EventWithDetails } from "@/modules/events/service";
import type { PlayWithDetails } from "@/modules/plays/service";
import type { ShelfGame } from "@/modules/kallax/components/KallaxShelf";
import type { PickerGame } from "@/modules/picker/service";
import type { MyGameOption } from "@/modules/kallax/components/MyGameSelect";

// Everything shown in the public demo: made-up members, games, events and plays.
// Nothing here comes from (or goes to) the database.

type Lang = "fr" | "en";
const pick = (lang: Lang, fr: string, en: string) => (lang === "fr" ? fr : en);

/** A date `days` from today at hh:mm (negative = in the past). */
function at(days: number, h: number, m = 0) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(h, m, 0, 0);
  return d;
}

export const DEMO_ME = { id: "demo-you", displayName: "Alex", meepleColor: "#2b8a3e" };

const PEOPLE = {
  marie: { id: "demo-marie", username: "marie", displayName: "Marie", meepleColor: "#c92a2a", city: "Laval" },
  sam: { id: "demo-sam", username: "sam", displayName: "Sam", meepleColor: "#1c5fbf", city: "Longueuil" },
  julie: { id: "demo-julie", username: "julie", displayName: "Julie", meepleColor: "#f2b705", city: "Joliette" },
  alex: { id: DEMO_ME.id, username: "alex", displayName: DEMO_ME.displayName, meepleColor: DEMO_ME.meepleColor, city: "Montréal" },
};

const GAMES = [
  { id: "g-catan", name: "Catan", min: 3, max: 4, time: 90, year: 1995, age: 10, weight: 2.3, cats: "stratégie, négociation, gestion" },
  { id: "g-azul", name: "Azul", min: 2, max: 4, time: 45, year: 2017, age: 8, weight: 1.8, cats: "familial, abstrait, pose de tuiles" },
  { id: "g-wingspan", name: "Wingspan", min: 1, max: 5, time: 70, year: 2019, age: 10, weight: 2.4, cats: "stratégie, moteur de jeu, cartes" },
  { id: "g-codenames", name: "Codenames", min: 4, max: 8, time: 15, year: 2015, age: 10, weight: 1.3, cats: "party game, équipe, mots, déduction" },
  { id: "g-dune", name: "Dune Imperium", min: 1, max: 4, time: 120, year: 2020, age: 14, weight: 3.0, cats: "stratégie, deck-building, placement d'ouvriers" },
  { id: "g-cascadia", name: "Cascadia", min: 1, max: 4, time: 45, year: 2021, age: 10, weight: 1.9, cats: "familial, pose de tuiles, puzzle" },
  { id: "g-mysterium", name: "Mysterium", min: 2, max: 7, time: 42, year: 2015, age: 10, weight: 1.9, cats: "coopératif, déduction" },
  { id: "g-brass", name: "Brass: Birmingham", min: 2, max: 4, time: 120, year: 2018, age: 14, weight: 3.9, cats: "stratégie, économie, réseau" },
  // in other members' Kallax only (the Ludothèque)
  { id: "g-ticket", name: "Les Aventuriers du Rail", min: 2, max: 5, time: 60, year: 2004, age: 8, weight: 1.8, cats: "familial, réseau, cartes", other: true },
  { id: "g-pandemic", name: "Pandemic", min: 2, max: 4, time: 45, year: 2008, age: 8, weight: 2.4, cats: "coopératif, gestion de main", other: true },
  { id: "g-7wonders", name: "7 Wonders", min: 2, max: 7, time: 30, year: 2010, age: 10, weight: 2.3, cats: "draft, civilisation, cartes", other: true },
  { id: "g-terraforming", name: "Terraforming Mars", min: 1, max: 5, time: 120, year: 2016, age: 12, weight: 3.3, cats: "stratégie, moteur de jeu, science-fiction", other: true },
  { id: "g-splendor", name: "Splendor", min: 2, max: 4, time: 30, year: 2014, age: 10, weight: 1.8, cats: "familial, moteur de jeu", other: true },
  { id: "g-dixit", name: "Dixit", min: 3, max: 8, time: 30, year: 2008, age: 8, weight: 1.2, cats: "party game, ambiance, devinette", other: true },
];
const MINE = GAMES.filter((g) => !("other" in g));

export function demoEvents(lang: Lang): EventWithDetails[] {
  const ev = (o: {
    id: string;
    title: string;
    kind: string;
    startsAt: Date;
    city: string;
    host: (typeof PEOPLE)[keyof typeof PEOPLE];
    games: string[];
    going: number;
    max: number | null;
  }) =>
    ({
      id: o.id,
      hostId: o.host.id,
      title: o.title,
      description: null,
      kind: o.kind,
      startsAt: o.startsAt,
      endsAt: null,
      locationName: null,
      address: null,
      city: o.city,
      latitude: null,
      longitude: null,
      visibility: "MEMBERS",
      maxPlayers: o.max,
      // home game nights: Marie accepts each player herself, Sam lets players in right away
      requiresApproval: o.id === "demo-e1" || o.kind === "TOURNAMENT",
      status: "SCHEDULED",
      createdAt: new Date(),
      updatedAt: new Date(),
      host: o.host,
      games: o.games.map((name) => ({ eventId: o.id, gameId: name, game: { id: name, name } })),
      attendees: Array.from({ length: o.going }, (_, i) => ({ id: `${o.id}-a${i}`, eventId: o.id, userId: `demo-guest-${i}`, status: "GOING", createdAt: new Date(), user: PEOPLE.sam })),
    }) as unknown as EventWithDetails;
  return [
    ev({ id: "demo-e1", title: pick(lang, "Soirée Catan chez Marie", "Catan night at Marie's"), kind: "GAME_NIGHT", startsAt: at(2, 19), city: "Laval", host: PEOPLE.marie, games: ["Catan", "Azul"], going: 3, max: 6 }),
    ev({ id: "demo-e2", title: pick(lang, "Café ludique du jeudi", "Thursday board game café"), kind: "BOARD_GAME_EVENT", startsAt: at(4, 18, 30), city: "Montréal", host: PEOPLE.sam, games: ["Codenames", "Cascadia"], going: 9, max: 20 }),
    ev({ id: "demo-e3", title: pick(lang, "Tournoi de Wingspan", "Wingspan tournament"), kind: "TOURNAMENT", startsAt: at(9, 13), city: "Joliette", host: PEOPLE.julie, games: ["Wingspan"], going: 11, max: 16 }),
    ev({ id: "demo-e4", title: pick(lang, "Jeux experts du dimanche", "Sunday heavy games"), kind: "GAME_NIGHT", startsAt: at(5, 13), city: "Longueuil", host: PEOPLE.sam, games: ["Brass: Birmingham", "Dune Imperium"], going: 2, max: 4 }),
  ];
}

export function demoShelf(): ShelfGame[] {
  const expansions: Record<string, string[]> = { "g-catan": ["Catan: Seafarers"], "g-wingspan": ["European Expansion", "Oceania Expansion"] };
  const ratings: Record<string, number> = { "g-catan": 7.4, "g-azul": 8.1, "g-wingspan": 8.6, "g-codenames": 7.9, "g-dune": 8.8, "g-cascadia": 8.2, "g-mysterium": 7.5, "g-brass": 9.0 };
  const plays: Record<string, number> = { "g-catan": 14, "g-azul": 9, "g-wingspan": 6, "g-codenames": 21, "g-dune": 3, "g-cascadia": 5, "g-mysterium": 0, "g-brass": 1 };
  return MINE.map((g) => ({
    id: `demo-k-${g.id}`,
    status: g.id === "g-brass" ? "WISHLIST" : "OWNED",
    notes: null,
    cover: null,
    game: { id: g.id, name: g.name, minPlayers: g.min, maxPlayers: g.max, playTimeMin: g.time, year: g.year },
    owner: null,
    rating: { avg: ratings[g.id] ?? null, count: 12 },
    myRating: null,
    expansions: expansions[g.id] ?? [],
    plays: plays[g.id],
  }));
}

export function demoPickerGames(): PickerGame[] {
  return MINE.filter((g) => g.id !== "g-brass").map((g, i) => ({
    gameId: g.id,
    name: g.name,
    cover: null,
    minPlayers: g.min,
    maxPlayers: g.max,
    playTimeMin: g.time,
    minAge: g.age,
    weight: g.weight,
    level: g.weight < 2 ? "LIGHT" : g.weight < 3 ? "MEDIUM" : "HEAVY",
    types: [],
    playCount: [14, 9, 6, 21, 3, 5, 0][i] ?? 0,
    hasExpansions: g.id === "g-catan" || g.id === "g-wingspan",
    mine: true,
    lastPlayed: i === 6 ? null : at(-(i * 23 + 4), 20).toISOString(),
    rating: [7.4, 8.1, 8.6, 7.9, 8.8, 8.2, 7.5][i] ?? null,
  }));
}

/** Game types from the categories, like the real picker (classified on the server). */
export function demoPickerGamesTyped(classify: (g: { name: string; categories: string | null; description: string | null; minPlayers: number | null; maxPlayers: number | null; playTimeMin: number | null; minAge: number | null; weight: number | null }) => PickerGame["types"]) {
  return demoPickerGames().map((p) => {
    const g = GAMES.find((x) => x.id === p.gameId)!;
    return { ...p, types: classify({ name: g.name, categories: g.cats, description: null, minPlayers: g.min, maxPlayers: g.max, playTimeMin: g.time, minAge: g.age, weight: g.weight }) };
  });
}

export function demoMyGames(): MyGameOption[] {
  return MINE.filter((g) => g.id !== "g-brass").map((g) => ({ gameId: g.id, name: g.name, cover: null }));
}

export function demoPlays(lang: Lang): PlayWithDetails[] {
  const seat = (id: string, who: (typeof PEOPLE)[keyof typeof PEOPLE] | null, guest: string | null, score: number, win = false) => ({
    id,
    playId: "",
    userId: who?.id ?? null,
    guestName: guest,
    score,
    isWinner: win,
    status: "CONFIRMED",
    user: who,
  });
  const play = (id: string, game: string, days: number, min: number, place: string, seats: ReturnType<typeof seat>[], exps: string[] = [], notes: string | null = null) =>
    ({
      id,
      gameId: game,
      createdById: PEOPLE.marie.id,
      eventId: null,
      playedAt: at(days, 20),
      durationMin: min,
      location: place,
      notes,
      createdAt: new Date(),
      game: { id: game, name: game },
      createdBy: PEOPLE.marie,
      participants: seats,
      expansions: exps.map((name) => ({ playId: id, gameId: name, game: { id: name, name } })),
    }) as unknown as PlayWithDetails;
  return [
    play("demo-p1", "Wingspan", -2, 74, pick(lang, "Chez Marie", "At Marie's"), [seat("s1", PEOPLE.alex, null, 87, true), seat("s2", PEOPLE.marie, null, 81), seat("s3", PEOPLE.sam, null, 64)], ["European Expansion"]),
    play("demo-p2", "Codenames", -6, 25, pick(lang, "Café ludique", "Board game café"), [seat("s4", PEOPLE.julie, null, 2, true), seat("s5", PEOPLE.alex, null, 1), seat("s6", null, "Thomas", 1)], [], pick(lang, "Revanche la semaine prochaine!", "Rematch next week!")),
    play("demo-p3", "Catan", -12, 95, pick(lang, "Chez Sam", "At Sam's"), [seat("s7", PEOPLE.sam, null, 10, true), seat("s8", PEOPLE.alex, null, 8), seat("s9", PEOPLE.marie, null, 7)]),
  ];
}

export function demoMessages(lang: Lang) {
  return [
    {
      id: "m1",
      pinned: true,
      author: "Marie",
      color: PEOPLE.marie.meepleColor,
      ago: 2,
      body: pick(
        lang,
        "Bienvenue aux nouveaux membres! N'hésitez pas à annoncer vos soirées de jeux à la maison : plus il y en a, plus tout le monde trouve une table près de chez soi. 🎲",
        "Welcome to our new members! Don't hesitate to announce your home game nights: the more there are, the easier it is for everyone to find a table nearby. 🎲",
      ),
    },
    {
      id: "m2",
      pinned: false,
      author: "Sam",
      color: PEOPLE.sam.meepleColor,
      ago: 26,
      body: pick(lang, "Nouveau dans le Coup de dé : des filtres par type de jeu (party, coop, stratégie…). Essayez-le ce soir!", "New in Roll the dice: filters by kind of game (party, co-op, strategy…). Try it tonight!"),
    },
  ];
}

export function demoGroup(lang: Lang) {
  return {
    id: "demo-group",
    name: pick(lang, "Joueurs de jeux de société de la région", "Board game players of the region"),
    url: "https://www.facebook.com/groups/",
    description: pick(lang, "Soirées, échanges de jeux et nouvelles de la communauté.", "Game nights, game swaps and community news."),
    region: pick(lang, "Québec", "Quebec"),
  };
}

/** One demo event, with a short description for its page. */
export function demoEvent(lang: Lang, id: string) {
  const e = demoEvents(lang).find((x) => x.id === id);
  if (!e) return null;
  const about: Record<string, string> = {
    "demo-e1": pick(lang, "Soirée détendue dans mon salon : on commence par un Catan, puis Azul pour finir. Apportez vos grignotines!", "A relaxed evening in my living room: Catan first, then Azul to wrap up. Bring snacks!"),
    "demo-e2": pick(lang, "Le café ludique du quartier ouvre ses tables à tout le monde. Débutants bienvenus, on vous explique les règles.", "The neighbourhood board game café opens its tables to everyone. Beginners welcome, we teach the rules."),
    "demo-e3": pick(lang, "Tournoi amical en trois rondes. Inscription obligatoire, places limitées.", "Friendly three-round tournament. Sign-up required, limited seats."),
    "demo-e4": pick(lang, "Pour les amateurs de jeux experts : on prend le temps, on joue sérieusement… et on rit quand même.", "For heavy-game fans: we take our time, play seriously… and still laugh."),
  };
  // made-up addresses, revealed once the visitor's seat is confirmed
  const addresses: Record<string, string> = { "demo-e1": "123, rue des Meeples, Laval", "demo-e4": "45, boulevard du Dé, Longueuil" };
  return { event: e, description: about[id] ?? "", address: addresses[id] ?? null };
}

/** One game of the demo shelf, by its Ludothèque id. */
export function demoGame(lang: Lang, id: string) {
  const g = GAMES.find((x) => x.id === id);
  if (!g) return null;
  const lib = demoLibrary().find((x) => x.id === id)!;
  // not in the visitor's Kallax: Ludothèque info only
  const shelf = demoShelf().find((x) => x.game.id === id) ?? { plays: undefined, expansions: [] as string[], rating: lib.rating };
  const mine = !("other" in g);
  const about: Record<string, string> = {
    "g-catan": pick(lang, "Colonisez une île en échangeant blé, bois, argile, laine et minerai. Négociez bien!", "Settle an island by trading grain, lumber, brick, wool and ore. Negotiate well!"),
    "g-azul": pick(lang, "Pigez des tuiles colorées pour décorer les murs du palais royal.", "Draft colourful tiles to decorate the walls of the royal palace."),
    "g-wingspan": pick(lang, "Attirez des oiseaux dans vos réserves naturelles et construisez un moteur de jeu.", "Attract birds to your wildlife preserves and build an engine."),
    "g-codenames": pick(lang, "Deux équipes, un mot-indice : trouvez vos agents secrets avant l'autre équipe.", "Two teams, one-word clues: find your secret agents before the other team."),
    "g-dune": pick(lang, "Construisez votre paquet de cartes et placez vos agents pour dominer Arrakis.", "Build your deck and place your agents to rule Arrakis."),
    "g-cascadia": pick(lang, "Créez un écosystème du Nord-Ouest avec des tuiles d'habitat et des animaux.", "Create a Pacific Northwest ecosystem with habitat tiles and wildlife."),
    "g-mysterium": pick(lang, "Un fantôme guide les médiums avec des cartes-visions pour résoudre son meurtre.", "A ghost guides mediums with vision cards to solve its murder."),
    "g-brass": pick(lang, "Développez vos industries et votre réseau pendant la révolution industrielle.", "Build industries and networks during the industrial revolution."),
    "g-ticket": pick(lang, "Collectionnez des cartes wagons pour relier les villes et réaliser vos destinations.", "Collect train cards to connect cities and complete your routes."),
    "g-pandemic": pick(lang, "Ensemble, freinez quatre épidémies et trouvez les remèdes avant qu'il ne soit trop tard.", "Together, slow four outbreaks and find the cures before it's too late."),
    "g-7wonders": pick(lang, "Développez votre civilisation et bâtissez une merveille en trois âges de draft.", "Grow your civilization and build a wonder over three drafting ages."),
    "g-terraforming": pick(lang, "Rendez Mars habitable avec votre corporation : température, oxygène et océans.", "Make Mars habitable with your corporation: temperature, oxygen and oceans."),
    "g-splendor": pick(lang, "Marchand de pierres précieuses, attirez les nobles grâce à vos mines et boutiques.", "As a gem merchant, attract nobles with your mines and shops."),
    "g-dixit": pick(lang, "Des illustrations oniriques et un indice : faites deviner, mais pas trop!", "Dreamlike pictures and one clue: make them guess, but not too easily!"),
  };
  return { info: g, shelf, mine, owners: lib.owners, description: about[id] ?? "" };
}

/** The demo Ludothèque: every game of the members' Kallax, with ratings and how many Kallax have it. */
export function demoLibrary() {
  const ratings: Record<string, number> = { "g-catan": 7.4, "g-azul": 8.1, "g-wingspan": 8.6, "g-codenames": 7.9, "g-dune": 8.8, "g-cascadia": 8.2, "g-mysterium": 7.5, "g-brass": 9.0, "g-ticket": 7.8, "g-pandemic": 8.0, "g-7wonders": 7.7, "g-terraforming": 8.7, "g-splendor": 7.6, "g-dixit": 7.9 };
  const owners: Record<string, number> = { "g-catan": 9, "g-azul": 7, "g-wingspan": 6, "g-codenames": 8, "g-dune": 4, "g-cascadia": 5, "g-mysterium": 3, "g-brass": 2, "g-ticket": 11, "g-pandemic": 6, "g-7wonders": 5, "g-terraforming": 4, "g-splendor": 7, "g-dixit": 5 };
  return GAMES.map((g) => ({
    id: g.id,
    name: g.name,
    minPlayers: g.min,
    maxPlayers: g.max,
    playTimeMin: g.time,
    year: g.year,
    rating: { avg: ratings[g.id] ?? null, count: 3 + (owners[g.id] ?? 0) * 2 },
    owners: owners[g.id] ?? 1,
  })).sort((a, b) => a.name.localeCompare(b.name));
}

/** Credits, member ratings and rulebooks of a demo game (its Ludothèque page). */
export function demoGameExtras(id: string) {
  const credits: Record<string, [string, string]> = {
    "g-catan": ["Klaus Teuber", "Kosmos"],
    "g-azul": ["Michael Kiesling", "Plan B Games"],
    "g-wingspan": ["Elizabeth Hargrave", "Stonemaier Games"],
    "g-codenames": ["Vlaada Chvátil", "Czech Games Edition"],
    "g-dune": ["Paul Dennen", "Dire Wolf"],
    "g-cascadia": ["Randy Flynn", "Flatout Games"],
    "g-mysterium": ["Oleksandr Nevskiy", "Libellud"],
    "g-brass": ["Gavan Brown, Matt Tolman, Martin Wallace", "Roxley"],
    "g-ticket": ["Alan R. Moon", "Days of Wonder"],
    "g-pandemic": ["Matt Leacock", "Z-Man Games"],
    "g-7wonders": ["Antoine Bauza", "Repos Production"],
    "g-terraforming": ["Jacob Fryxelius", "FryxGames"],
    "g-splendor": ["Marc André", "Space Cowboys"],
    "g-dixit": ["Jean-Louis Roubira", "Libellud"],
  };
  const lib = demoLibrary().find((x) => x.id === id);
  const avg = lib?.rating.avg ?? 7;
  const count = lib?.rating.count ?? 10;
  // votes from 1 to 10, gathered around the average
  const weights = Array.from({ length: 10 }, (_, i) => Math.max(0, 1 - Math.abs(i + 1 - avg) / 3));
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  const distribution = weights.map((w) => Math.round((w / total) * count));
  const plays: Record<string, number> = { "g-catan": 41, "g-azul": 27, "g-wingspan": 19, "g-codenames": 52, "g-dune": 11, "g-cascadia": 14, "g-mysterium": 6, "g-brass": 4, "g-ticket": 33, "g-pandemic": 17, "g-7wonders": 22, "g-terraforming": 9, "g-splendor": 25, "g-dixit": 18 };
  const rulebooks = [
    { id: `${id}-rb-fr`, title: "Règles du jeu", language: "fr", by: "Marie", days: 120 },
    ...(["g-catan", "g-wingspan", "g-dune", "g-pandemic"].includes(id) ? [{ id: `${id}-rb-en`, title: "Rulebook", language: "en", by: "Sam", days: 64 }] : []),
  ];
  const [designer, publisher] = credits[id] ?? ["—", "—"];
  return { designer, publisher, distribution, plays: plays[id] ?? 0, rulebooks };
}
