import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Meeple } from "@/components/Meeple";

export default async function NotFound() {
  const t = await getTranslations("notFound");
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex items-end gap-1" aria-hidden>
        <Meeple color="#c92a2a" size={48} className="-rotate-90" />
        <Meeple color="#1c5fbf" size={64} />
      </div>
      <h1 className="page-title">{t("title")}</h1>
      <p className="text-muted">{t("text")}</p>
      <Link href="/home" className="btn btn-primary">
        {t("back")}
      </Link>
    </main>
  );
}
