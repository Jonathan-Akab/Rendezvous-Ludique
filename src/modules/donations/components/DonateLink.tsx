import { getTranslations } from "next-intl/server";
import { getModule } from "@/lib/modules";
import { DonateDialog, DonateTrigger } from "./DonatePopup";

// Deliberately discreet: a small link in the top bar and a one-line footer link, both opening
// the "Soutenir le projet" popup. Hidden when the module is off.

export async function DonateLink({ placement }: { placement: "footer" | "top" }) {
  const mod = await getModule("donations");
  if (!mod.enabled) return null;
  if (placement === "top" && mod.settings.showInHeader === false) return null;
  if (placement === "footer" && mod.settings.showInFooter === false) return null;
  const t = await getTranslations("donations");
  return <DonateTrigger placement={placement} label={placement === "top" ? t("support") : t("footer")} />;
}

/** The popup itself, mounted once in the member layout (null when the module is off). */
export async function DonatePopupHost() {
  const mod = await getModule("donations");
  if (!mod.enabled) return null;
  return <DonateDialog url={String(mod.settings.url ?? "")} transferEmail={String(mod.settings.transferEmail ?? "").trim()} />;
}
