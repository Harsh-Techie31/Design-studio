interface PaletteSwatchesProps {
  colors: string[];
  size?: "sm" | "md";
}

export function PaletteSwatches({ colors, size = "md" }: PaletteSwatchesProps) {
  const dim = size === "sm" ? "h-5 w-5" : "h-8 w-8";
  return (
    <div className="flex items-center gap-1.5">
      {colors.map((c, i) => (
        <div
          key={i}
          title={c}
          className={`rounded-sm ${dim}`}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  );
}
