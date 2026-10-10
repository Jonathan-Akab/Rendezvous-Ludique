"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { getModule } from "@/lib/modules";
import { deleteStored, UploadError } from "@/lib/storage";
import { oneOf, optInt, optStr, str, type ActionState } from "@/lib/forms";
import { LIBRARY_GAME_STATUSES } from "@/lib/constants";
import { readGameFields, storeCoverFromForm } from "@/modules/games/mutations";
import { LIBRARY_VISIBILITIES, addToKallax, attachExpansion, detachExpansion, extraPlaysFor, findBaseInLibrary, getLoggedPlayCounts, isLibraryMember } from "./service";
import { enrichAvailable, lookUpFacts } from "@/modules/games/enrich";
import { fillEmptyGameFields } from "@/modules/games/service";
import { notify } from "@/modules/notifications/emails";
import { aiGameDetails, ludoDetails, type DetailFields } from "@/modules/games/webDetails";
import { getLocale } from "next-intl/server";

async function guard() {
  const user = await requireUser();
  const mod = await getModule("kallax");
  if (!mod.enabled) throw new Error("Module disabled");
  return { user, mod };
}

const done = () => {
  revalidatePath("/kallax", "layout");
  revalidatePath("/games", "layout");
};

async function uploadMessage(e: unknown) {
  if (e instanceof UploadError) return (await getTranslations("games.errors"))(`upload.${e.code}`);
  throw e;
}

/** A Kallax record the member can manage (it's in a Kallax they share). */
async function myKallaxGame(id: string, userId: string) {
  const kg = await db.kallaxGame.findUnique({ where: { id } });
  if (!kg || !(await isLibraryMember(kg.libraryId, userId))) return null;
  return kg;
}

/**
 * Adds a game to a Kallax. Picking a Ludothèque game copies its details into the Kallax
 * record; a new name creates the Ludothèque entry (only if it doesn't exist yet).
 */
export async function addGameAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { user } = await guard();
  const t = await getTranslations("kallax.errors");
  const libraryId = str(fd, "libraryId");
  if (!(await isLibraryMember(libraryId, user.id))) return { error: t("notMember") };

  const pickedId = str(fd, "gameId") || undefined;
  const info = readGameFields(fd);
  if (!pickedId && (!info.name || info.name.length > 150)) return { error: t("name") };

  const ownerId = str(fd, "ownerId") || user.id;
  if (!(await isLibraryMember(libraryId, ownerId))) return { error: t("notMember") };

  let result: Awaited<ReturnType<typeof addToKallax>>;
  try {
    const coverFileId = await storeCoverFromForm(fd, user.id);
    result = await addToKallax(libraryId, info, {
      userId: user.id,
      ownerId,
      gameId: pickedId,
      status: oneOf(str(fd, "status"), LIBRARY_GAME_STATUSES, "OWNED"),
      notes: optStr(fd, "notes"),
      // "this is an expansion of…" (a game of the same Kallax)
      parentId: optStr(fd, "parentId"),
      coverFileId,
    });
  } catch (e) {
    return { error: await uploadMessage(e) };
  }
  if (!result) return { error: t("name") };
  if (!result.created) return { error: t("duplicate", { name: result.kallaxGame.name }) };

  // "played N times" typed in when adding (plays logged on the site count by themselves)
  const timesPlayed = optInt(fd, "timesPlayed");
  if (timesPlayed != null) {
    const logged = (await getLoggedPlayCounts(libraryId, [result.game.id])).get(result.game.id) ?? 0;
    await db.kallaxGame.update({ where: { id: result.kallaxGame.id }, data: { extraPlays: extraPlaysFor(timesPlayed, logged) ?? 0 } });
  }

  const rating = optInt(fd, "rating");
  if (rating && rating >= 1 && rating <= 10) {
    await db.gameRating.upsert({
      where: { gameId_userId: { gameId: result.game.id, userId: user.id } },
      create: { gameId: result.game.id, userId: user.id, score: rating },
      update: { score: rating },
    });
  }
  done();
  const kg = result.kallaxGame;
  return {
    ok: true,
    message: t("added", { name: kg.name }),
    // no picture yet: the form proposes some
    data: { kallaxGameId: kg.id, name: kg.name, needsImage: !kg.coverFileId && !kg.imageUrl && !result.game.coverFileId && !result.game.imageUrl },
  };
}

/** Edit the Kallax's own record of a game (the Ludothèque entry is never changed here). */
export async function updateKallaxGameAction(id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const { user } = await guard();
  const t = await getTranslations("kallax.errors");
  const kg = await myKallaxGame(id, user.id);
  if (!kg) return { error: t("notMember") };
  const info = readGameFields(fd);
  if (!info.name) return { error: t("name") };

  let coverFileId = kg.coverFileId;
  try {
    const uploaded = await storeCoverFromForm(fd, user.id);
    if (uploaded) {
      if (kg.coverFileId) await deleteStored(kg.coverFileId);
      coverFileId = uploaded;
    }
  } catch (e) {
    return { error: await uploadMessage(e) };
  }
  if (fd.get("removeCover") === "on" && kg.coverFileId) {
    await deleteStored(kg.coverFileId);
    coverFileId = null;
  }
  const timesPlayed = optInt(fd, "timesPlayed");
  const extraPlays = timesPlayed == null ? null : extraPlaysFor(timesPlayed, (await getLoggedPlayCounts(kg.libraryId, [kg.gameId])).get(kg.gameId) ?? 0);
  await db.kallaxGame.update({
    where: { id },
    data: {
      ...(extraPlays != null ? { extraPlays } : {}),
      ...info,
      imageUrl: info.imageUrl ?? (fd.get("removeImageUrl") === "on" ? null : kg.imageUrl),
      coverFileId,
      status: oneOf(str(fd, "status"), LIBRARY_GAME_STATUSES, kg.status as (typeof LIBRARY_GAME_STATUSES)[number]),
      notes: optStr(fd, "notes")?.slice(0, 1000) ?? null,
      ownerId: (str(fd, "ownerId") && (await isLibraryMember(kg.libraryId, str(fd, "ownerId"))) ? str(fd, "ownerId") : kg.ownerId),
    },
  });
  done();
  return { ok: true, message: t("saved") };
}

export type DetailsResult = { ok: true; fields: DetailFields; source: string | null; via: "ludo" | "web" | "free" } | { ok: false; error: "notFound" | "unavailable" | "name" };

/** "Copy from the Ludothèque": the Ludothèque's details for this game (by id, or by exact name). Only fills the form. */
export async function copyFromLudoAction(gameId: string | null, name: string): Promise<DetailsResult> {
  await guard();
  const d = await ludoDetails(gameId, name.slice(0, 150));
  if (!d) return { ok: false, error: "notFound" };
  const { name: _name, ...fields } = d;
  void _name;
  return { ok: true, fields, source: null, via: "ludo" };
}

/** "Ask the AI to fill": Claude searches the web for each detail (or the free AI answers from memory). Only fills the form. */
export async function aiFillDetailsAction(name: string): Promise<DetailsResult> {
  const { user } = await guard();
  const clean = name.trim().slice(0, 150);
  if (clean.length < 2) return { ok: false, error: "name" };
  const found = await aiGameDetails(clean, user.id, await getLocale());
  if (!found) return { ok: false, error: "unavailable" };
  return { ok: true, fields: found.fields, source: found.source, via: found.via };
}

/** Upload the box picture of a Kallax record (replaces the previous uploaded one). */
export async function uploadKallaxCoverAction(id: string, fd: FormData): Promise<ActionState> {
  const { user } = await guard();
  const t = await getTranslations("kallax.errors");
  const kg = await myKallaxGame(id, user.id);
  if (!kg) return { error: t("notMember") };
  let uploaded: string | null;
  try {
    uploaded = await storeCoverFromForm(fd, user.id);
  } catch (e) {
    return { error: await uploadMessage(e) };
  }
  if (!uploaded) return { error: await uploadMessage(new UploadError("empty")) };
  if (kg.coverFileId) await deleteStored(kg.coverFileId);
  await db.kallaxGame.update({ where: { id }, data: { coverFileId: uploaded } });
  done();
  return { ok: true };
}

/** Use a suggested picture (a link) for the Kallax record; fills the Ludothèque's picture if it has none. */
export async function setKallaxImageAction(id: string, url: string) {
  const { user } = await guard();
  const kg = await myKallaxGame(id, user.id);
  if (!kg || !/^https:\/\//i.test(url) || url.length > 1000) return { ok: false };
  await db.kallaxGame.update({ where: { id }, data: { imageUrl: url } });
  await db.game.updateMany({ where: { id: kg.gameId, coverFileId: null, imageUrl: null }, data: { imageUrl: url } });
  done();
  return { ok: true };
}

export async function setLibraryGameStatusAction(id: string, status: string) {
  const { user } = await guard();
  if (!(await myKallaxGame(id, user.id))) return;
  await db.kallaxGame.update({ where: { id }, data: { status: oneOf(status, LIBRARY_GAME_STATUSES, "OWNED") } });
  done();
}

export async function removeLibraryGameAction(id: string) {
  const { user } = await guard();
  const kg = await myKallaxGame(id, user.id);
  if (!kg) return;
  if (kg.coverFileId) await deleteStored(kg.coverFileId);
  await db.kallaxGame.delete({ where: { id } });
  done();
}

export async function removeKallaxGameAndBackAction(id: string) {
  await removeLibraryGameAction(id);
  redirect("/kallax");
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

/** Who can look at this Kallax besides the members sharing it (read-only): nobody, friends, or every member. */
export async function setLibraryVisibilityAction(libraryId: string, fd: FormData) {
  const { user } = await guard();
  const m = await isLibraryMember(libraryId, user.id);
  if (!m || m.role !== "OWNER") return;
  const visibility = oneOf(str(fd, "visibility"), LIBRARY_VISIBILITIES, "PRIVATE");
  await db.library.update({ where: { id: libraryId }, data: { visibility } });
  done();
  revalidatePath("/members", "layout");
}

/** Invite another member to share this Kallax (e.g. a partner or roommate). */
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
  void notify(invitee.id, "kallaxInvite", { name: user.displayName }, "/kallax");
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

/** Leave a shared Kallax; an empty Kallax is deleted. Owners can also remove others. */
export async function removeLibraryMemberAction(libraryId: string, userId: string) {
  const { user } = await guard();
  const me = await isLibraryMember(libraryId, user.id);
  if (!me || (userId !== user.id && me.role !== "OWNER")) return;

  await db.libraryMember.deleteMany({ where: { libraryId, userId } });
  // Their copies stay on the shelf only if someone else still shares it.
  await db.kallaxGame.updateMany({ where: { libraryId, ownerId: userId }, data: { ownerId: null } });

  const remaining = await db.libraryMember.findMany({ where: { libraryId, status: "ACCEPTED" } });
  if (remaining.length === 0) {
    await db.library.delete({ where: { id: libraryId } });
  } else if (!remaining.some((r) => r.role === "OWNER")) {
    await db.libraryMember.update({ where: { id: remaining[0].id }, data: { role: "OWNER" } });
  }
  done();
}

const nint = z.number().int().nullable().optional();
const ntext = (max: number) => z.string().trim().max(max).nullable().optional();
const importItemSchema = z.object({
  name: z.string().trim().min(1).max(150),
  gameId: z.string().optional(),
  year: nint,
  minPlayers: nint,
  maxPlayers: nint,
  playTimeMin: nint,
  minAge: nint,
  designer: ntext(200),
  publisher: ntext(200),
  weight: z.number().min(1).max(5).nullable().optional(),
  categories: ntext(300),
  description: ntext(1200),
  imageUrl: z.string().url().startsWith("https://").max(1000).nullable().optional(),
  status: z.string().optional(),
  // Expansion: attached to a game already in the Kallax, or to another game of this import.
  parentId: z.string().nullable().optional(),
  parentIndex: z.number().int().min(0).nullable().optional(),
});

/**
 * Bulk import into a Kallax (from a list or photos), after the member validated each game.
 * Each game gets its own Kallax record (expansions are attached to their base game); the
 * Ludothèque gains the games it didn't know and fills its empty details. An optional
 * `cover` photo (the member's own photo of the box) becomes the picture of a single game.
 */
export async function importGamesAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { user } = await guard();
  const t = await getTranslations("kallax.import");
  const libraryId = str(fd, "libraryId");
  if (!(await isLibraryMember(libraryId, user.id))) return { error: t("notMember") };

  let items: z.infer<typeof importItemSchema>[];
  try {
    items = z.array(importItemSchema).max(500).parse(JSON.parse(str(fd, "items") || "[]"));
  } catch {
    return { error: t("invalid") };
  }
  if (!items.length) return { error: t("nothingSelected") };

  const defaultStatus = oneOf(str(fd, "status"), LIBRARY_GAME_STATUSES, "OWNED");
  let added = 0;
  let skipped = 0;
  let attached = 0;
  const needImages: { id: string; name: string }[] = [];
  const addedGames: { id: string; name: string }[] = [];
  const createdByIndex = new Map<number, string>();

  // Base games first, so expansions of this same import can be attached to them.
  const order = items.map((item, index) => ({ item, index })).sort((a, b) => Number(a.item.parentIndex != null) - Number(b.item.parentIndex != null));
  for (const { item, index } of order) {
    let coverFileId: string | null = null;
    if (items.length === 1) {
      try {
        coverFileId = await storeCoverFromForm(fd, user.id);
      } catch {
        coverFileId = null;
      }
    }
    const { parentId, parentIndex, status, gameId, ...info } = item;
    const result = await addToKallax(libraryId, info, {
      userId: user.id,
      gameId,
      status: status ? oneOf(status, LIBRARY_GAME_STATUSES, defaultStatus) : defaultStatus,
      coverFileId,
    });
    if (!result) {
      skipped++;
      continue;
    }
    const { kallaxGame: kg, game } = result;
    createdByIndex.set(index, kg.id);
    if (!result.created) {
      // Already in this Kallax: what the member validated still completes it (empty fields
      // only) and attaches it to its base game.
      skipped++;
      const keep = <T>(current: T | null, value: T | null | undefined) => (current == null && value != null ? value : undefined);
      await db.kallaxGame.update({
        where: { id: kg.id },
        data: {
          year: keep(kg.year, info.year),
          minPlayers: keep(kg.minPlayers, info.minPlayers),
          maxPlayers: keep(kg.maxPlayers, info.maxPlayers),
          playTimeMin: keep(kg.playTimeMin, info.playTimeMin),
          minAge: keep(kg.minAge, info.minAge),
          designer: keep(kg.designer, info.designer),
          publisher: keep(kg.publisher, info.publisher),
          imageUrl: kg.coverFileId ? undefined : keep(kg.imageUrl, info.imageUrl),
        },
      });
      await fillEmptyGameFields(game.id, info);
      const existingBase = parentIndex != null ? createdByIndex.get(parentIndex) : parentId;
      if (existingBase && !kg.parentId && (await attachExpansion(kg.id, existingBase))) attached++;
      continue;
    }
    added++;
    // The Ludothèque learns what was validated (only its empty fields).
    await fillEmptyGameFields(game.id, info);
    if (info.imageUrl && !kg.imageUrl && !kg.coverFileId) await db.kallaxGame.update({ where: { id: kg.id }, data: { imageUrl: info.imageUrl } });

    const base = parentIndex != null ? createdByIndex.get(parentIndex) : parentId;
    if (base && (await attachExpansion(kg.id, base))) attached++;
    else addedGames.push({ id: kg.id, name: kg.name });

    if (!kg.coverFileId && !info.imageUrl && !game.coverFileId && !game.imageUrl) needImages.push({ id: kg.id, name: kg.name });
  }

  done();
  return { ok: true, message: t("done", { added: addedGames.length, attached, skipped }), data: { needImages, addedGames } };
}

// ───────────── Expansions ─────────────

/** "This game is an expansion of…" (empty: a game of its own). */
export async function setKallaxParentAction(id: string, fd: FormData) {
  const { user } = await guard();
  const kg = await myKallaxGame(id, user.id);
  if (!kg) return;
  const parentId = str(fd, "parentId");
  if (parentId) await attachExpansion(kg.id, parentId);
  else await detachExpansion(kg.id);
  done();
}

/** Attaches another game of the same Kallax to this one as its expansion. */
export async function addKallaxExpansionAction(baseId: string, fd: FormData) {
  const { user } = await guard();
  const base = await myKallaxGame(baseId, user.id);
  if (!base) return;
  const expansionId = str(fd, "expansionId");
  if (expansionId) await attachExpansion(expansionId, base.id);
  done();
}

export type ExpansionProposal = { id: string; name: string; baseId: string; baseName: string };

/**
 * Finds games of this Kallax that are really expansions of another of its games: asks the
 * free AI (when available), otherwise reads names like "Clinic: The Extension".
 * Nothing changes until the member confirms.
 */
export async function detectExpansionsAction(libraryId: string): Promise<ExpansionProposal[]> {
  const { user } = await guard();
  if (!(await isLibraryMember(libraryId, user.id))) return [];
  const games = await db.kallaxGame.findMany({ where: { libraryId, parentId: null }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  const proposals = new Map<string, ExpansionProposal>();
  const propose = async (g: { id: string; name: string }, baseName: string) => {
    if (proposals.has(g.id)) return;
    const base = await findBaseInLibrary(libraryId, baseName, g.id);
    if (base) proposals.set(g.id, { id: g.id, name: g.name, baseId: base.id, baseName: base.name });
  };

  if (await enrichAvailable()) {
    for (let i = 0; i < games.length; i += 20) {
      const chunk = games.slice(i, i + 20);
      try {
        const facts = await lookUpFacts(chunk.map((g) => g.name), user.locale);
        for (const g of chunk) {
          const f = facts.get(g.name.trim().toLowerCase());
          if (f?.isExpansion && f.baseGame) await propose(g, f.baseGame);
        }
      } catch {
        break; // free AI busy: the name rule below still helps
      }
    }
  }
  // Names like "Clinic: The Extension", "Catan – Seafarers expansion".
  const rule = /^(.+?)\s*[:–—-]\s*.*\b(extension|expansion|exp\.?|add-?on|module)\b/i;
  for (const g of games) {
    const m = g.name.match(rule);
    if (m) await propose(g, m[1]);
  }
  return [...proposals.values()].filter((p) => !proposals.has(p.baseId)); // a base can't itself be an expansion here
}

/** Attaches the expansions the member confirmed. */
export async function attachExpansionsAction(pairs: { id: string; baseId: string }[]) {
  const { user } = await guard();
  let n = 0;
  for (const p of pairs.slice(0, 200)) {
    if ((await myKallaxGame(p.id, user.id)) && (await attachExpansion(p.id, p.baseId))) n++;
  }
  done();
  return n;
}
