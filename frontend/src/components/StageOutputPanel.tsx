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
    { key: "liked", label: "Liked", count: likedCount },
    { key: "unliked", label: "Not Liked", count: images.length - likedCount },
    { key: "starred", label: "Starred", count: images.filter((i) => i.starred).length },
  ];

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <i className="ti ti-loader-2 animate-spin text-2xl text-brass" />
          <span className="text-sm text-bone-dim">Loading outputs...</span>
        </div>
      </div>
    );
  }

  // Split view for print stage: canvas preview + output stack
  if (canvasPreview) {
    return (
      <div className="flex h-full flex-row overflow-hidden">
        {/* Left column: Real-time canvas preview */}
        <div className="flex flex-1 flex-col border-r border-line">
          <div className="flex items-center border-b border-line px-4 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-brass">
              Live Preview
            </span>
          </div>
          <div className="flex flex-1 items-center justify-center bg-ink p-4">
            {canvasPreview}
          </div>
        </div>

        {/* Right column: Output stack */}
        <div className="flex w-[380px] flex-col overflow-hidden">
          {/* Filter bar */}
          <div className="flex items-center gap-2 border-b border-line px-4 py-3">
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  filter === f.key
                    ? "bg-brass/15 text-brass"
                    : "text-muted hover:text-bone-dim"
                }`}
              >
                {f.label} ({f.count})
              </button>
            ))}
          </div>

          {/* Image list */}
          <div className="flex-1 overflow-y-auto p-3">
            {filtered.length === 0 && pendingCount === 0 ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-center text-xs text-muted">
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

          {/* Proceed bar */}
          {onNextStage && (
            <div className="flex items-center justify-between border-t border-line px-4 py-3">
              <p className="text-xs text-muted">
                {likedCount > 0 ? (
                  <>
                    <span className="font-medium text-green-400">{likedCount}</span> image
                    {likedCount !== 1 ? "s" : ""} selected
                  </>
                ) : (
                  "Like at least 1 image to proceed"
                )}
              </p>
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
            </div>
          )}
        </div>

        {/* Lightbox */}
        {lightboxImage && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-8"
            onClick={() => setLightboxImage(null)}
          >
            <div
              className="relative max-h-full max-w-4xl"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={lightboxImage.url}
                alt={lightboxImage.image_code}
                className="max-h-[80vh] rounded-lg object-contain"
              />
              <div className="mt-3 flex items-center justify-between">
                <span className="font-mono text-sm text-bone-dim">
                  {lightboxImage.image_code}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => onToggleLike(lightboxImage.id)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      lightboxImage.liked
                        ? "bg-green-500/20 text-green-400"
                        : "bg-surface text-muted hover:text-green-400"
                    }`}
                  >
                    <i className="ti ti-heart-filled mr-1" />
                    {lightboxImage.liked ? "Liked" : "Like"}
                  </button>
                  <button
                    onClick={() => setLightboxImage(null)}
                    className="rounded-lg bg-surface px-3 py-1.5 text-xs text-muted hover:text-bone"
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
      {/* Filter bar */}
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === f.key
                ? "bg-brass/15 text-brass"
                : "text-muted hover:text-bone-dim"
            }`}
          >
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      {/* Image grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {filtered.length === 0 && pendingCount === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted">
              {images.length === 0
                ? "No outputs yet. Generate something!"
                : "No images match this filter."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {Array.from({ length: pendingCount }).map((_, i) => (
              <SkeletonGridCard key={`pending-${i}`} />
            ))}
            {filtered.map((img) => (
              <div
                key={img.id}
                className={`group relative overflow-hidden rounded-xl border transition-all ${
                  img.liked
                    ? "border-green-500/50 ring-2 ring-green-500/20"
                    : "border-line hover:border-brass/30"
                }`}
              >
                {/* Image */}
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

                {/* Code label */}
                <div className="flex items-center justify-between px-2.5 py-1.5">
                  <span className="font-mono text-[10px] text-muted">
                    {img.image_code.split("_").slice(-2).join("_")}
                  </span>
                  <span className="text-[10px] text-muted">{img.view}</span>
                </div>

                {/* Action buttons */}
                <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleLike(img.id);
                    }}
                    className={`rounded-md p-1.5 transition-colors ${
                      img.liked
                        ? "bg-green-500/20 text-green-400"
                        : "bg-ink/80 text-muted hover:text-green-400"
                    }`}
                    title={img.liked ? "Unlike" : "Like"}
                  >
                    <i className={`ti ti-heart-filled text-xs`} />
                  </button>
                  {onToggleStar && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleStar(img.id);
                      }}
                      className={`rounded-md p-1.5 transition-colors ${
                        img.starred
                          ? "bg-amber-500/20 text-amber-400"
                          : "bg-ink/80 text-muted hover:text-amber-400"
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
                    className="rounded-md bg-ink/80 p-1.5 text-muted hover:text-bone"
                    title="Download"
                  >
                    <i className="ti ti-download text-xs" />
                  </button>
                </div>

                {/* Note indicator */}
                {img.note && (
                  <div className="absolute left-2 top-2">
                    <i className="ti ti-message text-[10px] text-brass" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Proceed / Export bar */}
      {isFinalStage ? (
        <div className="flex items-center justify-between border-t border-line px-4 py-3">
          <p className="text-xs text-muted">
            {likedCount > 0 ? (
              <>
                <i className="ti ti-check mr-1.5 text-green-400" />
                <span className="font-medium text-green-400">{likedCount}</span> selected photo
                {likedCount !== 1 ? "s" : ""} ready for collection
              </>
            ) : (
              "Like at least 1 photo to export"
            )}
          </p>
          <button
            onClick={onMakeNewGarment}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wider bg-brass text-ink hover:bg-brass-soft transition-all"
          >
            <i className="ti ti-plus text-xs" />
            Make New Garment
          </button>
        </div>
      ) : (
        onNextStage && (
          <div className="flex items-center justify-between border-t border-line px-4 py-3">
            <p className="text-xs text-muted">
              {likedCount > 0 ? (
                <>
                  <span className="font-medium text-green-400">{likedCount}</span> image
                  {likedCount !== 1 ? "s" : ""} selected
                </>
              ) : (
                "Like at least 1 image to proceed"
              )}
            </p>
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
          </div>
        )
      )}

      {/* Lightbox */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-8"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="relative max-h-full max-w-4xl"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={lightboxImage.url}
              alt={lightboxImage.image_code}
              className="max-h-[80vh] rounded-lg object-contain"
            />
            <div className="mt-3 flex items-center justify-between">
              <span className="font-mono text-sm text-bone-dim">
                {lightboxImage.image_code}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => onToggleLike(lightboxImage.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    lightboxImage.liked
                      ? "bg-green-500/20 text-green-400"
                      : "bg-surface text-muted hover:text-green-400"
                  }`}
                >
                  <i className="ti ti-heart-filled mr-1" />
                  {lightboxImage.liked ? "Liked" : "Like"}
                </button>
                <button
                  onClick={() => setLightboxImage(null)}
                  className="rounded-lg bg-surface px-3 py-1.5 text-xs text-muted hover:text-bone"
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

// ─── Skeleton Cards (pending generation) ────────────────────────────

function SkeletonCard() {
  return (
    <div className="group relative overflow-hidden rounded-lg border border-brass/20 border-dashed bg-ink-soft/50 animate-pulse">
      <div className="flex cursor-pointer items-center gap-3 p-2">
        <div className="h-16 w-16 rounded bg-line/50" />
        <div className="flex-1 space-y-2">
          <div className="h-2.5 w-3/4 rounded bg-line/50" />
          <div className="h-2 w-1/2 rounded bg-line/30" />
        </div>
      </div>
      <div className="flex items-center gap-1 border-t border-dashed border-line/50 px-2 py-1.5">
        <div className="h-5 w-5 rounded bg-line/30" />
        <div className="h-5 w-5 rounded bg-line/30" />
        <div className="h-5 w-5 rounded bg-line/30" />
        <div className="ml-auto flex items-center gap-1 text-brass/60">
          <i className="ti ti-loader-2 animate-spin text-xs" />
          <span className="text-[9px]">Generating...</span>
        </div>
      </div>
    </div>
  );
}

function SkeletonGridCard() {
  return (
    <div className="overflow-hidden rounded-xl border border-brass/20 border-dashed bg-ink-soft/50 animate-pulse">
      {/* Image area */}
      <div className="aspect-[4/3] flex items-center justify-center bg-line/20">
        <i className="ti ti-loader-2 animate-spin text-2xl text-brass/40" />
      </div>
      {/* Code label */}
      <div className="flex items-center justify-between px-2.5 py-1.5">
        <div className="h-2.5 w-20 rounded bg-line/40" />
        <div className="h-2 w-8 rounded bg-line/30" />
      </div>
    </div>
  );
}

// ─── Output Card (for split view) ──────────────────────────────────

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
      className={`group relative overflow-hidden rounded-lg border transition-all ${
        image.liked
          ? "border-green-500/50 ring-1 ring-green-500/20"
          : "border-line hover:border-brass/30"
      }`}
    >
      {/* Thumbnail */}
      <div
        className="flex cursor-pointer items-center gap-3 bg-ink-soft p-2"
        onClick={() => onPreview(image)}
      >
        <img
          src={image.url}
          alt={image.image_code}
          className="h-16 w-16 rounded object-contain"
          loading="lazy"
        />
        <div className="flex-1 overflow-hidden">
          <p className="truncate font-mono text-[10px] text-muted">
            {image.image_code.split("_").slice(-2).join("_")}
          </p>
          <p className="text-[10px] text-muted">{image.source}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 border-t border-line px-2 py-1.5">
        <button
          onClick={() => onToggleLike(image.id)}
          className={`rounded p-1 transition-colors ${
            image.liked
              ? "text-green-400"
              : "text-muted hover:text-green-400"
          }`}
          title={image.liked ? "Unlike" : "Like"}
        >
          <i className="ti ti-heart-filled text-xs" />
        </button>
        {onToggleStar && (
          <button
            onClick={() => onToggleStar(image.id)}
            className={`rounded p-1 transition-colors ${
              image.starred
                ? "text-amber-400"
                : "text-muted hover:text-amber-400"
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
          className="rounded p-1 text-muted hover:text-bone"
          title="Download"
        >
          <i className="ti ti-download text-xs" />
        </button>
        <button
          onClick={() => onPreview(image)}
          className="rounded p-1 text-muted hover:text-bone"
          title="Preview"
        >
          <i className="ti ti-eye text-xs" />
        </button>
      </div>
    </div>
  );
}
