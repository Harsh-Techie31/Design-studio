import { PlaceholderTile } from "./PlaceholderTile";

interface MoodboardTileProps {
  src: string;
  seed: number;
  index: number;
  className?: string;
}

export function MoodboardTile({ src, seed, index, className = "" }: MoodboardTileProps) {
  if (src.startsWith("mood-placeholder:")) {
    return <PlaceholderTile seed={seed} index={index} className={className} />;
  }
  return (
    <div className={`overflow-hidden rounded-md ${className}`}>
      <img src={src} alt="" className="h-full w-full object-cover" />
    </div>
  );
}
