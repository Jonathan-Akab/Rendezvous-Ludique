import { Meeple } from "./Meeple";

export function EmptyState({ title, text, children }: { title: string; text?: string; children?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
      <div className="flex -space-x-2" aria-hidden>
        <Meeple color="#c92a2a" size={36} className="-rotate-12" />
        <Meeple color="#f2b705" size={42} />
        <Meeple color="#1c5fbf" size={36} className="rotate-12" />
      </div>
      <p className="section-title">{title}</p>
      {text && <p className="max-w-md text-sm text-muted">{text}</p>}
      {children}
    </div>
  );
}
