import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, BookOpen } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { RulebookReader } from "@/modules/games/components/RulebookReader";

export async function generateMetadata({ params }: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await params;
  const rb = await db.rulebook.findUnique({ where: { fileId }, select: { title: true } });
  return { title: rb?.title ?? "PDF" };
}

/** Reads a rulebook inside the site, opened on ?page=N (links from the AI's page citations). */
export default async function RulebookPage({ params, searchParams }: { params: Promise<{ fileId: string }>; searchParams: Promise<{ page?: string; from?: string }> }) {
  const [, { fileId }, sp, t] = await Promise.all([requireUser(), params, searchParams, getTranslations("games.reader")]);
  const rb = await db.rulebook.findUnique({ where: { fileId }, include: { game: { select: { id: true, name: true } } } });
  if (!rb) notFound();
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const back = sp.from === "faq" ? `/ai/faq/${rb.game.id}` : `/ai?game=${rb.game.id}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link href={back} className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
          <ArrowLeft className="size-4" /> {t("back")}
        </Link>
        <h1 className="flex min-w-0 flex-1 items-center gap-2 font-display text-xl font-bold">
          <BookOpen className="size-5 shrink-0 text-accent" />
          <span className="truncate">
            {rb.game.name} — {rb.title}
          </span>
        </h1>
      </div>
      <RulebookReader fileId={fileId} initialPage={page} />
    </div>
  );
}
