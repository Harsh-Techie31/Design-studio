import type { CSSProperties } from "react";

interface PlaceholderTileProps {
  seed: number;
  index?: number;
  className?: string;
  /** Overrides the seed-derived hue — useful for curated example swatches. */
  hue?: number;
}

export function PlaceholderTile({ seed, index = 0, className = "", hue }: PlaceholderTileProps) {
  const h1 = hue ?? (seed * 47 + index * 67) % 360;
  const h2 = (h1 + 34 + (index % 3) * 12) % 360;
  const style: CSSProperties = {
    backgroundImage: `radial-gradient(circle at 28% 22%, hsl(${h1} 40% 32% / 0.85), transparent 60%), linear-gradient(150deg, hsl(${h1} 28% 15%), hsl(${h2} 24% 9%))`,
  };
  return (
    <div className={`relative overflow-hidden ${className}`} style={style}>
      <div
        className="absolute inset-0 opacity-[0.06] mix-blend-overlay"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 1px, transparent 3px)",
        }}
      />
    </div>
  );
}
