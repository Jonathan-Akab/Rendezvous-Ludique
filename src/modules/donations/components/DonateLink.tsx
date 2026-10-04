import { getTranslations } from "next-intl/server";
import { HeartHandshake } from "lucide-react";
import { getModule } from "@/lib/modules";

// Deliberately discreet: a small heart in the header and a one-line footer link.
// Hidden when the module is off or no donation URL is configured.

export async function DonateLink({ placement }: { placement: "header" | "footer" | "top" }) {
  const mod = await getModule("donations");
  const url = String(mod.settings.url ?? "");
  if (!mod.enabled || !url) return null;
  if ((placement === "header" || placement === "top") && !mod.settings.showInHeader) return null;
  if (placement === "footer" && !mod.settings.showInFooter) return null;
  const t = await getTranslations("donations");

  if (placement === "top") {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="hidden items-center gap-1.5 rounded-xl border border-line/70 px-3 py-1.5 text-xs font-semibold text-muted transition hover:border-accent hover:text-accent sm:inline-flex"
      >
        <HeartHandshake className="size-4" aria-hidden />
        {t("support")}
      </a>
    );
  }
  if (placement === "header") {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        title={t("support")}
        className="btn btn-ghost btn-sm text-muted hover:text-accent"
      >
        <HeartHandshake className="size-4" aria-hidden />
        <span className="sr-only">{t("support")}</span>
      </a>
    );
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-accent">
      <HeartHandshake className="size-3.5" aria-hidden />
      {t("footer")}
    </a>
  );
}
