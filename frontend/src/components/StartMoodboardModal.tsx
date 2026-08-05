import { useRef, useState, type DragEvent } from "react";
import { Modal } from "./Modal";
import { PlaceholderTile } from "./PlaceholderTile";
import { AVOID_MOODBOARD_SAMPLES, RECOMMENDED_MOODBOARD_SAMPLES } from "../utils/sampleImages";
import type { MoodboardImage } from "../types";

const MAX_IMAGES = 12;

interface StartMoodboardModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (images: MoodboardImage[], name: string) => Promise<void>;
}

export function StartMoodboardModal({ open, onClose, onSave }: StartMoodboardModalProps) {
  const [name, setName] = useState("");
  const [images, setImages] = useState<MoodboardImage[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [pinterestOpen, setPinterestOpen] = useState(false);
  const [pinterestUrl, setPinterestUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const remaining = MAX_IMAGES - images.length;

  async function addFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList)
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, remaining);
    if (files.length === 0) return;

    const newImages: MoodboardImage[] = await Promise.all(
      files.map(
        (file) =>
          new Promise<MoodboardImage>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              resolve({
                url: reader.result as string,
                imagekit_file_id: null,
                source: "upload",
                order: images.length,
              });
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
          }),
      ),
    );
    setImages((prev) => [...prev, ...newImages]);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  }

  function handlePinterestImport() {
    if (!pinterestUrl.trim()) return;
    const count = Math.min(6, remaining);
    const imported: MoodboardImage[] = Array.from({ length: count }, (_, i) => ({
      url: `mood-placeholder:${images.length + i}`,
      imagekit_file_id: null,
      source: "pinterest",
      order: images.length + i,
    }));
    setImages((prev) => [...prev, ...imported]);
    setPinterestUrl("");
    setPinterestOpen(false);
  }

  function removeAt(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }

  function resetState() {
    setName("");
    setImages([]);
    setPinterestOpen(false);
    setPinterestUrl("");
    setSaving(false);
    setNameError(false);
  }

  async function handleSave() {
    if (!name.trim()) {
      setNameError(true);
      return;
    }
    setSaving(true);
    try {
      await onSave(images, name.trim());
    } catch {
      // parent handles errors
    } finally {
      setSaving(false);
      resetState();
      onClose();
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!saving) {
          resetState();
          onClose();
        }
      }}
      title="Start Moodboard"
      maxWidthClass="max-w-3xl"
      footer={
        <button
          onClick={handleSave}
          disabled={images.length === 0 || !name.trim() || saving}
          className="flex w-full items-center justify-center gap-2.5 rounded-full bg-vermillion px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-vermillion-soft disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? (
            <>
              <i className="ti ti-loader-2 animate-spin" />
              Uploading {images.filter((img) => !img.url.startsWith("mood-placeholder:")).length} images…
            </>
          ) : (
            `Save Moodboard (${images.length}/${MAX_IMAGES})`
          )}
        </button>
      }
    >
      <p className="mb-5 text-sm text-bone-dim">
        Import up to 12 images that set the mood for this season — the palette and themes
        driving every garment inside it.
      </p>

      <div className="mb-4">
        <label className="mb-1.5 block text-xs uppercase tracking-wide text-muted">
          Moodboard Name
        </label>
        <input
          value={name}
          onChange={(e) => { setName(e.target.value); setNameError(false); }}
          placeholder="e.g. Ash and Ember"
          disabled={saving}
          className={`w-full rounded-lg border bg-ink-soft px-3.5 py-2.5 text-bone placeholder:text-muted focus:outline-none disabled:opacity-50 ${
            nameError ? "border-red-500 focus:border-red-500" : "border-line focus:border-vermillion/60"
          }`}
        />
      </div>

      {/* Uploaded images — right below name */}
      {images.length > 0 && (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`mb-4 rounded-lg transition-colors ${isDragging ? "bg-vermillion/5 ring-1 ring-vermillion/30" : ""}`}
        >
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {images.map((img, i) => (
              <div key={i} className="group relative aspect-square overflow-hidden rounded-lg">
                {img.url.startsWith("mood-placeholder:") ? (
                  <PlaceholderTile seed={i + 1} index={i} className="h-full w-full" />
                ) : (
                  <img src={img.url} alt="" className="h-full w-full object-cover" />
                )}
                {!saving && (
                  <button
                    onClick={() => removeAt(i)}
                    aria-label="Remove image"
                    className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-xs text-bone opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <i className="ti ti-x" />
                  </button>
                )}
              </div>
            ))}
            {/* Add more button */}
            {remaining > 0 && (
              <button
                onClick={() => inputRef.current?.click()}
                className="flex aspect-square items-center justify-center rounded-lg border-2 border-dashed border-line bg-surface text-2xl text-muted transition-colors hover:border-vermillion/50 hover:text-bone"
              >
                <i className="ti ti-plus" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Upload / Pinterest — only show when no images yet */}
      {images.length === 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => !saving && remaining > 0 && inputRef.current?.click()}
            className={`flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-8 text-center transition-colors ${
              remaining > 0 && !saving ? "cursor-pointer" : "cursor-default opacity-50"
            } ${isDragging ? "border-vermillion bg-vermillion/5" : "border-line bg-surface hover:border-vermillion/50"}`}
          >
            <span className="text-2xl text-muted">
              <i className="ti ti-upload" />
            </span>
            <p className="text-sm text-bone">Upload images</p>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          <div
            onClick={() => !saving && remaining > 0 && setPinterestOpen((v) => !v)}
            className={`flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-8 text-center transition-colors ${
              remaining > 0 && !saving ? "cursor-pointer" : "cursor-default opacity-50"
            } ${pinterestOpen ? "border-vermillion bg-vermillion/5" : "border-line bg-surface hover:border-vermillion/50"}`}
          >
            <span className="text-2xl text-muted">
              <i className="ti ti-map-pin" />
            </span>
            <p className="text-sm text-bone">Import from Pinterest</p>
          </div>
        </div>
      )}

      {/* Hidden file input — always present for the + button */}
      {images.length > 0 && (
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      )}

      {pinterestOpen && (
        <div className="mt-3 rounded-xl border border-line bg-ink-soft p-3.5">
          <div className="flex gap-2">
            <input
              autoFocus
              value={pinterestUrl}
              onChange={(e) => setPinterestUrl(e.target.value)}
              placeholder="Paste a Pinterest board URL"
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-bone placeholder:text-muted focus:border-vermillion/60 focus:outline-none"
            />
            <button
              onClick={handlePinterestImport}
              disabled={!pinterestUrl.trim()}
              className="whitespace-nowrap rounded-lg bg-vermillion px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-vermillion-soft disabled:cursor-not-allowed disabled:opacity-40"
            >
              Import
            </button>
          </div>
          <p className="mt-2 text-xs italic text-muted">
            Frontend demo only — pulls in placeholder tiles for now, real Pinterest import comes later.
          </p>
        </div>
      )}

      <p className="mt-2 text-xs text-muted">{remaining} of {MAX_IMAGES} slots left</p>

      {images.length === 0 && (
        <div className="mt-5 flex flex-col gap-3 border-t border-line pt-5">
          <div className="flex items-center gap-3">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
              <i className="ti ti-check text-xs" />
            </span>
            <div className="shrink-0">
              <p className="text-sm font-medium text-bone">Recommended</p>
              <p className="text-xs text-muted">One cohesive style & mood</p>
            </div>
            <div className="grid flex-1 grid-cols-4 gap-1.5 sm:grid-cols-6">
              {RECOMMENDED_MOODBOARD_SAMPLES.map((src, i) => (
                <div key={i} className="aspect-square overflow-hidden rounded-md">
                  <img src={src} alt="" className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-red-400">
              <i className="ti ti-x text-xs" />
            </span>
            <div className="shrink-0">
              <p className="text-sm font-medium text-bone">Avoid</p>
              <p className="text-xs text-muted">Mixed styles, inconsistent tone</p>
            </div>
            <div className="grid flex-1 grid-cols-4 gap-1.5 sm:grid-cols-6">
              {AVOID_MOODBOARD_SAMPLES.map((src, i) => (
                <div
                  key={i}
                  className="aspect-square overflow-hidden rounded-md border border-red-500/40"
                >
                  <img src={src} alt="" className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
