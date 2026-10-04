// Seeds the first admin account and (optionally) demo data.
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

async function main() {
  // Module rows so admins see every module in the console from day one.
  for (const key of ["events", "kallax", "plays", "friends", "profiles", "donations"]) {
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
    await demoExtras();
    console.log("Demo data already present — refreshed ratings and game details.");
    return;
  }
  const demoPassword = process.env.DEMO_PASSWORD;
  if (!demoPassword) throw new Error("Set DEMO_PASSWORD in .env to seed demo members.");

  // ── Members (Montréal area) ──
  const marie = await ensureUser({ email: "marie@demo.local", username: "marie", displayName: "Marie", password: demoPassword, meepleColor: "#6741d9", city: "Montréal", latitude: 45.52, longitude: -73.58, bio: "Worker placement forever. Anachrony is my happy place.", favoriteGames: "Anachrony, Brass: Birmingham, Wingspan" });
  const julien = await ensureUser({ email: "julien@demo.local", username: "julien", displayName: "Julien", password: demoPassword, meepleColor: "#2b8a3e", city: "Montréal", latitude: 45.52, longitude: -73.58, bio: "Marie's partner in crime (and in kallax).", favoriteGames: "Catan, Carcassonne" });
  const sophie = await ensureUser({ email: "sophie@demo.local", username: "sophie", displayName: "Sophie", password: demoPassword, meepleColor: "#f2b705", city: "Laval", latitude: 45.57, longitude: -73.69, favoriteGames: "Azul, Merchants Cove", locale: "fr" });
  const alex = await ensureUser({ email: "alex@demo.local", username: "alex", displayName: "Alex", password: demoPassword, meepleColor: "#1c5fbf", city: "Longueuil", latitude: 45.53, longitude: -73.52, favoriteGames: "Terraforming Mars, Spirit Island", locale: "en" });
  const lea = await ensureUser({ email: "lea@demo.local", username: "lea", displayName: "Léa", password: demoPassword, meepleColor: "#d6336c", city: "Québec", latitude: 46.81, longitude: -71.21, favoriteGames: "Wingspan, Cascadia" });

  // ── Friendships ──
  const friends: [string, string][] = [
    [marie.id, julien.id],
    [marie.id, sophie.id],
    [marie.id, admin.id],
    [julien.id, alex.id],
    [sophie.id, alex.id],
    [admin.id, alex.id],
  ];
  for (const [a, b] of friends) await db.friendship.create({ data: { requesterId: a, addresseeId: b, status: "ACCEPTED", respondedAt: new Date() } });
  await db.friendship.create({ data: { requesterId: lea.id, addresseeId: admin.id } }); // pending request for the admin

  // ── Catalogue ──
  const catalogue: [string, number, number, number, number][] = [
    ["Catan", 1995, 3, 4, 90],
    ["Anachrony", 2017, 1, 4, 120],
    ["Merchants Cove", 2021, 1, 4, 90],
    ["Wingspan", 2019, 1, 5, 70],
    ["Azul", 2017, 2, 4, 45],
    ["Terraforming Mars", 2016, 1, 5, 120],
    ["Carcassonne", 2000, 2, 5, 40],
    ["Brass: Birmingham", 2018, 2, 4, 120],
    ["Spirit Island", 2017, 1, 4, 120],
    ["Cascadia", 2021, 1, 4, 45],
    ["Ticket to Ride", 2004, 2, 5, 60],
    ["7 Wonders", 2010, 3, 7, 30],
    ["Agricola", 2007, 1, 4, 120],
    ["Ark Nova", 2021, 1, 4, 150],
    ["Codenames", 2015, 2, 8, 15],
    ["Root", 2018, 2, 4, 90],
  ];
  const games: Record<string, string> = {};
  for (const [name, year, minPlayers, maxPlayers, playTimeMin] of catalogue) {
    const g = await db.game.create({ data: { name, year, minPlayers, maxPlayers, playTimeMin, createdById: admin.id } });
    games[name] = g.id;
  }

  // ── Kallax: Marie & Julien share one ──
  const marieLib = await db.library.findFirstOrThrow({ where: { members: { some: { userId: marie.id } } } });
  await db.library.update({ where: { id: marieLib.id }, data: { name: "Kallax du salon" } });
  await db.libraryMember.create({ data: { libraryId: marieLib.id, userId: julien.id, status: "ACCEPTED", invitedBy: marie.id } });
  const julienOwn = await db.library.findFirstOrThrow({ where: { members: { some: { userId: julien.id, role: "OWNER" } } } });
  await db.library.delete({ where: { id: julienOwn.id } });
  const shelf: [string, string, string?][] = [
    ["Anachrony", marie.id],
    ["Brass: Birmingham", marie.id],
    ["Wingspan", marie.id],
    ["Ark Nova", marie.id, "PREORDERED"],
    ["Catan", julien.id],
    ["Carcassonne", julien.id],
    ["Codenames", julien.id],
    ["Root", julien.id, "FOR_TRADE"],
    ["Spirit Island", marie.id, "WISHLIST"],
  ];
  for (const [name, ownerId, status] of shelf) {
    await db.libraryGame.create({ data: { libraryId: marieLib.id, gameId: games[name], ownerId, status: status ?? "OWNED" } });
  }
  for (const [user, names] of [
    [sophie, ["Azul", "Merchants Cove", "Cascadia", "Ticket to Ride"]],
    [alex, ["Terraforming Mars", "Spirit Island", "7 Wonders"]],
    [admin, ["Catan", "Merchants Cove", "Anachrony", "Agricola"]],
  ] as const) {
    const lib = await db.library.findFirstOrThrow({ where: { members: { some: { userId: user.id } } } });
    for (const name of names) await db.libraryGame.create({ data: { libraryId: lib.id, gameId: games[name], ownerId: user.id } });
  }
  // Sophie invited the admin to share her kallax (pending invitation)
  const sophieLib = await db.library.findFirstOrThrow({ where: { members: { some: { userId: sophie.id } } } });
  await db.libraryMember.create({ data: { libraryId: sophieLib.id, userId: admin.id, status: "PENDING", invitedBy: sophie.id } });

  // ── Events ──
  const at = (days: number, hour: number) => {
    const d = new Date(Date.now() + days * day);
    d.setHours(hour, 0, 0, 0);
    return d;
  };
  const e1 = await db.event.create({
    data: {
      hostId: marie.id,
      title: "Soirée Anachrony",
      description: "Full game with the Fractures expansion. Beginners welcome, I'll teach!",
      kind: "HOME_GAME",
      startsAt: at(3, 19),
      locationName: "Chez Marie & Julien",
      address: "123 rue Saint-Denis",
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
      description: "Open table at the café: bring your favourite games or play ours.",
      kind: "GAME_NIGHT",
      startsAt: at(5, 18),
      locationName: "Café Le Meeple",
      address: "45 boulevard Saint-Martin",
      city: "Laval",
      latitude: 45.57,
      longitude: -73.69,
      visibility: "PUBLIC",
      maxPlayers: 16,
      games: { create: [{ gameId: games["Azul"] }, { gameId: games["Cascadia"] }, { gameId: games["Codenames"] }] },
      attendees: { create: [{ userId: marie.id, status: "GOING" }, { userId: admin.id, status: "MAYBE" }] },
    },
  });
  await db.event.create({
    data: {
      hostId: alex.id,
      title: "Terraforming Mars tournament",
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
      title: "Wingspan & thé",
      kind: "HOME_GAME",
      startsAt: at(8, 14),
      city: "Québec",
      latitude: 46.81,
      longitude: -71.21,
      maxPlayers: 5,
      visibility: "MEMBERS",
      games: { create: [{ gameId: games["Wingspan"] }] },
    },
  });

  // ── Plays ──
  const play = async (
    game: string,
    daysAgo: number,
    by: string,
    seats: { userId?: string; guestName?: string; score?: number; isWinner?: boolean; status?: string }[],
    extra: { durationMin?: number; location?: string; eventId?: string } = {},
  ) =>
    db.play.create({
      data: {
        gameId: games[game],
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
  await play("Terraforming Mars", 1, alex.id, [{ userId: alex.id, score: 88, isWinner: true }, { userId: admin.id, score: 79, status: "PENDING" }], { durationMin: 140 });

  await demoExtras();
  console.log("Demo data created: 5 members, 16 games, 4 events, 6 plays, ratings.");
}

/** Game details and member ratings for the demo catalogue (safe to re-run). */
async function demoExtras() {
  const details: Record<string, { designer: string; publisher: string; categories: string; weight: number; minAge: number }> = {
    Catan: { designer: "Klaus Teuber", publisher: "Kosmos", categories: "Trading, Dice rolling, Network building", weight: 2.3, minAge: 10 },
    Anachrony: { designer: "Richard Amann, Viktor Péter, Dávid Turczi", publisher: "Mindclash Games", categories: "Worker placement, Time travel, Euro", weight: 4.0, minAge: 14 },
    "Merchants Cove": { designer: "Carl Van Ostrand, Drew Wynne", publisher: "Final Frontier Games", categories: "Asymmetric, Economic, Euro", weight: 3.1, minAge: 12 },
    Wingspan: { designer: "Elizabeth Hargrave", publisher: "Stonemaier Games", categories: "Engine building, Card drafting, Animals", weight: 2.5, minAge: 10 },
    Azul: { designer: "Michael Kiesling", publisher: "Plan B Games", categories: "Tile placement, Pattern building, Abstract", weight: 1.8, minAge: 8 },
    "Terraforming Mars": { designer: "Jacob Fryxelius", publisher: "FryxGames", categories: "Engine building, Space, Card drafting", weight: 3.2, minAge: 12 },
    Carcassonne: { designer: "Klaus-Jürgen Wrede", publisher: "Hans im Glück", categories: "Tile placement, Area control", weight: 1.9, minAge: 7 },
    "Brass: Birmingham": { designer: "Gavan Brown, Matt Tolman, Martin Wallace", publisher: "Roxley", categories: "Economic, Network building, Euro", weight: 3.9, minAge: 14 },
  };
  for (const [name, d] of Object.entries(details)) {
    await db.game.updateMany({ where: { name, designer: null }, data: d });
  }
  const scores: [string, string, number][] = [
    ["marie", "Anachrony", 10], ["marie", "Wingspan", 8], ["marie", "Catan", 6], ["marie", "Brass: Birmingham", 9],
    ["julien", "Catan", 9], ["julien", "Anachrony", 8], ["julien", "Carcassonne", 8],
    ["sophie", "Azul", 9], ["sophie", "Merchants Cove", 8], ["sophie", "Wingspan", 9],
    ["alex", "Terraforming Mars", 10], ["alex", "Anachrony", 9], ["alex", "Merchants Cove", 7],
    ["lea", "Wingspan", 10], ["lea", "Azul", 8],
  ];
  for (const [username, game, score] of scores) {
    const [u, g] = await Promise.all([db.user.findUnique({ where: { username } }), db.game.findFirst({ where: { name: game } })]);
    if (!u || !g) continue;
    await db.gameRating.upsert({ where: { gameId_userId: { gameId: g.id, userId: u.id } }, create: { gameId: g.id, userId: u.id, score }, update: {} });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
