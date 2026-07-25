interface PaletteSwatchesProps {
  colors: string[];
  size?: "sm" | "md";
}

export function PaletteSwatches({ colors, size = "md" }: PaletteSwatchesProps) {
  const dim = size === "sm" ? "h-6 w-6" : "h-10 w-10";
  return (
    <div className="flex items-center gap-2.5">
      {colors.map((c, i) => (
        <div
          key={i}
          title={c}
          className={`${dim} rounded-full border border-white/10 shadow-inner`}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  );
}
