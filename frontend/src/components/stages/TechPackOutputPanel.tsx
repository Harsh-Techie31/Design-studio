import { useState } from "react";
import { toggleLike } from "../../api/designImages";
import type { DesignImage } from "../../types";

async function downloadImage(url: string, filename: string) {
  try {
    const resp = await fetch(url);
    const blob = await resp.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } catch {
    window.open(url, "_blank");
  }
}

interface TechPackOutputPanelProps {
  images: DesignImage[];
  imageType?: string;
  onRefresh?: () => void;
  pendingCount?: number;
  onNextStage?: () => void;
  nextStageLabel?: string;
  isFinalStage?: boolean;
  onExport?: () => void;
}

/**
 * Stage 4 has a unique layout: filter bar + vertical thumbnail strip + large preview.
 * NOT the 2x2 grid used by other stages.
 */
export function TechPackOutputPanel({
  images,
  imageType = "tech_pack",
  onRefresh,
  pendingCount = 0,
  onNextStage,
  nextStageLabel,
  isFinalStage,
  onExport,
}: TechPackOutputPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = images.filter((i) => i.image_type === imageType);
  const selected = filtered.find((i) => i.id === selectedId) || null;
  const likedCount = filtered.filter((i) => i.liked).length;
  const hasLiked = likedCount > 0;

  const handleLike = async (id: string) => {
    try {
      await toggleLike(id);
      onRefresh?.();
    } catch (e) {
      console.error("Failed to toggle like:", e);
    }
  };

  // Auto-select first
  if (!selected && filtered.length > 0) {
    const first = filtered[0];
    setTimeout(() => setSelectedId(first.id), 0);
  }

  return (
    <div className="flex h-full flex-col bg-surface">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h3 className="text-xs font-bold uppercase tracking-widest text-brass">
          Tech Pack Output
        </h3>
        <span className="rounded-full bg-ink-soft px-2.5 py-1 text-[10px] font-mono text-muted">
          {filtered.length}{pendingCount > 0 ? ` + ${pendingCount}` : ""}
        </span>
      </div>

      {filtered.length === 0 && pendingCount === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted">
          <i className="ti ti-file-analytics text-4xl" />
          <span className="text-xs">No tech packs yet</span>
          <span className="text-[10px]">Generate one from the controls on the left</span>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* Thumbnail strip (left) */}
          <div className="w-[88px] flex flex-col border-r border-line bg-ink overflow-y-auto py-2 px-1.5 gap-2">
            {Array.from({ length: pendingCount }).map((_, i) => (
              <div key={`pending-${i}`} className="w-full animate-pulse rounded-lg border border-dashed border-brass/30 bg-ink-soft/50">
                <div className="aspect-[3/4] w-full bg-line/30" />
              </div>
            ))}
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
                <img
                  src={img.url}
                  alt={img.image_code}
                  className="aspect-[3/4] w-full object-cover"
                />
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-1 py-1">
                  <div className="text-center font-mono text-[8px] text-bone-dim truncate">
                    {img.image_code}
                  </div>
                </div>
                {img.liked && (
                  <div className="absolute right-1 top-1 rounded-full bg-green-500/80 p-0.5">
                    <i className="ti ti-heart-filled text-[8px] text-ink" />
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Large preview (right) */}
          <div className="flex flex-1 flex-col overflow-hidden bg-ink-soft/30">
            {selected ? (
              <>
                {/* Image — constrained to fill available space */}
                <div className="flex flex-1 items-center justify-center overflow-hidden p-4">
                  <img
                    src={selected.url}
                    alt={selected.image_code}
                    className="max-h-full max-w-full rounded-lg border border-line object-contain shadow-xl"
                  />
                </div>

                {/* Actions bar */}
                <div className="flex items-center justify-between border-t border-line px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleLike(selected.id)}
                      className={`rounded-lg px-3 py-1.5 text-[11px] transition-all ${
                        selected.liked
                          ? "bg-green-500/20 text-green-400"
                          : "bg-ink text-muted hover:text-green-400"
                      }`}
                    >
                      <i className={`ti ti-heart-filled mr-1 ${selected.liked ? "fill-current" : ""}`} />
                      {selected.liked ? "Liked" : "Like"}
                    </button>
                    <button
                      onClick={() => downloadImage(selected.url, `${selected.image_code}.png`)}
                      className="rounded-lg bg-ink px-3 py-1.5 text-[11px] text-muted hover:text-bone-dim"
                    >
                      <i className="ti ti-download mr-1" />
                      Download
                    </button>
                  </div>
                  <span className="font-mono text-[10px] text-muted">
                    {selected.image_code}
                  </span>
                </div>
              </>
            ) : pendingCount > 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 animate-pulse">
                <div className="aspect-[3/4] w-48 rounded-lg border border-dashed border-brass/30 bg-line/20" />
                <div className="flex items-center gap-2 text-brass/60">
                  <i className="ti ti-loader-2 animate-spin text-sm" />
                  <span className="text-xs">Generating tech pack...</span>
                </div>
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center text-muted text-xs">
                Select a tech pack from the strip
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom bar — next stage / export */}
      {(onNextStage || isFinalStage) && filtered.length > 0 && (
        <div className="flex items-center justify-between border-t border-line px-4 py-3">
          <p className="text-xs text-muted">
            {isFinalStage ? (
              likedCount > 0 ? (
                <>
                  <i className="ti ti-check mr-1.5 text-green-400" />
                  <span className="font-medium text-green-400">{likedCount}</span> selected
                  {likedCount !== 1 ? "s" : ""} ready for export
                </>
              ) : (
                "Like at least 1 to export"
              )
            ) : hasLiked ? (
              <>
                <span className="font-medium text-green-400">{likedCount}</span> image
                {likedCount !== 1 ? "s" : ""} selected
              </>
            ) : (
              "Like at least 1 image to proceed"
            )}
          </p>
          {isFinalStage ? (
            <button
              onClick={onExport}
              disabled={!hasLiked}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all ${
                hasLiked
                  ? "bg-brass text-ink hover:bg-brass-soft"
                  : "cursor-not-allowed bg-line text-muted"
              }`}
            >
              <i className="ti ti-download text-xs" />
              Export Selected
            </button>
          ) : (
            <button
              onClick={onNextStage}
              disabled={!hasLiked}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all ${
                hasLiked
                  ? "bg-brass text-ink hover:bg-brass-soft"
                  : "cursor-not-allowed bg-line text-muted"
              }`}
            >
              {nextStageLabel || "Next Stage"}
              <i className="ti ti-arrow-right text-xs" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
