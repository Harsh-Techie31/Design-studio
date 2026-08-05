import type { NodeDef } from "../types";
import { nodeStatusFromSummary, type NodeSummary } from "../types";

const STATUS_META: Record<string, { label: string; className: string }> = {
  empty: { label: "Empty", className: "bg-line-soft text-muted" },
  active: { label: "Active", className: "bg-accent/15 text-accent" },
  done: { label: "Done", className: "bg-accent text-ink" },
};

interface NodeCardProps {
  def: NodeDef;
  summary: NodeSummary | undefined;
  onOpen: () => void;
}

export function NodeCard({ def, summary, onOpen }: NodeCardProps) {
  const status = nodeStatusFromSummary(summary);
  const meta = STATUS_META[status];
  return (
    <button
      onClick={onOpen}
      className="group flex flex-col items-start gap-3 bg-surface p-5 text-left transition-all hover:bg-surface-hi"
    >
      <div className="flex w-full items-center justify-between">
        <span className="font-mono text-[11px] font-medium text-muted">
          {String(def.number).padStart(2, "0")}
        </span>
        <span
          className={`px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${meta.className}`}
        >
          {meta.label}
        </span>
      </div>
      <h3 className="font-display text-lg font-semibold tracking-tight text-bone transition-colors group-hover:text-accent">
        {def.label}
      </h3>
      <p className="text-xs leading-relaxed text-muted">{def.hint}</p>
    </button>
  );
}
