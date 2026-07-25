import { Link } from "react-router-dom";
import type { Garment } from "../types";
import { PlaceholderTile } from "./PlaceholderTile";
import { NODE_DEFS } from "../data/mockData";

export function GarmentCard({ garment }: { garment: Garment }) {
  const doneCount = NODE_DEFS.filter((d) => garment.nodeStatus[d.key] === "done").length;
  return (
    <Link
      to={`/seasons/${garment.seasonId}/garments/${garment.id}`}
      className="group block overflow-hidden rounded-xl border border-line bg-surface transition-all hover:-translate-y-0.5 hover:border-brass/50"
    >
      <PlaceholderTile seed={garment.seed} className="aspect-[4/3]" />
      <div className="p-4">
        <h3 className="font-display text-xl text-bone transition-colors group-hover:text-brass">
          {garment.name}
        </h3>
        <div className="mt-3 flex items-center gap-2">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-line-soft">
            <div
              className="h-full rounded-full bg-brass"
              style={{ width: `${(doneCount / NODE_DEFS.length) * 100}%` }}
            />
          </div>
          <span className="whitespace-nowrap text-xs text-muted">
            {doneCount}/{NODE_DEFS.length} nodes
          </span>
        </div>
      </div>
    </Link>
  );
}
