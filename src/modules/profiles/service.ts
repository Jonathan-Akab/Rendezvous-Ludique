import "server-only";
import { db } from "@/lib/db";
import { getModule } from "@/lib/modules";
import { areFriends } from "@/modules/friends/service";
import { confirmedPlaysWhere, PLAY_INCLUDE } from "@/modules/plays/service";
import { kallaxCoverUrl } from "@/modules/kallax/service";

/**
 * Who may see a profile. viewerId is null for visitors who aren't signed in (public link).
 *  PUBLIC  — anyone with the link (if admins allow public profiles), MEMBERS — signed-in members,
 *  FRIENDS — accepted friends, PRIVATE — only the member.
 */
export async function canViewProfile(profile: { id: string; profileVisibility: string }, viewerId: string | null) {
  if (viewerId === profile.id) return true;
  const allowPublic = Boolean((await getModule("profiles")).settings.allowPublicProfiles);
  switch (profile.profileVisibility) {
    case "PUBLIC":
      return allowPublic || viewerId != null;
    case "MEMBERS":
      return viewerId != null;
    case "FRIENDS":
      return viewerId != null && (await areFriends(viewerId, profile.id));
    default:
      return false;
  }
}

export async function getProfileData(username: string) {
  const user = await db.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      displayName: true,
      meepleColor: true,
      bio: true,
      city: true,
      region: true,
      favoriteGames: true,
      profileVisibility: true,
      showLibrary: true,
      showPlays: true,
      status: true,
      createdAt: true,
    },
  });
  if (!user || user.status !== "ACTIVE") return null;

  const [kallax, plays, playCount, hosted, friendCount] = await Promise.all([
    user.showLibrary
      ? db.kallaxGame.findMany({
          where: { status: { in: ["OWNED", "FOR_TRADE"] }, parentId: null, library: { members: { some: { userId: user.id, status: "ACCEPTED" } } } },
          include: { game: { select: { coverFileId: true, imageUrl: true } }, owner: { select: { displayName: true, meepleColor: true } } },
          orderBy: { addedAt: "desc" },
        })
      : Promise.resolve([]),
    user.showPlays
      ? db.play.findMany({ where: confirmedPlaysWhere(user.id), include: PLAY_INCLUDE, orderBy: { playedAt: "desc" }, take: 5 })
      : Promise.resolve([]),
    db.play.count({ where: confirmedPlaysWhere(user.id) }),
    db.event.count({ where: { hostId: user.id } }),
    db.friendship.count({ where: { status: "ACCEPTED", OR: [{ requesterId: user.id }, { addresseeId: user.id }] } }),
  ]);

  // A game shared by two co-owners' libraries shows once.
  const seen = new Set<string>();
  // Shown only because the member chose to share their Kallax on their profile.
  const games = kallax
    .filter((g) => (seen.has(g.gameId) ? false : (seen.add(g.gameId), true)))
    .map((g) => ({
      id: g.id,
      status: g.status,
      notes: null,
      owner: g.owner,
      cover: kallaxCoverUrl(g),
      game: { id: g.gameId, name: g.name, minPlayers: g.minPlayers, maxPlayers: g.maxPlayers, playTimeMin: g.playTimeMin, year: g.year },
    }));

  return { user, games, plays, stats: { plays: playCount, games: games.length, hosted, friends: friendCount } };
}

export type ProfileData = NonNullable<Awaited<ReturnType<typeof getProfileData>>>;
