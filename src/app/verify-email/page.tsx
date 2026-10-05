import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { MailCheck } from "lucide-react";
import { db } from "@/lib/db";
import { checkEmailToken, emailTokenOwner } from "@/lib/auth/emailTokens";
import { confirmEmailAction } from "@/modules/auth/actions";
import { SubmitButton } from "@/components/forms";

export async function generateMetadata() {
  return { title: (await getTranslations("auth"))("confirmEmail.title") };
}

/**
 * The link in the "confirm your email" message. Opening it changes nothing: the member
 * confirms with the button (antispam filters open links to scan them, they never click).
 */
export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const [{ token = "" }, t] = await Promise.all([searchParams, getTranslations("auth")]);
  const valid = Boolean(await checkEmailToken(token, "verify"));
  const owner = valid ? null : await emailTokenOwner(token, "verify");
  const alreadyDone = owner ? Boolean((await db.user.findUnique({ where: { id: owner }, select: { emailVerifiedAt: true } }))?.emailVerifiedAt) : false;

  return (
    <main className="grain grid min-h-dvh place-items-center p-4">
      <div className="card card-pad w-full max-w-md space-y-4 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-accent/15 text-accent">
          <MailCheck className="size-7" />
        </span>
        <h1 className="page-title text-3xl">{t("confirmEmail.title")}</h1>
        {valid ? (
          <>
            <p className="text-sm text-muted">{t("confirmEmail.lead")}</p>
            <form action={confirmEmailAction.bind(null, token)}>
              <SubmitButton className="btn btn-primary w-full py-3">{t("confirmEmail.button")}</SubmitButton>
            </form>
          </>
        ) : alreadyDone ? (
          <>
            <p className="text-sm text-muted">{t("confirmEmail.already")}</p>
            <Link href="/" className="btn btn-primary w-full py-3">
              {t("confirmEmail.signIn")}
            </Link>
          </>
        ) : (
          <>
            <p className="text-sm text-muted">{t("confirmEmail.invalid")}</p>
            <Link href="/" className="btn btn-secondary w-full py-3">
              {t("confirmEmail.signIn")}
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
