import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { hasRole, requireUser } from "@/lib/auth/guards";
import { can } from "@/lib/auth/permissions";
import { requireModule } from "@/lib/modules";
import { FadeIn } from "@/components/Motion";
import { getListing } from "@/modules/bazaar/service";
import { ListingForm } from "@/modules/bazaar/components/ListingForm";
import { updateListingAction } from "@/modules/bazaar/actions";

export default async function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, user, mod, t] = await Promise.all([params, requireUser(), requireModule("bazaar"), getTranslations("bazaar")]);
  const listing = await getListing(id);
  if (!listing || (listing.sellerId !== user.id && !can(user, "bazaar"))) notFound();
  return (
    <FadeIn className="mx-auto max-w-3xl space-y-6">
      <h1 className="page-title">{t("editTitle")}</h1>
      <div className="card card-pad">
        <ListingForm
          action={updateListingAction.bind(null, listing.id)}
          editing
          allowTrades={Boolean(mod.settings.allowTrades)}
          currency={String(mod.settings.currency) || "CAD"}
          maxPhotos={Number(mod.settings.maxPhotos)}
          values={listing}
          myGames={[]}
        />
      </div>
    </FadeIn>
  );
}
