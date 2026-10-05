"use client";

import { Reorder, useDragControls } from "motion/react";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import { ModuleIcon } from "@/components/icons";
import type { NavItem } from "./MemberNav";

function Row({
  item,
  index,
  count,
  move,
  compact,
}: {
  item: NavItem;
  index: number;
  count: number;
  move: (from: number, to: number) => void;
  compact: boolean;
}) {
  const t = useTranslations("nav");
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={item}
      dragListener={false}
      dragControls={controls}
      whileDrag={{ scale: 1.03, boxShadow: "0 12px 30px -10px rgb(0 0 0 / 0.5)" }}
      className="flex items-center gap-2 rounded-2xl border border-dashed border-accent/50 bg-surface/90 py-1.5 pl-1.5 pr-1 text-sm font-semibold"
    >
      {/* drag handle: touch-none so dragging works on phones and inside scrolling areas */}
      <span
        onPointerDown={(e) => controls.start(e)}
        className="cursor-grab touch-none rounded-lg p-1 text-muted hover:bg-surface-2 active:cursor-grabbing"
        title={t("dragHandle")}
      >
        <GripVertical className="size-4" />
      </span>
      <ModuleIcon name={item.icon} className="size-5 shrink-0" />
      <span className={`min-w-0 flex-1 truncate ${compact ? "sidebar-label" : ""}`}>{item.label}</span>
      <span className={`flex shrink-0 ${compact ? "sidebar-label" : ""}`}>
        <button type="button" onClick={() => move(index, index - 1)} disabled={index === 0} className="rounded-lg p-1 text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-25" aria-label={t("moveUp", { item: item.label })}>
          <ChevronUp className="size-4" />
        </button>
        <button type="button" onClick={() => move(index, index + 1)} disabled={index === count - 1} className="rounded-lg p-1 text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-25" aria-label={t("moveDown", { item: item.label })}>
          <ChevronDown className="size-4" />
        </button>
      </span>
    </Reorder.Item>
  );
}

/** Reorderable list of menu items: drag by the handle, or use the arrows. */
export function MenuOrderEditor({ items, onChange, compact = false }: { items: NavItem[]; onChange: (items: NavItem[]) => void; compact?: boolean }) {
  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };
  return (
    <Reorder.Group axis="y" values={items} onReorder={onChange} layoutScroll className="flex flex-col gap-1 overflow-y-auto">
      {items.map((item, i) => (
        <Row key={item.href} item={item} index={i} count={items.length} move={move} compact={compact} />
      ))}
    </Reorder.Group>
  );
}
