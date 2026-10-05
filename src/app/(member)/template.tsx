"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BoardGameTransition } from "@/components/transitions/BoardGameTransition";

// Re-mounted on every navigation. Moving to another module plays a board-game transition
// picked at random (tiles, cards or die); moving inside a module just fades.
let lastModule: string | null = null;

export default function MemberTemplate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const mod = pathname.split("/")[1] ?? "";
  // decided once per page; remembered after rendering (safe when React renders twice in dev)
  const [play] = useState(() => mod !== lastModule);
  useEffect(() => {
    lastModule = mod;
  }, [mod]);
  return (
    <BoardGameTransition play={play}>
      {children}
    </BoardGameTransition>
  );
}
