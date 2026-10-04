"use client";

import { useRouter } from "next/navigation";
import { GamePicker } from "@/modules/games/components/GamePicker";

/** Picking a game in the AI assistant goes straight to choosing the rules source. */
export function AiGameSelect() {
  const router = useRouter();
  return <GamePicker allowCreate createHref={(name) => `/games/new?name=${encodeURIComponent(name)}&returnTo=ai`} onPick={(g) => g && router.push(`/ai?game=${g.id}`)} />;
}
