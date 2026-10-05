// Seeds the first admin account and (optionally) fictional demo data.
// Run with `npm run db:seed`. Safe to re-run: existing rows are left alone.

import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";

function createClient() {
  const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
  if (url.startsWith("postgres")) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaPg } = require("@prisma/adapter-pg");
    return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
  return new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: url.replace(/^file:/, "") }) });
}

const db = createClient();
const day = 24 * 60 * 60 * 1000;

const normalizeName = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

async function ensureUser(data: {
  email: string;
  username: string;
  displayName: string;
  password: string;
  role?: string;
  meepleColor: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  bio?: string;
  favoriteGames?: string;
  locale?: string;
}) {
  const existing = await db.user.findUnique({ where: { username: data.username } });
  if (existing) return existing;
  const { password, ...rest } = data;
  const user = await db.user.create({ data: { ...rest, passwordHash: await bcrypt.hash(password, 12), region: data.city ? "Québec" : undefined } });
  await db.library.create({
    data: { name: `Kallax — ${user.displayName}`, members: { create: { userId: user.id, role: "OWNER", status: "ACCEPTED" } } },
  });
  return user;
}

type GameData = { name: string; year: number; minPlayers: number; maxPlayers: number; playTimeMin: number; minAge: number; designer: string; publisher: string };

// Demo games (factual public info: name, year, player count, length, designer, publisher).
const GAMES: Record<string, GameData> = {
  Catan: { name: "Catan", year: 1995, minPlayers: 3, maxPlayers: 4, playTimeMin: 90, minAge: 10, designer: "Klaus Teuber", publisher: "Kosmos" },
  Anachrony: { name: "Anachrony", year: 2017, minPlayers: 1, maxPlayers: 4, playTimeMin: 120, minAge: 14, designer: "Richard Amann, Viktor Péter, Dávid Turczi", publisher: "Mindclash Games" },
  "Merchants Cove": { name: "Merchants Cove", year: 2021, minPlayers: 1, maxPlayers: 4, playTimeMin: 90, minAge: 12, designer: "Carl Van Ostrand, Drew Wynne", publisher: "Final Frontier Games" },
  Wingspan: { name: "Wingspan", year: 2019, minPlayers: 1, maxPlayers: 5, playTimeMin: 70, minAge: 10, designer: "Elizabeth Hargrave", publisher: "Stonemaier Games" },
  Azul: { name: "Azul", year: 2017, minPlayers: 2, maxPlayers: 4, playTimeMin: 45, minAge: 8, designer: "Michael Kiesling", publisher: "Plan B Games" },
  "Terraforming Mars": { name: "Terraforming Mars", year: 2016, minPlayers: 1, maxPlayers: 5, playTimeMin: 120, minAge: 12, designer: "Jacob Fryxelius", publisher: "FryxGames" },
  Carcassonne: { name: "Carcassonne", year: 2000, minPlayers: 2, maxPlayers: 5, playTimeMin: 40, minAge: 7, designer: "Klaus-Jürgen Wrede", publisher: "Hans im Glück" },
  "Brass: Birmingham": { name: "Brass: Birmingham", year: 2018, minPlayers: 2, maxPlayers: 4, playTimeMin: 120, minAge: 14, designer: "Gavan Brown, Matt Tolman, Martin Wallace", publisher: "Roxley" },
  "Spirit Island": { name: "Spirit Island", year: 2017, minPlayers: 1, maxPlayers: 4, playTimeMin: 120, minAge: 13, designer: "R. Eric Reuss", publisher: "Greater Than Games" },
  Cascadia: { name: "Cascadia", year: 2021, minPlayers: 1, maxPlayers: 4, playTimeMin: 45, minAge: 10, designer: "Randy Flynn", publisher: "Flatout Games" },
  Codenames: { name: "Codenames", year: 2015, minPlayers: 2, maxPlayers: 8, playTimeMin: 15, minAge: 14, designer: "Vlaada Chvátil", publisher: "Czech Games Edition" },
  Root: { name: "Root", year: 2018, minPlayers: 2, maxPlayers: 4, playTimeMin: 90, minAge: 10, designer: "Cole Wehrle", publisher: "Leder Games" },
  "Ark Nova": { name: "Ark Nova", year: 2021, minPlayers: 1, maxPlayers: 4, playTimeMin: 150, minAge: 14, designer: "Mathias Wigge", publisher: "Feuerland Spiele" },
  "7 Wonders": { name: "7 Wonders", year: 2010, minPlayers: 3, maxPlayers: 7, playTimeMin: 30, minAge: 10, designer: "Antoine Bauza", publisher: "Repos Production" },
  Agricola: { name: "Agricola", year: 2007, minPlayers: 1, maxPlayers: 4, playTimeMin: 120, minAge: 12, designer: "Uwe Rosenberg", publisher: "Lookout Games" },
};

/** Same rule as the app: the Ludothèque entry is created only if it doesn't exist. */
async function ensureGame(info: GameData, userId: string) {
  const normalizedName = normalizeName(info.name);
  return (await db.game.findUnique({ where: { normalizedName } })) ?? db.game.create({ data: { ...info, normalizedName, createdById: userId } });
}

async function addToKallax(libraryId: string, gameKey: string, userId: string, opts: { status?: string; notes?: string; name?: string } = {}) {
  const info = GAMES[gameKey];
  const game = await ensureGame(info, userId);
  const exists = await db.kallaxGame.findUnique({ where: { libraryId_gameId: { libraryId, gameId: game.id } } });
  if (exists) return { game, kallaxGame: exists };
  const { name, year, minPlayers, maxPlayers, playTimeMin, minAge, designer, publisher } = info;
  const kallaxGame = await db.kallaxGame.create({
    data: {
      libraryId,
      gameId: game.id,
      addedById: userId,
      ownerId: userId,
      name: opts.name ?? name,
      year,
      minPlayers,
      maxPlayers,
      playTimeMin,
      minAge,
      designer,
      publisher,
      status: opts.status ?? "OWNED",
      notes: opts.notes ?? null,
    },
  });
  return { game, kallaxGame };
}

async function main() {
  // Module rows so admins see every module in the console from day one.
  for (const key of ["events", "games", "kallax", "plays", "friends", "ai", "bazaar", "facebook", "profiles", "donations"]) {
    await db.moduleConfig.upsert({ where: { key }, create: { key }, update: {} });
  }

  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) throw new Error("Set ADMIN_PASSWORD in .env before seeding.");
  const admin = await ensureUser({
    email: process.env.ADMIN_EMAIL ?? "admin@rendezvous.local",
    username: process.env.ADMIN_USERNAME ?? "admin",
    displayName: "Admin",
    password: adminPassword,
    role: "ADMIN",
    meepleColor: "#d9480f",
    city: "Montréal",
    latitude: 45.5,
    longitude: -73.57,
  });
  console.log(`Admin ready: ${admin.email}`);

  if (process.env.SEED_DEMO_DATA !== "true") return;
  if (await db.user.findUnique({ where: { username: "marie" } })) {
    console.log("Demo data already present — skipping.");
    return;
  }
  const demoPassword = process.env.DEMO_PASSWORD;
  if (!demoPassword) throw new Error("Set DEMO_PASSWORD in .env to seed demo members.");

  // ── Fictional members (Montréal area) ──
  const marie = await ensureUser({ email: "marie@demo.local", username: "marie", displayName: "Marie", password: demoPassword, meepleColor: "#6741d9", city: "Montréal", latitude: 45.52, longitude: -73.58, bio: "Placement d'ouvriers pour toujours. Anachrony est mon jeu préféré.", favoriteGames: "Anachrony, Brass: Birmingham, Wingspan" });
  const julien = await ensureUser({ email: "julien@demo.local", username: "julien", displayName: "Julien", password: demoPassword, meepleColor: "#2b8a3e", city: "Montréal", latitude: 45.52, longitude: -73.58, bio: "Je partage ma Kallax avec Marie.", favoriteGames: "Catan, Carcassonne" });
  const sophie = await ensureUser({ email: "sophie@demo.local", username: "sophie", displayName: "Sophie", password: demoPassword, meepleColor: "#f2b705", city: "Laval", latitude: 45.57, longitude: -73.69, favoriteGames: "Azul, Merchants Cove" });
  const alex = await ensureUser({ email: "alex@demo.local", username: "alex", displayName: "Alex", password: demoPassword, meepleColor: "#1c5fbf", city: "Longueuil", latitude: 45.53, longitude: -73.52, favoriteGames: "Terraforming Mars, Spirit Island", locale: "en" });
  const lea = await ensureUser({ email: "lea@demo.local", username: "lea", displayName: "Léa", password: demoPassword, meepleColor: "#d6336c", city: "Québec", latitude: 46.81, longitude: -71.21, favoriteGames: "Wingspan, Cascadia" });

  for (const [a, b] of [
    [marie.id, julien.id],
    [marie.id, sophie.id],
    [marie.id, admin.id],
    [julien.id, alex.id],
    [sophie.id, alex.id],
    [admin.id, alex.id],
  ]) {
    await db.friendship.create({ data: { requesterId: a, addresseeId: b, status: "ACCEPTED", respondedAt: new Date() } });
  }
  await db.friendship.create({ data: { requesterId: lea.id, addresseeId: admin.id } }); // pending request for the admin

  const kallaxOf = async (userId: string) => (await db.library.findFirstOrThrow({ where: { members: { some: { userId, role: "OWNER" } } } })).id;

  // ── Kallax: Marie and Julien share one ──
  const salon = await kallaxOf(marie.id);
  await db.library.update({ where: { id: salon }, data: { name: "Kallax du salon" } });
  await db.libraryMember.create({ data: { libraryId: salon, userId: julien.id, status: "ACCEPTED", invitedBy: marie.id } });
  await db.library.delete({ where: { id: await kallaxOf(julien.id) } });

  const games: Record<string, string> = {};
  const shelf = async (libraryId: string, userId: string, items: [string, { status?: string; notes?: string; name?: string }?][]) => {
    for (const [key, opts] of items) games[key] = (await addToKallax(libraryId, key, userId, opts)).game.id;
  };
  await shelf(salon, marie.id, [["Anachrony", { notes: "Avec l'extension Fractures du temps." }], ["Brass: Birmingham"], ["Wingspan"], ["Ark Nova", { status: "PREORDERED" }], ["Spirit Island", { status: "WISHLIST" }]]);
  await shelf(salon, julien.id, [["Catan", { name: "Catan (5e édition)" }], ["Carcassonne"], ["Codenames"], ["Root", { status: "FOR_TRADE" }]]);
  await shelf(await kallaxOf(sophie.id), sophie.id, [["Azul"], ["Merchants Cove"], ["Cascadia"]]);
  await shelf(await kallaxOf(alex.id), alex.id, [["Terraforming Mars"], ["Spirit Island"], ["7 Wonders"]]);
  await shelf(await kallaxOf(admin.id), admin.id, [["Catan"], ["Merchants Cove"], ["Anachrony"], ["Agricola"]]);
  await shelf(await kallaxOf(lea.id), lea.id, [["Wingspan"], ["Azul"]]);

  // Sophie invited the admin to share her Kallax (pending invitation)
  await db.libraryMember.create({ data: { libraryId: await kallaxOf(sophie.id), userId: admin.id, status: "PENDING", invitedBy: sophie.id } });

  // ── Members' ratings (each member rates games from their Kallax) ──
  const ratings: [string, string, number][] = [
    [marie.id, "Anachrony", 10], [marie.id, "Wingspan", 8], [marie.id, "Brass: Birmingham", 9],
    [julien.id, "Catan", 9], [julien.id, "Anachrony", 8], [julien.id, "Carcassonne", 8],
    [sophie.id, "Azul", 9], [sophie.id, "Merchants Cove", 8], [sophie.id, "Cascadia", 9],
    [alex.id, "Terraforming Mars", 10], [alex.id, "Spirit Island", 9], [alex.id, "7 Wonders", 7],
    [lea.id, "Wingspan", 10], [lea.id, "Azul", 8],
    [admin.id, "Merchants Cove", 7], [admin.id, "Catan", 6],
  ];
  for (const [userId, key, score] of ratings) await db.gameRating.create({ data: { userId, gameId: games[key], score } });

  // ── Events (games on the menu come from the host's Kallax) ──
  const at = (days: number, hour: number) => {
    const d = new Date(Date.now() + days * day);
    d.setHours(hour, 0, 0, 0);
    return d;
  };
  const e1 = await db.event.create({
    data: {
      hostId: marie.id,
      title: "Soirée Anachrony",
      description: "Partie complète avec l'extension Fractures. Débutants bienvenus, j'explique les règles!",
      kind: "HOME_GAME",
      startsAt: at(3, 19),
      locationName: "Chez Marie et Julien",
      address: "123, rue Fictive",
      city: "Montréal",
      latitude: 45.52,
      longitude: -73.58,
      maxPlayers: 4,
      requiresApproval: true,
      games: { create: [{ gameId: games["Anachrony"] }] },
      attendees: { create: [{ userId: julien.id, status: "GOING" }, { userId: alex.id, status: "REQUESTED" }] },
    },
  });
  await db.event.create({
    data: {
      hostId: sophie.id,
      title: "Café ludique du jeudi",
      description: "Table ouverte au café : apportez vos jeux ou essayez les nôtres.",
      kind: "GAME_NIGHT",
      startsAt: at(5, 18),
      locationName: "Café Le Meeple (fictif)",
      city: "Laval",
      latitude: 45.57,
      longitude: -73.69,
      visibility: "PUBLIC",
      maxPlayers: 16,
      games: { create: [{ gameId: games["Azul"] }, { gameId: games["Cascadia"] }] },
      attendees: { create: [{ userId: marie.id, status: "GOING" }, { userId: admin.id, status: "MAYBE" }] },
    },
  });
  await db.event.create({
    data: {
      hostId: alex.id,
      title: "Tournoi Terraforming Mars",
      kind: "TOURNAMENT",
      startsAt: at(12, 13),
      endsAt: at(12, 20),
      locationName: "Salle communautaire",
      city: "Longueuil",
      latitude: 45.53,
      longitude: -73.52,
      maxPlayers: 20,
      games: { create: [{ gameId: games["Terraforming Mars"] }] },
    },
  });
  await db.event.create({
    data: {
      hostId: lea.id,
      title: "Wingspan et thé",
      kind: "HOME_GAME",
      startsAt: at(8, 14),
      city: "Québec",
      latitude: 46.81,
      longitude: -71.21,
      maxPlayers: 5,
      games: { create: [{ gameId: games["Wingspan"] }] },
    },
  });

  // ── Plays ──
  const play = async (
    key: string,
    daysAgo: number,
    by: string,
    seats: { userId?: string; guestName?: string; score?: number; isWinner?: boolean; status?: string }[],
    extra: { durationMin?: number; location?: string; eventId?: string } = {},
  ) =>
    db.play.create({
      data: {
        gameId: games[key],
        createdById: by,
        playedAt: new Date(Date.now() - daysAgo * day),
        ...extra,
        participants: { create: seats.map((s) => ({ ...s, status: s.status ?? "CONFIRMED", isWinner: s.isWinner ?? false })) },
      },
    });
  await play("Anachrony", 20, marie.id, [{ userId: marie.id, score: 58, isWinner: true }, { userId: julien.id, score: 51 }, { userId: alex.id, score: 44 }], { durationMin: 150, location: "Chez Marie", eventId: e1.id });
  await play("Catan", 14, julien.id, [{ userId: julien.id, score: 10, isWinner: true }, { userId: marie.id, score: 8 }, { guestName: "Thomas", score: 6 }], { durationMin: 80 });
  await play("Azul", 9, sophie.id, [{ userId: sophie.id, score: 74, isWinner: true }, { userId: marie.id, score: 61 }], { durationMin: 40 });
  await play("Merchants Cove", 6, admin.id, [{ userId: admin.id, score: 42, isWinner: true }, { userId: alex.id, score: 38 }, { userId: marie.id, score: 35 }], { durationMin: 100 });
  // Plays waiting for the admin to confirm
  await play("Catan", 2, marie.id, [{ userId: marie.id, score: 9 }, { userId: admin.id, score: 10, isWinner: true, status: "PENDING" }, { userId: sophie.id, score: 7 }], { durationMin: 75 });

  // ── Bazar ──
  await db.bazaarListing.create({
    data: {
      sellerId: julien.id,
      gameId: games["Root"],
      title: "Root — comme neuf",
      description: "Joué deux fois, cartes protégées. Annonce fictive de démonstration.",
      price: 45,
      kind: "BOTH",
      condition: "LIKE_NEW",
      delivery: "PICKUP",
      city: "Montréal",
      latitude: 45.52,
      longitude: -73.58,
    },
  });

  // ── Suggestion box ──
  const suggestion = (title: string, details: string | null, authorId: string, voters: string[], status = "OPEN", adminNote: string | null = null) =>
    db.suggestion.create({ data: { title, details, authorId, status, adminNote, votes: { create: [authorId, ...voters].map((userId) => ({ userId })) } } });
  await suggestion("Un classement des joueurs par jeu", "Voir qui gagne le plus souvent à chaque jeu, à partir des parties notées.", marie.id, [alex.id, sophie.id]);
  await suggestion("Rappel la veille d'une soirée de jeux", null, sophie.id, [julien.id], "PLANNED", "Bonne idée, c'est prévu!");
  await suggestion("Exporter ma Kallax en fichier CSV", null, alex.id, []);

  // ── Rules FAQ (normally built from the questions asked to the rules AI) ──
  await db.ruleFaq.create({
    data: {
      gameId: games["Catan"],
      question: "Combien de ressources reçoit-on au début de la partie?",
      answer: "Après la mise en place, chaque joueur reçoit **une ressource** de chaque tuile adjacente à sa **deuxième** colonie.",
      provider: "manual",
      status: "VERIFIED",
      askCount: 4,
    },
  });
  await db.ruleFaq.create({
    data: {
      gameId: games["Azul"],
      question: "Peut-on prendre des tuiles au centre et dans une fabrique au même tour?",
      answer: "Non. À ton tour, tu prends **toutes les tuiles d'une même couleur** soit dans **une** fabrique, soit au centre de la table, jamais les deux.",
      provider: "manual",
      askCount: 2,
    },
  });

  console.log("Fictional demo data created: 5 members, shared Kallax, Ludothèque, ratings, events, plays, a bazar listing, suggestions, rules FAQ.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
