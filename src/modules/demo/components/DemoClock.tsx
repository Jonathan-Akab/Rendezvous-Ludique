"use client";

import { useState } from "react";
import { PlayTimer } from "@/modules/plays/components/PlayTimer";
import type { DraftClock } from "@/modules/plays/draft";

/** The real game clock, kept in the page only (nothing is saved in the demo). */
export function DemoClock() {
  const [clock, setClock] = useState<DraftClock>({ startedAt: null, savedMs: 0 });
  return <PlayTimer clock={clock} onChange={setClock} />;
}
