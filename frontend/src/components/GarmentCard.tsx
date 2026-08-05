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

export function GarmentCard({
  garment,
  onDelete,
}: {
  garment: Garment;
  onDelete?: (garmentId: string) => void;
}) {
  const seed = seedFromId(garment.id);
  const [bestImage, setBestImage] = useState<string | null>(null);
  const [usedCount, setUsedCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const fetchBestImage = async () => {
      try {
        const allImages = await listImagesForGarment(garment.id);
        if (cancelled) return;

        const stagesWithImages = new Set(allImages.map((img) => img.node_key));
        setUsedCount(stagesWithImages.size);

        if (allImages.length === 0) return;
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

  function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    onDelete?.(garment.id);
  }

  return (
    <Link
      to={`/seasons/${garment.season_id}/garments/${garment.id}`}
      className="group relative block overflow-hidden rounded-xl border border-line bg-surface transition-all hover:border-accent/40 hover:bg-surface-hi"
    >
      {bestImage ? (
        <div className="aspect-[4/3] w-full overflow-hidden bg-ink-soft">
          <img
            src={bestImage}
            alt={garment.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </div>
      ) : (
        <PlaceholderTile seed={seed} className="aspect-[4/3]" />
      )}

      <div className="p-4">
        <div className="flex items-start justify-between">
          <h3 className="font-display text-base font-semibold tracking-tight text-bone transition-colors group-hover:text-accent">
            {garment.name}
          </h3>
          <span className="font-mono text-[10px] text-muted">
            {usedCount}/{NODE_DEFS.length}
          </span>
        </div>
        <div className="mt-2.5 h-0.5 w-full overflow-hidden bg-line-soft">
          <div
            className="h-full bg-accent transition-all duration-500"
            style={{ width: `${(usedCount / NODE_DEFS.length) * 100}%` }}
          />
        </div>
      </div>
      {onDelete && (
        <button
          onClick={handleDelete}
          className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center bg-ink/80 text-muted transition-all hover:bg-accent/20 hover:text-accent"
          title="Delete garment"
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
