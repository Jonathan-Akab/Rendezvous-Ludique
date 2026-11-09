import { getTranslations } from "next-intl/server";
import { getSiteSettings } from "@/lib/settings";
import { DemoShell } from "@/modules/demo/components/DemoShell";
import { DemoTour } from "@/modules/demo/components/DemoTour";
import { DemoAsk } from "@/modules/demo/components/DemoAsk";

// The public demo: the site's real screens with made-up content, no account needed.

export async function generateMetadata() {
  const t = await getTranslations("demo");
  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function DemoLayout({ children }: { children: React.ReactNode }) {
  const { siteName } = await getSiteSettings();
  return (
    <DemoShell siteName={siteName}>
      {children}
      <DemoTour />
      <DemoAsk />
    </DemoShell>
  );
}
