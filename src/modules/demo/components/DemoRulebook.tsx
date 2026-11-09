"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { BookOpen, Sparkles } from "lucide-react";
import { Popup } from "@/components/Popup";

/** "Ouvrir" a rulebook in the demo: explains what members get (the PDF reader, the AI). */
export function DemoRulebook({ title, label }: { title: string; label: string }) {
  const t = useTranslations("demo.game");
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn btn-ghost btn-sm">
        <BookOpen className="size-3.5" /> {label}
      </button>
      <Popup open={open} onClose={() => setOpen(false)} title={title} icon={<BookOpen className="size-5" />} closeLabel={t("close")}>
        <p className="text-sm">{t("rulebookText")}</p>
        <div className="flex flex-wrap justify-end gap-2">
          <Link href="/demo/ai" className="btn btn-secondary btn-sm" onClick={() => setOpen(false)}>
            <Sparkles className="size-4" /> {t("askAi")}
          </Link>
          <button type="button" onClick={() => setOpen(false)} className="btn btn-primary btn-sm">
            {t("close")}
          </button>
        </div>
      </Popup>
    </>
  );
}
