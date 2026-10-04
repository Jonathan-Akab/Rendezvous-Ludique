import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth/guards";
import { requireModule } from "@/lib/modules";
import { FadeIn } from "@/components/Motion";
import { EventForm } from "@/modules/events/components/EventForm";
import { createEventAction } from "@/modules/events/actions";

export async function generateMetadata() {
  return { title: (await getTranslations("events"))("announce") };
}

export default async function NewEventPage() {
  const [user, mod, t] = await Promise.all([requireUser(), requireModule("events"), getTranslations("events")]);
  return (
    <FadeIn className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="page-title">{t("newTitle")}</h1>
        <p className="text-muted">{t("newLead")}</p>
      </div>
      <div className="card card-pad">
        <EventForm
          action={createEventAction}
          allowHomeGames={Boolean(mod.settings.allowHomeGames)}
          allowPublic={Boolean(mod.settings.allowPublicEvents)}
          values={{ city: user.city, latitude: user.latitude, longitude: user.longitude }}
          submitLabel={t("publish")}
        />
      </div>
    </FadeIn>
  );
}
