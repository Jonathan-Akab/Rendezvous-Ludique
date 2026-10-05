import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { FadeIn } from "@/components/Motion";
import { mailConfigured } from "@/lib/mail";
import { ForgotPasswordForm } from "@/modules/auth/components/AuthForms";

export async function generateMetadata() {
  return { title: (await getTranslations("auth"))("forgotTitle") };
}

export default async function ForgotPasswordPage() {
  const t = await getTranslations("auth");
  return (
    <FadeIn className="card card-pad mx-auto w-full max-w-md">
      <h1 className="page-title mb-1 text-3xl">{t("forgotTitle")}</h1>
      <p className="mb-6 text-sm text-muted">{mailConfigured() ? t("forgotLead") : t("errors.mailOff")}</p>
      {mailConfigured() && <ForgotPasswordForm />}
      <p className="mt-4 text-center text-sm text-muted">
        <Link href="/" className="link">
          {t("backToSignIn")}
        </Link>
      </p>
    </FadeIn>
  );
}
