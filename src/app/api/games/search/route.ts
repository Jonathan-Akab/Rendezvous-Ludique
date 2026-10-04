import { getCurrentUser } from "@/lib/auth/session";
import { coverUrl, searchGames } from "@/modules/games/service";

// Autocomplete for the game picker: GET /api/games/search?q=azu
export async function GET(req: Request) {
  if (!(await getCurrentUser())) return Response.json([], { status: 401 });
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const games = await searchGames(q.slice(0, 80));
  return Response.json(
    games.map((g) => ({
      id: g.id,
      name: g.name,
      year: g.year,
      minPlayers: g.minPlayers,
      maxPlayers: g.maxPlayers,
      playTimeMin: g.playTimeMin,
      designer: g.designer,
      cover: coverUrl(g),
      owners: g._count.libraryGames,
      rating: g.rating,
    })),
  );
}
