import { Link } from "react-router-dom";
import type { Season } from "../types";
import { seedFromId } from "../types";
import { PlaceholderTile } from "./PlaceholderTile";

export function SeasonCard({ season, garmentCount }: { season: Season; garmentCount: number }) {
  const seed = seedFromId(season.id);
  return (
    <Link
      to={`/seasons/${season.id}`}
      className="group block overflow-hidden rounded-xl border border-line bg-surface transition-all hover:-translate-y-0.5 hover:border-brass/50"
    >
      <div className="grid grid-cols-4 gap-px">
        {[0, 1, 2, 3].map((i) => (
          <PlaceholderTile key={i} seed={seed} index={i} className="aspect-square" />
        ))}
      </div>
      <div className="p-5">
        <h3 className="font-display text-2xl text-bone transition-colors group-hover:text-brass">
          {season.code}
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
    </Link>
  );
}
