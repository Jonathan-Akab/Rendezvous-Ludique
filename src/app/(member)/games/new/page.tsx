import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth/guards";
import { requireModule } from "@/lib/modules";
import { FadeIn } from "@/components/Motion";
import { ActionForm } from "@/components/ActionForm";
import { GameFields } from "@/modules/games/components/GameFields";
import { createGameAction } from "@/modules/games/actions";

export default async function NewGamePage({ searchParams }: { searchParams: Promise<{ name?: string; returnTo?: string }> }) {
  const [, mod, { name, returnTo }, t] = await Promise.all([requireUser(), requireModule("games"), searchParams, getTranslations("games")]);
  return (
    <FadeIn className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="page-title">{t("add")}</h1>
        <p className="text-muted">{t("addLead")}</p>
      </div>
      <div className="card card-pad">
        <ActionForm action={createGameAction} submitLabel={t("create")}>
          {returnTo === "ai" && <input type="hidden" name="returnTo" value="ai" />}
          <GameFields values={{ name }} allowCover={Boolean(mod.settings.allowCoverUploads)} />
        </ActionForm>
      </div>
    </FadeIn>
  );
}
