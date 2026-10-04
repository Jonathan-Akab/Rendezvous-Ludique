"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { hasRole, requireUser } from "@/lib/auth/guards";
import { getModule } from "@/lib/modules";
import { audit } from "@/lib/audit";
import { deleteStored, saveUpload, UploadError } from "@/lib/storage";
import { oneOf, optFloat, optStr, str, type ActionState } from "@/lib/forms";
import { createGameRecord, findGameByName } from "@/modules/games/mutations";
import { CONDITIONS, DELIVERY, LISTING_KINDS, LISTING_STATUSES } from "./service";

async function guard() {
  const user = await requireUser();
  const mod = await getModule("bazaar");
  if (!mod.enabled) throw new Error("Module disabled");
  return { user, mod };
}

const refresh = (id?: string) => {
  revalidatePath("/bazaar");
  if (id) revalidatePath(`/bazaar/${id}`);
};

async function resolveGame(fd: FormData, userId: string) {
  const id = str(fd, "gameId");
  if (id) return db.game.findUnique({ where: { id } });
  const name = str(fd, "game.name");
  if (!name) return null;
  return (await findGameByName(name)) ?? createGameRecord(fd, userId);
}

function readListing(fd: FormData, allowTrades: boolean) {
  const kind = oneOf(str(fd, "kind"), LISTING_KINDS, "SALE");
  const price = optFloat(fd, "price");
  return {
    description: optStr(fd, "description")?.slice(0, 3000) ?? null,
    price: price == null ? null : Math.max(0, Math.round(price * 100) / 100),
    kind: allowTrades ? kind : "SALE",
    condition: oneOf(str(fd, "condition"), CONDITIONS, "GOOD"),
    delivery: oneOf(str(fd, "delivery"), DELIVERY, "PICKUP"),
    city: optStr(fd, "city")?.slice(0, 80) ?? null,
    latitude: optFloat(fd, "latitude"),
    longitude: optFloat(fd, "longitude"),
  };
}

async function savePhotos(fd: FormData, listingId: string, userId: string, maxPhotos: number) {
  const current = await db.bazaarPhoto.count({ where: { listingId } });
  const files = fd.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  let order = current;
  for (const file of files.slice(0, Math.max(0, maxPhotos - current))) {
    const stored = await saveUpload(file, "IMAGE", userId);
    await db.bazaarPhoto.create({ data: { listingId, fileId: stored.id, sortOrder: order++ } });
  }
}

export async function createListingAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { user, mod } = await guard();
  const t = await getTranslations("bazaar.errors");
  let id: string;
  try {
    const game = await resolveGame(fd, user.id);
    if (!game) return { error: t("game") };
    const data = readListing(fd, Boolean(mod.settings.allowTrades));
    if ((data.kind === "SALE" || data.kind === "BOTH") && data.price == null) return { error: t("price") };
    const listing = await db.bazaarListing.create({
      data: { ...data, sellerId: user.id, gameId: game.id, title: str(fd, "title").slice(0, 120) || game.name },
    });
    id = listing.id;
    await savePhotos(fd, id, user.id, Number(mod.settings.maxPhotos));
  } catch (e) {
    if (e instanceof UploadError) return { error: (await getTranslations("games.errors"))(`upload.${e.code}`) };
    throw e;
  }
  refresh();
  redirect(`/bazaar/${id}`);
}

async function ownListing(id: string) {
  const { user, mod } = await guard();
  const listing = await db.bazaarListing.findUnique({ where: { id } });
  if (!listing) return null;
  const isAdmin = hasRole(user.role, "ADMIN");
  if (listing.sellerId !== user.id && !isAdmin) return null;
  return { user, mod, listing, viaAdmin: listing.sellerId !== user.id };
}

export async function updateListingAction(id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await ownListing(id);
  const t = await getTranslations("bazaar.errors");
  if (!ctx) return { error: t("forbidden") };
  const data = readListing(fd, Boolean(ctx.mod.settings.allowTrades));
  if ((data.kind === "SALE" || data.kind === "BOTH") && data.price == null) return { error: t("price") };
  try {
    for (const photoId of fd.getAll("removePhoto").map(String)) {
      const photo = await db.bazaarPhoto.findFirst({ where: { id: photoId, listingId: id } });
      if (photo) await deleteStored(photo.fileId);
    }
    await db.bazaarListing.update({ where: { id }, data: { ...data, title: str(fd, "title").slice(0, 120) || ctx.listing.title } });
    await savePhotos(fd, id, ctx.listing.sellerId, Number(ctx.mod.settings.maxPhotos));
  } catch (e) {
    if (e instanceof UploadError) return { error: (await getTranslations("games.errors"))(`upload.${e.code}`) };
    throw e;
  }
  if (ctx.viaAdmin) await audit(ctx.user.id, "bazaar.update", id);
  refresh(id);
  redirect(`/bazaar/${id}`);
}

export async function setListingStatusAction(id: string, status: string) {
  const ctx = await ownListing(id);
  if (!ctx) return;
  await db.bazaarListing.update({ where: { id }, data: { status: oneOf(status, LISTING_STATUSES, "ACTIVE") } });
  if (ctx.viaAdmin) await audit(ctx.user.id, "bazaar.status", id, { status });
  refresh(id);
}

export async function deleteListingAction(id: string) {
  const ctx = await ownListing(id);
  if (!ctx) return;
  const photos = await db.bazaarPhoto.findMany({ where: { listingId: id } });
  for (const p of photos) await deleteStored(p.fileId);
  await db.bazaarListing.delete({ where: { id } });
  if (ctx.viaAdmin) await audit(ctx.user.id, "bazaar.delete", ctx.listing.title);
  refresh();
  redirect(ctx.viaAdmin ? "/admin/bazaar" : "/bazaar");
}

/** A message in the private conversation between the seller and one interested member. */
export async function sendBazaarMessageAction(listingId: string, buyerId: string | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const { user } = await guard();
  const t = await getTranslations("bazaar.errors");
  const body = str(fd, "body").slice(0, 2000);
  if (!body) return { error: t("message") };
  const listing = await db.bazaarListing.findUnique({ where: { id: listingId } });
  if (!listing) return { error: t("forbidden") };
  const isSeller = listing.sellerId === user.id;
  const thread = isSeller ? buyerId : user.id;
  if (!thread || (isSeller && thread === user.id)) return { error: t("forbidden") };
  if (isSeller && !(await db.bazaarMessage.findFirst({ where: { listingId, buyerId: thread } }))) return { error: t("forbidden") };
  await db.bazaarMessage.create({ data: { listingId, buyerId: thread, senderId: user.id, body } });
  refresh(listingId);
  return { ok: true };
}
