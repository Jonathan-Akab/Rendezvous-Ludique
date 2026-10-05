"use client";

import { useRouter } from "next/navigation";
import { MyGameSelect, type MyGameOption } from "@/modules/kallax/components/MyGameSelect";

/** Picking a game from your Kallax goes straight to choosing the rules source. */
export function AiGameSelect({ games }: { games: MyGameOption[] }) {
  const router = useRouter();
  return <MyGameSelect games={games} onChange={(ids) => ids[0] && router.push(`/ai?game=${ids[0]}`)} />;
}
