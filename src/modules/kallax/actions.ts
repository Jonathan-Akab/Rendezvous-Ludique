"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { getModule } from "@/lib/modules";
import { oneOf, optInt, optStr, str, type ActionState } from "@/lib/forms";
import { LIBRARY_GAME_STATUSES } from "@/lib/constants";
import { isLibraryMember } from "./service";
import { createGameRecord, findGameByName } from "@/modules/games/mutations";
import { UploadError } from "@/lib/storage";

async function guard() {
  const user = await requireUser();
  const mod = await getModule("kallax");
  if (!mod.enabled) throw new Error("Module disabled");
  return { user, mod };
}

const done = () => revalidatePath("/kallax");

export async function addGameAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { user } = await guard();
  const t = await getTranslations("kallax.errors");
  const libraryId = str(fd, "libraryId");
  if (!(await isLibraryMember(libraryId, user.id))) return { error: t("notMember") };

  // Either a game picked from the catalogue, or a new one described in the form.
  let game = str(fd, "gameId") ? await db.game.findUnique({ where: { id: str(fd, "gameId") } }) : null;
  if (!game) {
    const name = str(fd, "game.name") || str(fd, "name");
    if (!name || name.length > 150) return { error: t("name") };
    game = await findGameByName(name);
    if (!game) {
      const games = await getModule("games");
      if (!games.settings.membersCanAddGames && user.role !== "ADMIN") return { error: t("catalogueLocked") };
      try {
        game = await createGameRecord(fd, user.id);
      } catch (e) {
        if (e instanceof UploadError) return { error: (await getTranslations("games.errors"))(`upload.${e.code}`) };
        throw e;
      }
    }
  }

  // The copy belongs to the chosen co-owner, defaulting to the member adding it.
  const ownerId = str(fd, "ownerId") || user.id;
  if (!(await isLibraryMember(libraryId, ownerId))) return { error: t("notMember") };

  const already = await db.libraryGame.findUnique({ where: { libraryId_gameId: { libraryId, gameId: game.id } } });
  if (already) return { error: t("duplicate", { name: game.name }) };

  await db.libraryGame.create({
    data: {
      libraryId,
      gameId: game.id,
      ownerId,
      status: oneOf(str(fd, "status"), LIBRARY_GAME_STATUSES, "OWNED"),
      notes: optStr(fd, "notes"),
    },
  });
  const rating = optInt(fd, "rating");
  if (rating && rating >= 1 && rating <= 10) {
    await db.gameRating.upsert({
      where: { gameId_userId: { gameId: game.id, userId: user.id } },
      create: { gameId: game.id, userId: user.id, score: rating },
      update: { score: rating },
    });
  }
  done();
  return { ok: true, message: t("added", { name: game.name }) };
}
export async function setLibraryGameStatusAction(id: string, status: string) {
  const { user } = await guard();
  const lg = await db.libraryGame.findUnique({ where: { id } });
  if (!lg || !(await isLibraryMember(lg.libraryId, user.id))) return;
  await db.libraryGame.update({ where: { id }, data: { status: oneOf(status, LIBRARY_GAME_STATUSES, "OWNED") } });
  done();
}

export async function removeLibraryGameAction(id: string) {
  const { user } = await guard();
  const lg = await db.libraryGame.findUnique({ where: { id } });
  if (!lg || !(await isLibraryMember(lg.libraryId, user.id))) return;
  await db.libraryGame.delete({ where: { id } });
  done();
}

export async function createLibraryAction(fd: FormData) {
  const { user } = await guard();
  const name = str(fd, "name").slice(0, 80);
  if (!name) return;
  await db.library.create({
    data: { name, members: { create: { userId: user.id, role: "OWNER", status: "ACCEPTED" } } },
  });
  done();
}

export async function renameLibraryAction(libraryId: string, fd: FormData) {
  const { user } = await guard();
  const m = await isLibraryMember(libraryId, user.id);
  const name = str(fd, "name").slice(0, 80);
  if (!m || m.role !== "OWNER" || !name) return;
  await db.library.update({ where: { id: libraryId }, data: { name } });
  done();
}

/** Invite another member to share this kallax (e.g. a partner or roommate). */
export async function inviteToLibraryAction(libraryId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const { user, mod } = await guard();
  const t = await getTranslations("kallax.errors");
  if (!mod.settings.allowSharing) return { error: t("sharingDisabled") };
  if (!(await isLibraryMember(libraryId, user.id))) return { error: t("notMember") };

  const username = str(fd, "username").replace(/^@/, "").toLowerCase();
  const invitee = await db.user.findUnique({ where: { username } });
  if (!invitee || invitee.status !== "ACTIVE") return { error: t("unknownMember") };

  const count = await db.libraryMember.count({ where: { libraryId } });
  if (count >= Number(mod.settings.maxSharedMembers)) return { error: t("full", { max: Number(mod.settings.maxSharedMembers) }) };

  const exists = await db.libraryMember.findUnique({ where: { libraryId_userId: { libraryId, userId: invitee.id } } });
  if (exists) return { error: t("alreadyInvited") };

  await db.libraryMember.create({ data: { libraryId, userId: invitee.id, status: "PENDING", invitedBy: user.id } });
  done();
  return { ok: true, message: t("invited", { name: invitee.displayName }) };
}

export async function respondLibraryInviteAction(memberId: string, accept: boolean) {
  const { user } = await guard();
  const m = await db.libraryMember.findUnique({ where: { id: memberId } });
  if (!m || m.userId !== user.id || m.status !== "PENDING") return;
  if (accept) await db.libraryMember.update({ where: { id: memberId }, data: { status: "ACCEPTED" } });
  else await db.libraryMember.delete({ where: { id: memberId } });
  done();
  revalidatePath("/home");
}

/** Leave a shared kallax; an empty kallax is deleted. Owners can also remove others. */
export async function removeLibraryMemberAction(libraryId: string, userId: string) {
  const { user } = await guard();
  const me = await isLibraryMember(libraryId, user.id);
  if (!me || (userId !== user.id && me.role !== "OWNER")) return;

  await db.libraryMember.deleteMany({ where: { libraryId, userId } });
  // Their copies stay on the shelf only if someone else still shares it.
  await db.libraryGame.updateMany({ where: { libraryId, ownerId: userId }, data: { ownerId: null } });

  const remaining = await db.libraryMember.findMany({ where: { libraryId, status: "ACCEPTED" } });
  if (remaining.length === 0) {
    await db.library.delete({ where: { id: libraryId } });
  } else if (!remaining.some((r) => r.role === "OWNER")) {
    await db.libraryMember.update({ where: { id: remaining[0].id }, data: { role: "OWNER" } });
  }
  done();
}
