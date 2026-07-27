import { useState } from "react";
import { toggleLike } from "../../api/designImages";
import type { DesignImage } from "../../types";

interface PatternOutputPanelProps {
  images: DesignImage[];
  imageType?: string;
  onRefresh?: () => void;
}

export function PatternOutputPanel({
  images,
  imageType = "pattern",
  onRefresh,
}: PatternOutputPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = images.filter((i) => i.image_type === imageType);
  const selected = filtered.find((i) => i.id === selectedId) || null;

  const handleLike = async (id: string) => {
    try {
      await toggleLike(id);
      onRefresh?.();
    } catch (e) {
      console.error("Failed to toggle like:", e);
    }
  };

  if (!selected && filtered.length > 0) {
    const first = filtered[0];
    setTimeout(() => setSelectedId(first.id), 0);
  }

  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h3 className="text-xs font-bold uppercase tracking-widest text-brass">
          Pattern Output
        </h3>
        <span className="rounded-full bg-ink-soft px-2.5 py-1 text-[10px] font-mono text-muted">
          {filtered.length}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted">
          <i className="ti ti-scissors text-4xl" />
          <span className="text-xs">No patterns yet</span>
          <span className="text-[10px]">Generate one from the controls on the left</span>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          <div className="w-[88px] flex flex-col border-r border-line bg-ink overflow-y-auto py-2 px-1.5 gap-2">
            {filtered.map((img) => (
              <button
                key={img.id}
                onClick={() => setSelectedId(img.id)}
                className={`group relative w-full overflow-hidden rounded-lg border transition-all ${
                  selectedId === img.id
                    ? "border-brass shadow-[0_0_12px_rgba(184,150,74,0.25)]"
                    : "border-line hover:border-brass/30"
                }`}
              >
                <img src={img.url} alt={img.image_code} className="aspect-[3/4] w-full object-cover" />
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-1 py-1">
                  <div className="text-center font-mono text-[8px] text-bone-dim truncate">{img.image_code}</div>
                </div>
                {img.liked && (
                  <div className="absolute right-1 top-1 rounded-full bg-brass/80 p-0.5">
                    <i className="ti ti-star text-[8px] text-ink" />
                  </div>
                )}
              </button>
            ))}
          </div>

          <div className="flex flex-1 flex-col bg-ink-soft/30">
            {selected ? (
              <>
                <div className="flex flex-1 items-center justify-center p-4">
                  <img src={selected.url} alt={selected.image_code} className="max-h-full max-w-full rounded-lg border border-line object-contain shadow-xl" />
                </div>
                <div className="flex items-center justify-between border-t border-line px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleLike(selected.id)}
                      className={`rounded-lg px-3 py-1.5 text-[11px] transition-all ${
                        selected.liked ? "bg-brass/20 text-brass" : "bg-ink text-muted hover:text-bone-dim"
                      }`}
                    >
                      <i className={`ti ti-star mr-1 ${selected.liked ? "fill-current" : ""}`} />
                      {selected.liked ? "Starred" : "Star"}
                    </button>
                    <button className="rounded-lg bg-ink px-3 py-1.5 text-[11px] text-muted hover:text-bone-dim">
                      <i className="ti ti-download mr-1" />
                      Download PNG
                    </button>
                  </div>
                  <span className="font-mono text-[10px] text-muted">{selected.image_code}</span>
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center text-muted text-xs">Select a pattern from the strip</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
