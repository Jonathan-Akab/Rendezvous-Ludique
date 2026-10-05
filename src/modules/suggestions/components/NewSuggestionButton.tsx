"use client";

import { Lightbulb } from "lucide-react";
import { openSuggestionBox } from "./SuggestionDialog";

export function NewSuggestionButton({ label, className = "btn btn-primary" }: { label: string; className?: string }) {
  return (
    <button type="button" className={className} onClick={openSuggestionBox}>
      <Lightbulb className="size-4" /> {label}
    </button>
  );
}
