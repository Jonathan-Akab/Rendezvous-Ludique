"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { KeyRound } from "lucide-react";
import { FormMessage, SubmitButton } from "@/components/forms";
import { saveOwnKeyAction } from "../actions";

const MODELS = ["claude-sonnet-5-5", "claude-opus-5-5", "claude-haiku-4-5"] as const;

/** "Use my Claude credits": the member's own Anthropic API key and model. */
export function OwnKeyForm({ hint, model }: { hint: string | null; model: string | null }) {
  const t = useTranslations("settings.ownKey");
  const [state, action] = useActionState(saveOwnKeyAction, undefined);
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
        <div>
          <label className="label" htmlFor="own-key">
            {t("keyLabel")}
          </label>
          <div className="relative">
            <KeyRound className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <input
              id="own-key"
              name="apiKey"
              type="password"
              autoComplete="off"
              spellCheck={false}
              className="input pl-9 font-mono text-xs"
              placeholder={hint ? t("keepKey", { hint }) : "sk-ant-…"}
              required={!hint}
            />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="own-model">
            {t("model")}
          </label>
          <select id="own-model" name="model" className="select" defaultValue={model ?? MODELS[0]}>
            {MODELS.map((m) => (
              <option key={m} value={m}>
                {t(`models.${m}`)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingLabel={t("checking")}>{hint ? t("update") : t("save")}</SubmitButton>
    </form>
  );
}
