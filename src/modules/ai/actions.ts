"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";

export async function deleteChatAction(chatId: string) {
  const user = await requireUser();
  await db.aiChat.deleteMany({ where: { id: chatId, userId: user.id } });
  revalidatePath("/ai");
  redirect("/ai");
}

/** The member's own choice between Claude (precise) and the free option. */
export async function setAiProviderAction(provider: "claude" | "free") {
  const user = await requireUser();
  const preferredProvider = provider === "free" ? "free" : "claude";
  await db.aiMemberSetting.upsert({
    where: { userId: user.id },
    create: { userId: user.id, preferredProvider },
    update: { preferredProvider },
  });
}
