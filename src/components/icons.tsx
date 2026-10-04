import {
  Boxes,
  Store,
  Users2,
  Sparkles,
  CalendarDays,
  Dices,
  Heart,
  House,
  LibraryBig,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";

// Icon names used by the module registry (which must stay serialisable).
const ICONS: Record<string, LucideIcon> = { Store, Facebook: Users2, Boxes, Sparkles, CalendarDays, Dices, Heart, House, LibraryBig, UserRound, Users };

export function ModuleIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? Dices;
  return <Icon className={className} aria-hidden />;
}
