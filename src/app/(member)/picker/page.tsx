import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth/guards";
import { getModule, requireModule } from "@/lib/modules";
import { FadeIn } from "@/components/Motion";
import { getFriends } from "@/modules/friends/service";
import { getPickerGames } from "@/modules/picker/service";
import { Picker } from "@/modules/picker/components/Picker";
import type { PickerPreset } from "@/modules/picker/components/GamePick";

function parsePresets(json: string | null): PickerPreset[] {
  try {
    const list = json ? JSON.parse(json) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export async function generateMetadata() {
  return { title: (await getTranslations("nav"))("picker") };
}

const TABS = ["game", "list", "first"] as const;

export default async function PickerPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const [user, , sp, t, plays] = await Promise.all([requireUser(), requireModule("picker"), searchParams, getTranslations("picker"), getModule("plays")]);
  const [games, friends] = await Promise.all([getPickerGames(user.id), getFriends(user.id)]);
  const tab = TABS.find((x) => x === sp.tab) ?? "game";
  return (
    <FadeIn className="space-y-6">
      <div>
        <h1 className="page-title">{t("title")}</h1>
        <p className="text-muted">{t("lead")}</p>
      </div>
      <Picker
        games={games}
        friends={friends.map((f) => ({ id: f.id, displayName: f.displayName }))}
        me={user.displayName}
        playsEnabled={plays.enabled}
        now={Date.now()}
        initialTab={tab}
        presets={parsePresets(user.pickerPresets)}
      />
    </FadeIn>
  );
}
