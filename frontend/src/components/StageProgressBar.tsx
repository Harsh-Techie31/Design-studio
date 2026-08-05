import { useNavigate } from "react-router-dom";
import type { NodeKey } from "../types";
import { NODE_DEFS } from "../data/mockData";

interface StageProgressBarProps {
  seasonId: string;
  garmentId: string;
  currentStage: NodeKey;
  garmentSummary?: Record<string, { run_count: number; liked_count: number }>;
}

export function StageProgressBar({
  seasonId,
  garmentId,
  currentStage,
  garmentSummary,
}: StageProgressBarProps) {
  const navigate = useNavigate();

  return (
    <nav className="border-b border-line bg-surface px-8 py-3">
      <div className="mx-auto flex items-center gap-1 overflow-x-auto">
        {NODE_DEFS.map((def, i) => {
          const isActive = def.key === currentStage;
          const summary = garmentSummary?.[def.key];
          const isDone = summary && summary.liked_count > 0;
          const isStarted = summary && summary.run_count > 0;

          return (
            <div key={def.key} className="flex items-center">
              <button
                onClick={() =>
                  navigate(`/seasons/${seasonId}/garments/${garmentId}/stage/${def.key}`)
                }
                className={`flex items-center gap-2 px-3 py-2 text-xs font-medium transition-all ${
                  isActive
                    ? "bg-accent/15 text-accent"
                    : isDone
                    ? "text-bone hover:bg-ink-soft"
                    : isStarted
                    ? "text-bone-dim hover:bg-ink-soft"
                    : "text-muted hover:bg-ink-soft"
                }`}
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center text-[10px] font-bold font-mono ${
                    isActive
                      ? "bg-accent text-ink"
                      : isDone
                      ? "bg-accent/30 text-accent"
                      : isStarted
                      ? "bg-line text-bone-dim"
                      : "bg-ink-soft text-muted"
                  }`}
                >
                  {isDone ? (
                    <i className="ti ti-check text-[10px]" />
                  ) : (
                    def.number
                  )}
                </span>
                <span className="hidden sm:inline">{def.label}</span>
              </button>

              {i < NODE_DEFS.length - 1 && (
                <div className="mx-1 h-px w-3 bg-line sm:w-6" />
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
