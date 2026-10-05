"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getTranslations } from "next-intl/server";
import { requirePermission, requireUser } from "@/lib/auth/guards";
import { audit } from "@/lib/audit";
import { oneOf, str, type ActionState } from "@/lib/forms";
import { FAQ_STATUSES } from "@/lib/constants";
import { getModule } from "@/lib/modules";
import { encryptSecret } from "@/lib/secrets";
import { checkAnthropicKey, OWN_MODELS, ownKeysAllowed } from "./ownKey";

export async function deleteChatAction(chatId: string) {
  const user = await requireUser();
  await db.aiChat.deleteMany({ where: { id: chatId, userId: user.id } });
  revalidatePath("/ai");
  redirect("/ai");
}

/** The member's own choice: the site's Claude (precise), the free option, or their own Claude credits. */
export async function setAiProviderAction(provider: "claude" | "free" | "own") {
  const user = await requireUser();
  const preferredProvider = provider === "free" || provider === "own" ? provider : "claude";
  await db.aiMemberSetting.upsert({
    where: { userId: user.id },
    create: { userId: user.id, preferredProvider },
    update: { preferredProvider },
  });
}

// ───────────── Rules FAQ (admin) ─────────────

const refreshFaq = () => {
  revalidatePath("/ai/faq", "layout");
  revalidatePath("/admin/faq");
};

export async function saveFaqAction(faqId: string | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requirePermission("faq");
  const t = await getTranslations("admin.faq");
  const question = str(fd, "question").slice(0, 500);
  const answer = str(fd, "answer").slice(0, 20000);
  if (question.length < 5 || answer.length < 2) return { error: t("required") };
  const status = oneOf(str(fd, "status"), FAQ_STATUSES, "VERIFIED");
  if (faqId) {
    const faq = await db.ruleFaq.update({ where: { id: faqId }, data: { question, answer, status } });
    await audit(me.id, "admin.faq.update", faq.question, { status });
  } else {
    const gameId = str(fd, "gameId");
    if (!(await db.game.findUnique({ where: { id: gameId }, select: { id: true } }))) return { error: t("pickGame") };
    await db.ruleFaq.create({ data: { gameId, question, answer, status, provider: "manual" } });
    await audit(me.id, "admin.faq.create", question);
  }
  refreshFaq();
  return { ok: true, message: t("saved") };
}

export async function deleteFaqAction(faqId: string) {
  const me = await requirePermission("faq");
  const faq = await db.ruleFaq.delete({ where: { id: faqId } });
  await audit(me.id, "admin.faq.delete", faq.question);
  refreshFaq();
}

// ───────────── Member's own Claude key ─────────────

/** Saves (after checking it with Anthropic) the member's own API key and model. */
export async function saveOwnKeyAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const t = await getTranslations("settings.ownKey");
  const mod = await getModule("ai");
  if (!ownKeysAllowed(mod)) return { error: t("notAllowed") };
  const apiKey = str(fd, "apiKey").replace(/\s+/g, "");
  const ownModel = oneOf(str(fd, "model"), OWN_MODELS, OWN_MODELS[0]);
  const existing = await db.aiMemberSetting.findUnique({ where: { userId: user.id }, select: { ownKeyEncrypted: true } });

  if (!apiKey) {
    // Only changing the model of an already saved key.
    if (!existing?.ownKeyEncrypted) return { error: t("missing") };
    await db.aiMemberSetting.update({ where: { userId: user.id }, data: { ownModel } });
    revalidatePath("/settings");
    return { ok: true, message: t("saved") };
  }
  if (!apiKey.startsWith("sk-ant-") || apiKey.length < 40) return { error: t("format") };
  const check = await checkAnthropicKey(apiKey);
  if (check === "invalid") return { error: t("invalid") };
  if (check === "unreachable") return { error: t("unreachable") };

  const data = { ownKeyEncrypted: encryptSecret(apiKey), ownKeyHint: apiKey.slice(-4), ownModel, preferredProvider: "own" };
  await db.aiMemberSetting.upsert({ where: { userId: user.id }, create: { userId: user.id, ...data }, update: data });
  await audit(user.id, "ai.ownKey.save", user.username);
  revalidatePath("/settings");
  revalidatePath("/ai");
  return { ok: true, message: t("saved") };
}

export async function removeOwnKeyAction() {
  const user = await requireUser();
  await db.aiMemberSetting.updateMany({
    where: { userId: user.id },
    data: { ownKeyEncrypted: null, ownKeyHint: null, preferredProvider: "claude" },
  });
  await audit(user.id, "ai.ownKey.remove", user.username);
  revalidatePath("/settings");
  revalidatePath("/ai");
}
