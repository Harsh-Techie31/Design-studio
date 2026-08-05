import { useState } from "react";
import type { DesignImage } from "../types";

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

interface StageOutputPanelProps {
  images: DesignImage[];
  loading: boolean;
  onToggleLike: (imageId: string) => void;
  onToggleStar?: (imageId: string) => void;
  onUpdateNote?: (imageId: string, note: string) => void;
  onDelete?: (imageId: string) => void;
  onNextStage?: () => void;
  nextStageLabel?: string;
  canvasPreview?: React.ReactNode;
  isFinalStage?: boolean;
  onMakeNewGarment?: () => void;
  pendingCount?: number;
}

type FilterType = "all" | "liked" | "unliked" | "starred";

export function StageOutputPanel({
  images,
  loading,
  onToggleLike,
  onToggleStar,
  onUpdateNote: _onUpdateNote,
  onDelete: _onDelete,
  onNextStage,
  nextStageLabel,
  canvasPreview,
  isFinalStage,
  onMakeNewGarment,
  pendingCount = 0,
}: StageOutputPanelProps) {
  const [filter, setFilter] = useState<FilterType>("all");
  const [lightboxImage, setLightboxImage] = useState<DesignImage | null>(null);
  const [_editingNote, _setEditingNote] = useState<{ id: string; note: string } | null>(null);

  const filtered = images.filter((img) => {
    if (filter === "liked") return img.liked;
    if (filter === "unliked") return !img.liked;
    if (filter === "starred") return img.starred;
    return true;
  });

  const likedCount = images.filter((img) => img.liked).length;
  const hasLiked = likedCount > 0;

  const filters: { key: FilterType; label: string; count: number }[] = [
    { key: "all", label: "All", count: images.length },
    { key: "liked", label: "Selected", count: likedCount },
    { key: "unliked", label: "Not Selected", count: images.length - likedCount },
    { key: "starred", label: "Starred", count: images.filter((i) => i.starred).length },
  ];

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <i className="ti ti-loader-2 animate-spin text-2xl text-vermillion" />
          <span className="font-mono text-xs text-bone-dim">Loading outputs...</span>
        </div>
      </div>
    );
  }

  // Split view for print stage: canvas preview + output stack
  if (canvasPreview) {
    return (
      <div className="flex h-full flex-row overflow-hidden">
        <div className="flex flex-1 flex-col border-r border-line">
          <div className="flex items-center border-b border-line px-4 py-2">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-widest text-vermillion">
              Live Preview
            </span>
          </div>
          <div className="flex flex-1 items-center justify-center bg-ink p-4">
            {canvasPreview}
          </div>
        </div>

        <div className="flex w-[380px] flex-col overflow-hidden">
          <div className="flex items-center gap-2 border-b border-line px-4 py-3">
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 font-mono text-[11px] font-medium uppercase tracking-wider transition-colors ${
                  filter === f.key
                    ? "bg-vermillion/15 text-vermillion"
                    : "text-muted hover:text-bone-dim"
                }`}
              >
                {f.label} ({f.count})
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {filtered.length === 0 && pendingCount === 0 ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-center font-mono text-[11px] text-muted">
                  {images.length === 0
                    ? "No outputs yet. Generate something!"
                    : "No images match this filter."}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {Array.from({ length: pendingCount }).map((_, i) => (
                  <SkeletonCard key={`pending-${i}`} />
                ))}
                {filtered.map((img) => (
                  <OutputCard
                    key={img.id}
                    image={img}
                    onToggleLike={onToggleLike}
                    onToggleStar={onToggleStar}
                    onPreview={setLightboxImage}
                  />
                ))}
              </div>
            )}
          </div>

          {onNextStage && (
            <div className="flex items-center justify-between border-t border-line px-4 py-3">
              <p className="font-mono text-[11px] text-muted">
                {likedCount > 0 ? (
                  <>
                    <span className="font-medium text-signal-green">{likedCount}</span> image
                    {likedCount !== 1 ? "s" : ""} selected
                  </>
                ) : (
                  "Select at least 1 image to proceed"
                )}
              </p>
              <button
                onClick={onNextStage}
                disabled={!hasLiked}
                className={`flex items-center gap-2 px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wider transition-all ${
                  hasLiked
                    ? "bg-vermillion text-ink hover:bg-vermillion-soft"
                    : "cursor-not-allowed bg-line text-muted"
                }`}
              >
                {nextStageLabel || "Next Stage"}
                <i className="ti ti-arrow-right text-[11px]" />
              </button>
            </div>
          )}
        </div>

        {lightboxImage && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-8"
            onClick={() => setLightboxImage(null)}
          >
            <div
              className="relative max-h-full max-w-4xl"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={lightboxImage.url}
                alt={lightboxImage.image_code}
                className="max-h-[80vh] object-contain"
              />
              <div className="mt-3 flex items-center justify-between">
                <span className="font-mono text-sm text-bone-dim">
                  {lightboxImage.image_code}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => onToggleLike(lightboxImage.id)}
                    className={`px-4 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider transition-all ${
                      lightboxImage.liked
                        ? "bg-signal-green text-ink"
                        : "bg-ink text-muted hover:bg-signal-green/20 hover:text-signal-green"
                    }`}
                  >
                    {lightboxImage.liked ? "Selected" : "Select"}
                  </button>
                  <button
                    onClick={() => setLightboxImage(null)}
                    className="bg-surface px-3 py-1.5 font-mono text-[11px] text-muted hover:text-bone"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Default view: single column grid
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 font-mono text-[11px] font-medium uppercase tracking-wider transition-colors ${
              filter === f.key
                ? "bg-vermillion/15 text-vermillion"
                : "text-muted hover:text-bone-dim"
            }`}
          >
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {filtered.length === 0 && pendingCount === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="font-mono text-xs text-muted">
              {images.length === 0
                ? "No outputs yet. Generate something!"
                : "No images match this filter."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-px bg-line lg:grid-cols-3">
            {Array.from({ length: pendingCount }).map((_, i) => (
              <SkeletonGridCard key={`pending-${i}`} />
            ))}
            {filtered.map((img) => (
              <div
                key={img.id}
                className={`group relative overflow-hidden transition-all ${
                  img.liked
                    ? "ring-2 ring-signal-green/50"
                    : ""
                }`}
              >
                <div
                  className="aspect-[4/3] cursor-pointer bg-ink-soft"
                  onClick={() => setLightboxImage(img)}
                >
                  <img
                    src={img.url}
                    alt={img.image_code}
                    className="h-full w-full object-contain"
                    loading="lazy"
                  />
                </div>

                <div className="flex items-center justify-between px-2.5 py-1.5">
                  <span className="font-mono text-[10px] text-muted">
                    {img.image_code.split("_").slice(-2).join("_")}
                  </span>
                  <span className="font-mono text-[10px] text-muted">{img.view}</span>
                </div>

                <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleLike(img.id);
                    }}
                    className={`px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider transition-all ${
                      img.liked
                        ? "bg-signal-green text-ink"
                        : "bg-ink/80 text-muted hover:bg-signal-green/20 hover:text-signal-green"
                    }`}
                    title={img.liked ? "Deselect" : "Select"}
                  >
                    {img.liked ? "Selected" : "Select"}
                  </button>
                  {onToggleStar && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleStar(img.id);
                      }}
                      className={`p-1.5 transition-colors ${
                        img.starred
                          ? "bg-signal-amber/20 text-signal-amber"
                          : "bg-ink/80 text-muted hover:text-signal-amber"
                      }`}
                      title={img.starred ? "Unstar" : "Star"}
                    >
                      <i className={`ti ti-star${img.starred ? "-filled" : ""} text-xs`} />
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadImage(img.url, `${img.image_code}.png`);
                    }}
                    className="bg-ink/80 p-1.5 text-muted hover:text-bone"
                    title="Download"
                  >
                    <i className="ti ti-download text-xs" />
                  </button>
                </div>

                {img.note && (
                  <div className="absolute left-2 top-2">
                    <i className="ti ti-message text-[10px] text-vermillion" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {isFinalStage ? (
        <div className="flex items-center justify-between border-t border-line px-4 py-3">
          <p className="font-mono text-[11px] text-muted">
            {likedCount > 0 ? (
              <>
                <i className="ti ti-check mr-1.5 text-signal-green" />
                <span className="font-medium text-signal-green">{likedCount}</span> selected photo
                {likedCount !== 1 ? "s" : ""} ready for collection
              </>
            ) : (
              "Select at least 1 photo to export"
            )}
          </p>
          <button
            onClick={onMakeNewGarment}
            className="flex items-center gap-2 bg-vermillion px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-ink transition-all hover:bg-vermillion-soft"
          >
            <i className="ti ti-plus text-[11px]" />
            Make New Garment
          </button>
        </div>
      ) : (
        onNextStage && (
          <div className="flex items-center justify-between border-t border-line px-4 py-3">
            <p className="font-mono text-[11px] text-muted">
              {likedCount > 0 ? (
                <>
                  <span className="font-medium text-signal-green">{likedCount}</span> image
                  {likedCount !== 1 ? "s" : ""} selected
                </>
              ) : (
                "Select at least 1 image to proceed"
              )}
            </p>
            <button
              onClick={onNextStage}
              disabled={!hasLiked}
              className={`flex items-center gap-2 px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wider transition-all ${
                hasLiked
                  ? "bg-vermillion text-ink hover:bg-vermillion-soft"
                  : "cursor-not-allowed bg-line text-muted"
              }`}
            >
              {nextStageLabel || "Next Stage"}
              <i className="ti ti-arrow-right text-[11px]" />
            </button>
          </div>
        )
      )}

      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-8"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="relative max-h-full max-w-4xl"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={lightboxImage.url}
              alt={lightboxImage.image_code}
              className="max-h-[80vh] object-contain"
            />
            <div className="mt-3 flex items-center justify-between">
              <span className="font-mono text-sm text-bone-dim">
                {lightboxImage.image_code}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => onToggleLike(lightboxImage.id)}
                  className={`px-4 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider transition-all ${
                    lightboxImage.liked
                      ? "bg-signal-green text-ink"
                      : "bg-ink text-muted hover:bg-signal-green/20 hover:text-signal-green"
                  }`}
                >
                  {lightboxImage.liked ? "Selected" : "Select"}
                </button>
                <button
                  onClick={() => setLightboxImage(null)}
                  className="bg-surface px-3 py-1.5 font-mono text-[11px] text-muted hover:text-bone"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Skeleton Cards ────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="group relative overflow-hidden border border-vermillion/20 border-dashed bg-ink-soft/50 animate-pulse">
      <div className="flex cursor-pointer items-center gap-3 p-2">
        <div className="h-16 w-16 bg-line/50" />
        <div className="flex-1 space-y-2">
          <div className="h-2.5 w-3/4 bg-line/50" />
          <div className="h-2 w-1/2 bg-line/30" />
        </div>
      </div>
      <div className="flex items-center gap-1 border-t border-dashed border-line/50 px-2 py-1.5">
        <div className="h-5 w-5 bg-line/30" />
        <div className="h-5 w-5 bg-line/30" />
        <div className="h-5 w-5 bg-line/30" />
        <div className="ml-auto flex items-center gap-1 text-vermillion/60">
          <i className="ti ti-loader-2 animate-spin text-xs" />
          <span className="font-mono text-[9px]">Generating...</span>
        </div>
      </div>
    </div>
  );
}

function SkeletonGridCard() {
  return (
    <div className="overflow-hidden border border-vermillion/20 border-dashed bg-ink-soft/50 animate-pulse">
      <div className="aspect-[4/3] flex items-center justify-center bg-line/20">
        <i className="ti ti-loader-2 animate-spin text-2xl text-vermillion/40" />
      </div>
      <div className="flex items-center justify-between px-2.5 py-1.5">
        <div className="h-2.5 w-20 bg-line/40" />
        <div className="h-2 w-8 bg-line/30" />
      </div>
    </div>
  );
}

// ─── Output Card (split view) ──────────────────────────────────────

function OutputCard({
  image,
  onToggleLike,
  onToggleStar,
  onPreview,
}: {
  image: DesignImage;
  onToggleLike: (id: string) => void;
  onToggleStar?: (id: string) => void;
  onPreview: (img: DesignImage) => void;
}) {
  return (
    <div
      className={`group relative overflow-hidden transition-all ${
        image.liked
          ? "ring-1 ring-signal-green/50"
          : ""
      }`}
    >
      <div
        className="flex cursor-pointer items-center gap-3 bg-ink-soft p-2"
        onClick={() => onPreview(image)}
      >
        <img
          src={image.url}
          alt={image.image_code}
          className="h-16 w-16 object-contain"
          loading="lazy"
        />
        <div className="flex-1 overflow-hidden">
          <p className="truncate font-mono text-[10px] text-muted">
            {image.image_code.split("_").slice(-2).join("_")}
          </p>
          <p className="font-mono text-[10px] text-muted">{image.source}</p>
        </div>
      </div>

      <div className="flex items-center gap-1 border-t border-line px-2 py-1.5">
        <button
          onClick={() => onToggleLike(image.id)}
          className={`px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider transition-all ${
            image.liked
              ? "bg-signal-green text-ink"
              : "bg-ink text-muted hover:bg-signal-green/20 hover:text-signal-green"
          }`}
          title={image.liked ? "Deselect" : "Select"}
        >
          {image.liked ? "Selected" : "Select"}
        </button>
        {onToggleStar && (
          <button
            onClick={() => onToggleStar(image.id)}
            className={`p-1 transition-colors ${
              image.starred
                ? "text-signal-amber"
                : "text-muted hover:text-signal-amber"
            }`}
            title={image.starred ? "Unstar" : "Star"}
          >
            <i className={`ti ti-star${image.starred ? "-filled" : ""} text-xs`} />
          </button>
        )}
        <button
          onClick={() => {
            downloadImage(image.url, `${image.image_code}.png`);
          }}
          className="p-1 text-muted hover:text-bone"
          title="Download"
        >
          <i className="ti ti-download text-xs" />
        </button>
        <button
          onClick={() => onPreview(image)}
          className="p-1 text-muted hover:text-bone"
          title="Preview"
        >
          <i className="ti ti-eye text-xs" />
        </button>
      </div>
    </div>
  );
}
