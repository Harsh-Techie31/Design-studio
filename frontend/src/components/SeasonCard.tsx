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
      className="group relative block overflow-hidden rounded-xl border border-line bg-surface transition-all hover:-translate-y-0.5 hover:border-brass/50"
    >
      <div className="grid grid-cols-4 gap-px">
        {[0, 1, 2, 3].map((i) => (
          <PlaceholderTile key={i} seed={seed} index={i} className="aspect-square" />
        ))}
      </div>
      <div className="p-5">
        <h3 className="font-display text-2xl text-bone transition-colors group-hover:text-brass">
          {season.code ?? "Untitled"}
        </h3>
        {season.moodboard.name && (
          <p className="text-xs text-brass">Moodboard - {season.moodboard.name}</p>
        )}
        <p className="mt-1 text-sm text-muted">
          {garmentCount} garment{garmentCount === 1 ? "" : "s"} · {season.created_at.slice(0, 10)}
        </p>
        <div className="mt-4 flex gap-1.5">
          {season.moodboard.analysis.palette.map((c, i) => (
            <span
              key={i}
              className="h-3 w-3 rounded-full border border-white/10"
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>
      {onDelete && (
        <button
          onClick={handleDelete}
          className="absolute bottom-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-lg bg-ink/80 text-muted transition-all hover:bg-red-500/20 hover:text-red-400"
          title="Delete season"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
