import { db } from "@/lib/db";
import { ilike } from "@/lib/search";
import { getCurrentUser } from "@/lib/auth/session";
import { getModuleStates } from "@/lib/modules";
import { coverUrl } from "@/modules/games/service";
import { listEvents } from "@/modules/events/service";

// Global search (command palette): games, upcoming events and members.
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({}, { status: 401 });
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 80);
  if (q.length < 2) return Response.json({ games: [], events: [], members: [] });
  const modules = await getModuleStates();

  const [games, events, members] = await Promise.all([
    modules.games.enabled
      ? db.game.findMany({ where: { name: ilike(q) }, select: { id: true, name: true, year: true, coverFileId: true, imageUrl: true }, take: 6 })
      : [],
    modules.events.enabled ? listEvents(user.id, { q }).then((e) => e.slice(0, 5)) : [],
    db.user.findMany({
      where: {
        status: "ACTIVE",
        profileVisibility: { not: "PRIVATE" },
        OR: [{ displayName: ilike(q) }, { username: ilike(q) }],
      },
      select: { username: true, displayName: true, meepleColor: true, city: true },
      take: 5,
    }),
  ]);

  return Response.json({
    games: games.map((g) => ({ id: g.id, name: g.name, year: g.year, cover: coverUrl(g) })),
    events: events.map((e) => ({ id: e.id, title: e.title, startsAt: e.startsAt, city: e.city, kind: e.kind })),
    members,
  });
}
