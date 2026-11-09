import { getTranslations } from "next-intl/server";
import { EventForm } from "@/modules/events/components/EventForm";
import { demoEventAction } from "@/modules/demo/actions";
import { demoMyGames } from "@/modules/demo/data";

export default async function DemoNewEvent() {
  const [t, te] = await Promise.all([getTranslations("demo"), getTranslations("events")]);
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="page-title">{t("quick.announce")}</h1>
        <p className="text-muted">{t("announce.lead")}</p>
      </div>
      <div data-guide="demo-event-form" className="card card-pad">
        <EventForm
          action={demoEventAction}
          allowPublic
          submitLabel={te("publish")}
          myGames={demoMyGames()}
          friends={[
            { id: "demo-marie", displayName: "Marie", meepleColor: "#c92a2a" },
            { id: "demo-sam", displayName: "Sam", meepleColor: "#1c5fbf" },
            { id: "demo-julie", displayName: "Julie", meepleColor: "#f2b705" },
          ]}
        />
      </div>
    </div>
  );
}
