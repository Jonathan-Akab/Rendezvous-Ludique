import { getTranslations } from "next-intl/server";
import { Picker } from "@/modules/picker/components/Picker";
import { classifyGame } from "@/modules/picker/gameTypes";
import { DEMO_ME, demoPickerGamesTyped } from "@/modules/demo/data";

export default async function DemoPicker() {
  const t = await getTranslations("picker");
  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">{t("title")}</h1>
        <p className="text-muted">{t("lead")}</p>
      </div>
      <div data-guide="demo-picker">
        <Picker
          games={demoPickerGamesTyped(classifyGame)}
          friends={[
            { id: "demo-marie", displayName: "Marie" },
            { id: "demo-sam", displayName: "Sam" },
          ]}
          me={DEMO_ME.displayName}
          playsEnabled
          now={Date.now()}
          initialTab="game"
          presets={[]}
          demo
        />
      </div>
    </div>
  );
}
