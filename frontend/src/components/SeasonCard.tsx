import { Link } from "react-router-dom";
import type { Season } from "../types";
import { seedFromId } from "../types";
import { PlaceholderTile } from "./PlaceholderTile";

export function SeasonCard({
  season,
  garmentCount,
  onDelete,
}: {
  season: Season;
  garmentCount: number;
  onDelete?: (seasonId: string) => void;
}) {
  const seed = seedFromId(season.id);

  function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    onDelete?.(season.id);
  }

  return (
    <Link
      to={`/seasons/${season.id}`}
      className="group relative block overflow-hidden border border-line bg-surface transition-all hover:border-vermillion/40 hover:bg-surface-hi"
    >
      <div className="grid grid-cols-4 gap-px">
        {[0, 1, 2, 3].map((i) => (
          <PlaceholderTile key={i} seed={seed} index={i} className="aspect-square" />
        ))}
      </div>
      <div className="p-5">
        <div className="flex items-start justify-between">
          <h3 className="font-display text-xl font-semibold tracking-tight text-bone transition-colors group-hover:text-vermillion">
            {season.code ?? "Untitled"}
          </h3>
          <span className="font-mono text-[10px] text-muted">
            {garmentCount}g
          </span>
        </div>
        {season.moodboard.name && (
          <p className="mt-1 font-mono text-[11px] text-muted">{season.moodboard.name}</p>
        )}
        <div className="mt-3 flex gap-1">
          {season.moodboard.analysis.palette.map((c, i) => (
            <span
              key={i}
              className="h-2 w-2"
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>
      {onDelete && (
        <button
          onClick={handleDelete}
          className="absolute bottom-3 right-3 z-10 flex h-7 w-7 items-center justify-center bg-ink/80 text-muted transition-all hover:bg-vermillion/20 hover:text-vermillion"
          title="Delete season"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18" />
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            <line x1="10" x2="10" y1="11" y2="17" />
            <line x1="14" x2="14" y1="11" y2="17" />
          </svg>
        </button>
      )}
    </Link>
  );
}
