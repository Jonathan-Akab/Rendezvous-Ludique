import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { FadeIn } from "@/components/Motion";
import { checkEmailToken } from "@/lib/auth/emailTokens";
import { ResetPasswordForm } from "@/modules/auth/components/AuthForms";

export async function generateMetadata() {
  return { title: (await getTranslations("auth"))("resetTitle") };
}

/** The link in the "reset your password" message. */
export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const [{ token = "" }, t] = await Promise.all([searchParams, getTranslations("auth")]);
  const valid = Boolean(await checkEmailToken(token, "reset"));
  return (
    <FadeIn className="card card-pad mx-auto w-full max-w-md">
      <h1 className="page-title mb-1 text-3xl">{t("resetTitle")}</h1>
      {valid ? (
        <>
          <p className="mb-6 text-sm text-muted">{t("resetLead")}</p>
          <ResetPasswordForm token={token} />
        </>
      ) : (
        <p className="text-sm text-muted">
          {t("errors.linkInvalid")}{" "}
          <Link href="/forgot-password" className="link">
            {t("forgotAgain")}
          </Link>
        </p>
      )}
    </FadeIn>
  );
}
