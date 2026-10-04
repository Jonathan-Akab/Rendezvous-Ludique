import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Plus, Search } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { requireModule } from "@/lib/modules";
import { NearMeButton } from "@/components/LocationFields";
import { Stagger, StaggerItem } from "@/components/Motion";
import { EmptyState } from "@/components/EmptyState";
import { listListings } from "@/modules/bazaar/service";
import { ListingCard } from "@/modules/bazaar/components/ListingCard";

export async function generateMetadata() {
  return { title: (await getTranslations("nav"))("bazaar") };
}

type Search = { q?: string; kind?: string; max?: string; city?: string; tab?: string; lat?: string; lng?: string; radius?: string };

export default async function BazaarPage({ searchParams }: { searchParams: Promise<Search> }) {
  const [user, mod, sp, t, locale] = await Promise.all([requireUser(), requireModule("bazaar"), searchParams, getTranslations("bazaar"), getLocale()]);
  const mine = sp.tab === "mine";
  const nearActive = Boolean(sp.lat && sp.lng);
  const listings = await listListings({
    q: sp.q?.trim() || undefined,
    kind: sp.kind,
    maxPrice: sp.max ? Number(sp.max) : undefined,
    city: sp.city?.trim() || undefined,
    sellerId: mine ? user.id : undefined,
    includeSold: mine,
    near: nearActive ? { lat: Number(sp.lat), lng: Number(sp.lng), radiusKm: Number(sp.radius) || 50 } : undefined,
  });
  const currency = String(mod.settings.currency) || "CAD";
  const tab = (active: boolean) => `rounded-xl px-4 py-2 text-sm font-semibold transition ${active ? "bg-accent text-accent-ink" : "text-muted hover:text-ink"}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">{t("title")}</h1>
          <p className="text-muted">{t("lead")}</p>
        </div>
        <Link href="/bazaar/new" className="btn btn-primary">
          <Plus className="size-4" /> {t("sell")}
        </Link>
      </div>

      <div className="glass flex w-fit gap-1 rounded-2xl p-1">
        <Link href="/bazaar" className={tab(!mine)}>
          {t("tabs.all")}
        </Link>
        <Link href="/bazaar?tab=mine" className={tab(mine)}>
          {t("tabs.mine")}
        </Link>
      </div>

      <form className="glass flex flex-wrap items-end gap-3 rounded-2xl p-4" role="search">
        {mine && <input type="hidden" name="tab" value="mine" />}
        {nearActive && (
          <>
            <input type="hidden" name="lat" value={sp.lat} />
            <input type="hidden" name="lng" value={sp.lng} />
          </>
        )}
        <div className="min-w-52 flex-1">
          <label className="label" htmlFor="q">
            {t("filters.search")}
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <input id="q" name="q" defaultValue={sp.q} className="input pl-9" placeholder={t("filters.searchPlaceholder")} />
          </div>
        </div>
        {mod.settings.allowTrades && (
          <div>
            <label className="label" htmlFor="kind">
              {t("filters.kind")}
            </label>
            <select id="kind" name="kind" defaultValue={sp.kind ?? ""} className="select">
              <option value="">{t("filters.all")}</option>
              <option value="SALE">{t("filters.forSale")}</option>
              <option value="TRADE">{t("filters.forTrade")}</option>
            </select>
          </div>
        )}
        <div className="w-32">
          <label className="label" htmlFor="max">
            {t("filters.maxPrice")}
          </label>
          <input id="max" name="max" type="number" min={0} defaultValue={sp.max} className="input" />
        </div>
        <div className="w-36">
          <label className="label" htmlFor="city">
            {t("filters.city")}
          </label>
          <input id="city" name="city" defaultValue={sp.city} className="input" />
        </div>
        <button className="btn btn-secondary">{t("filters.apply")}</button>
        <NearMeButton active={nearActive} />
      </form>

      {listings.length === 0 ? (
        <EmptyState title={mine ? t("empty.mine") : t("empty.all")}>
          <Link href="/bazaar/new" className="btn btn-primary">
            <Plus className="size-4" /> {t("sell")}
          </Link>
        </EmptyState>
      ) : (
        <Stagger className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4" step={0.03}>
          {listings.map((l) => (
            <StaggerItem key={l.id}>
              <ListingCard listing={l} currency={currency} locale={locale} />
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </div>
  );
}
