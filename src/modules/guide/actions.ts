"use server";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";

/** The member closed or finished the guide; `showNext`: show it again at the next sign-in. */
export async function finishGuideAction(showNext: boolean) {
  const user = await requireUser();
  await db.user.update({
    where: { id: user.id },
    data: { guideSeenAt: new Date(), guideShowNext: Boolean(showNext), guidePending: false },
  });
}
