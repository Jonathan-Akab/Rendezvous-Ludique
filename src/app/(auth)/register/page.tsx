import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getSiteSettings } from "@/lib/settings";
import { FadeIn } from "@/components/Motion";
import { RegisterForm } from "@/modules/auth/components/AuthForms";

export async function generateMetadata() {
  const t = await getTranslations("auth");
  return { title: t("createAccount") };
}

export default async function RegisterPage() {
  const [settings, t] = await Promise.all([getSiteSettings(), getTranslations("auth")]);
  return (
    <FadeIn className="card card-pad mx-auto w-full max-w-xl">
      <h1 className="page-title mb-1">{t("registerTitle")}</h1>
      <p className="mb-6 text-sm text-muted">{t("registerLead")}</p>
      {settings.registrationOpen ? (
        <RegisterForm />
      ) : (
        <p className="text-muted">
          {t("errors.registrationClosed")}{" "}
          <Link href="/" className="link">
            {t("signIn")}
          </Link>
        </p>
      )}
    </FadeIn>
  );
}
