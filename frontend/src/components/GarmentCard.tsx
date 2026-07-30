import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Garment } from "../types";
import { seedFromId } from "../types";
import { PlaceholderTile } from "./PlaceholderTile";
import { NODE_DEFS } from "../data/mockData";
import { listImagesForGarment } from "../api/designImages";

const IMAGE_PRIORITY: { nodeKey: string; imageType: string }[] = [
  { nodeKey: "photoshoot", imageType: "photo" },
  { nodeKey: "render", imageType: "render" },
  { nodeKey: "sketch", imageType: "sketch" },
];

export function GarmentCard({ garment }: { garment: Garment }) {
  const seed = seedFromId(garment.id);
  const [bestImage, setBestImage] = useState<string | null>(null);

  // Count how many stages have been used (run_count > 0)
  const usedCount = NODE_DEFS.filter((d) => {
    const summary = garment.node_summary?.[d.key];
    return summary && summary.run_count > 0;
  }).length;

  useEffect(() => {
    let cancelled = false;

    const fetchBestImage = async () => {
      try {
        const allImages = await listImagesForGarment(garment.id);
        if (cancelled || allImages.length === 0) return;

        // Priority: photoshoot > render > sketch, pick most recent of each type
        for (const priority of IMAGE_PRIORITY) {
          const match = allImages.find((img) => img.node_key === priority.nodeKey);
          if (match?.url) {
            setBestImage(match.url);
            return;
          }
        }
      } catch {
        // silently fall back to placeholder
      }
    };

    fetchBestImage();
    return () => { cancelled = true; };
  }, [garment.id]);

  return (
    <Link
      to={`/seasons/${garment.season_id}/garments/${garment.id}`}
      className="group block overflow-hidden rounded-xl border border-line bg-surface transition-all hover:-translate-y-0.5 hover:border-brass/50"
    >
      {/* Thumbnail: real image or placeholder gradient */}
      {bestImage ? (
        <div className="aspect-[4/3] w-full overflow-hidden bg-ink-soft">
          <img
            src={bestImage}
            alt={garment.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </div>
      ) : (
        <PlaceholderTile seed={seed} className="aspect-[4/3]" />
      )}

      <div className="p-4">
        <h3 className="font-display text-xl text-bone transition-colors group-hover:text-brass">
          {garment.name}
        </h3>
        <div className="mt-3 flex items-center gap-2">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-line-soft">
            <div
              className="h-full rounded-full bg-brass"
              style={{ width: `${(usedCount / NODE_DEFS.length) * 100}%` }}
            />
          </div>
          <span className="whitespace-nowrap text-xs text-muted">
            {usedCount}/{NODE_DEFS.length} nodes
          </span>
        </div>
      </div>
    </Link>
  );
}
