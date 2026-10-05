import { getTranslations } from "next-intl/server";
import { CalendarDays, Dices, LibraryBig, Users } from "lucide-react";
import { getSiteSettings } from "@/lib/settings";
import { FadeIn } from "@/components/Motion";
import { Meeple } from "@/components/Meeple";
import { LoginForm } from "@/modules/auth/components/AuthForms";
import { mailConfigured } from "@/lib/mail";

export default async function LandingPage({ searchParams }: { searchParams: Promise<{ next?: string; pending?: string; verify?: string; verified?: string; reset?: string }> }) {
  const [{ next, pending, verify, verified, reset }, settings, t, ta] = await Promise.all([searchParams, getSiteSettings(), getTranslations("landing"), getTranslations("auth")]);
  const features = [
    { icon: CalendarDays, title: t("f1Title"), text: t("f1Text") },
    { icon: LibraryBig, title: t("f2Title"), text: t("f2Text") },
    { icon: Dices, title: t("f3Title"), text: t("f3Text") },
    { icon: Users, title: t("f4Title"), text: t("f4Text") },
  ];

  return (
    <div className="grid w-full items-center gap-10 lg:grid-cols-[1.15fr_1fr]">
      <FadeIn className="space-y-6">
        <div className="flex items-center gap-3">
          <Meeple color="var(--accent)" size={48} />
          <span className="chip">{t("badge")}</span>
        </div>
        <h1 className="font-display text-5xl font-black leading-[1.05] tracking-tight sm:text-6xl">
          {settings.siteName.split(" ").map((w, i) => (
            <span key={i} className={i === 1 ? "block text-accent" : "block"}>
              {w}
            </span>
          ))}
        </h1>
        <p className="max-w-md text-lg text-muted">{t("tagline")}</p>
        <ul className="grid max-w-lg gap-3 sm:grid-cols-2">
          {features.map((f, i) => (
            <FadeIn key={f.title} delay={0.25 + i * 0.08} className="card flex gap-3 p-3">
              <f.icon className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
              <div>
                <p className="text-sm font-bold">{f.title}</p>
                <p className="text-xs text-muted">{f.text}</p>
              </div>
            </FadeIn>
          ))}
        </ul>
      </FadeIn>

      <FadeIn delay={0.15} className="card card-pad relative mx-auto w-full max-w-md backdrop-blur">
        <div className="absolute -top-5 left-6 flex gap-1" aria-hidden>
          {["#c92a2a", "#1c5fbf", "#f2b705", "#2b8a3e"].map((c) => (
            <Meeple key={c} color={c} size={28} />
          ))}
        </div>
        <h2 className="section-title mb-1 mt-2">{t("welcomeBack")}</h2>
        <p className="mb-5 text-sm text-muted">{t("signInLead")}</p>
        {verify === "invalid" ? (
          <p className="mb-4 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{ta("errors.linkInvalid")}</p>
        ) : verify ? (
          <p className="mb-4 rounded-xl bg-success/10 px-3 py-2 text-sm text-success">{ta("checkEmail")}</p>
        ) : null}
        {verified && <p className="mb-4 rounded-xl bg-success/10 px-3 py-2 text-sm text-success">{ta("emailConfirmed")}</p>}
        {reset && <p className="mb-4 rounded-xl bg-success/10 px-3 py-2 text-sm text-success">{ta("passwordChanged")}</p>}
        {pending && <p className="mb-4 rounded-xl bg-success/10 px-3 py-2 text-sm text-success">{ta("pendingSignup")}</p>}
        <LoginForm next={next} registrationOpen={settings.registrationOpen} mailOn={mailConfigured()} />
      </FadeIn>
    </div>
  );
}
