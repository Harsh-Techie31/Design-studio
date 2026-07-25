import type { NodeDef } from "../types";
import { nodeStatusFromSummary, type NodeSummary } from "../types";

const STATUS_META: Record<string, { label: string; className: string }> = {
  empty: { label: "Not started", className: "bg-line-soft text-muted" },
  active: { label: "In progress", className: "bg-brass/15 text-brass" },
  done: { label: "Done", className: "bg-brass text-ink" },
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
      className="group flex flex-col items-start gap-3 rounded-xl border border-line bg-surface p-5 text-left transition-all hover:-translate-y-0.5 hover:border-brass/50 hover:bg-surface-hi"
    >
      <div className="flex w-full items-center justify-between">
        <span className="font-display text-sm text-muted">
          {String(def.number).padStart(2, "0")}
        </span>
        <span
          className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${meta.className}`}
        >
          {meta.label}
        </span>
      </div>
      <h3 className="font-display text-2xl text-bone transition-colors group-hover:text-brass">
        {def.label}
      </h3>
      <p className="text-sm text-muted">{def.hint}</p>
    </button>
  );
}
