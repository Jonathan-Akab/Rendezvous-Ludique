import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, ShieldHalf } from "lucide-react";
import { requireRole } from "@/lib/auth/guards";

// Placeholder for the moderator console (separate from the member site, like /admin).
export default async function ModerationPage() {
  await requireRole("MODERATOR");
  const t = await getTranslations("moderation");
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
      <span className="grid size-16 place-items-center rounded-2xl bg-accent text-accent-ink">
        <ShieldHalf className="size-8" />
      </span>
      <h1 className="page-title">{t("title")}</h1>
      <p className="text-muted">{t("comingSoon")}</p>
      <Link href="/home" className="btn btn-secondary">
        <ArrowLeft className="size-4" /> {t("back")}
      </Link>
    </main>
  );
}
