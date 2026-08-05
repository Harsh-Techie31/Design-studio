import { useState, useRef, useEffect, useCallback } from "react";
import { Modal } from "./Modal";
import { listImagesForSeason, uploadImageToLibrary } from "../api/designImages";
import type { DesignImage } from "../types";

interface ImagePickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (image: DesignImage) => void;
  seasonId: string;
  imageType: "sketch" | "fabric" | "print" | "render" | "3d";
  title?: string;
}

type PickerTab = "upload" | "library";

export function ImagePickerModal({
  open,
  onClose,
  onSelect,
  seasonId,
  imageType,
  title,
}: ImagePickerModalProps) {
  const [tab, setTab] = useState<PickerTab>("library");
  const [libraryImages, setLibraryImages] = useState<DesignImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const modalTitle = title ?? (imageType === "sketch" ? "Choose Sketch" : imageType === "render" ? "Choose Render" : "Choose Fabric");

  // Load library images when modal opens
  useEffect(() => {
    if (!open || !seasonId) return;
    setLoading(true);
    // For fabric picker, show both fabric and print images
    const types = imageType === "fabric" ? ["fabric", "print"] : [imageType];
    
    Promise.all(types.map(t => listImagesForSeason(seasonId, { image_type: t })))
      .then(results => {
        const allImages = results.flat();
        // Deduplicate by id
        const seen = new Set<string>();
        const unique = allImages.filter(img => {
          if (seen.has(img.id)) return false;
          seen.add(img.id);
          return true;
        });
        setLibraryImages(unique);
      })
      .catch(() => setLibraryImages([]))
      .finally(() => setLoading(false));
  }, [open, seasonId, imageType]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !seasonId) return;

    setUploading(true);
    try {
      const uploaded = await uploadImageToLibrary({
        file,
        season_id: seasonId,
        image_type: imageType,
      });
      onSelect(uploaded);
      onClose();
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [seasonId, imageType, onSelect, onClose]);

  const handleSelectFromLibrary = useCallback(() => {
    const img = libraryImages.find(i => i.id === selectedId);
    if (img) {
      onSelect(img);
      onClose();
    }
  }, [libraryImages, selectedId, onSelect, onClose]);

  return (
    <Modal open={open} onClose={onClose} title={modalTitle} maxWidthClass="max-w-2xl">
      {/* Tab bar */}
      <div className="mb-4 flex gap-1 border-b border-line">
        <button
          onClick={() => setTab("upload")}
          className={`-mb-px border-b-2 px-4 py-2.5 text-sm transition-colors ${
            tab === "upload"
              ? "border-vermillion text-bone"
              : "border-transparent text-muted hover:text-bone-dim"
          }`}
        >
          <i className="ti ti-upload mr-1.5" />
          Upload from PC
        </button>
        <button
          onClick={() => setTab("library")}
          className={`-mb-px border-b-2 px-4 py-2.5 text-sm transition-colors ${
            tab === "library"
              ? "border-vermillion text-bone"
              : "border-transparent text-muted hover:text-bone-dim"
          }`}
        >
          <i className="ti ti-photo mr-1.5" />
          From Library
        </button>
      </div>

      {/* Upload tab */}
      {tab === "upload" && (
        <div className="flex flex-col items-center gap-4 py-8">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            id={`image-upload-${imageType}`}
          />
          <label
            htmlFor={`image-upload-${imageType}`}
            className={`flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-line p-10 text-center transition-colors hover:border-vermillion/50 ${
              uploading ? "pointer-events-none opacity-60" : ""
            }`}
          >
            {uploading ? (
              <>
                <i className="ti ti-loader-2 animate-spin text-2xl text-vermillion" />
                <span className="text-sm text-bone-dim">Uploading to library...</span>
              </>
            ) : (
              <>
                <i className="ti ti-cloud-upload text-2xl text-muted" />
                <span className="text-sm text-bone-dim">
                  Click to upload a {imageType} image
                </span>
                <span className="text-xs text-muted">PNG, JPG up to 10MB</span>
              </>
            )}
          </label>
        </div>
      )}

      {/* Library tab */}
      {tab === "library" && (
        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <i className="ti ti-loader-2 animate-spin text-xl text-vermillion" />
            </div>
          ) : libraryImages.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line py-12 text-center text-sm text-bone-dim">
              No {imageType} images in library yet.
              <br />
              <span className="text-xs text-muted">Upload one from the Upload tab, or generate in a stage.</span>
            </div>
          ) : (() => {
            const starred = libraryImages.filter(img => img.starred);
            const rest = libraryImages.filter(img => !img.starred);
            return (
              <div className="space-y-4">
                {starred.length > 0 && (
                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <i className="ti ti-star-filled text-xs text-amber-400" />
                      <span className="text-[11px] font-bold uppercase tracking-widest text-amber-400">Starred</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                      {starred.map((img) => (
                        <button
                          key={img.id}
                          onClick={() => setSelectedId(img.id)}
                          className={`group relative overflow-hidden rounded-xl border-2 transition-all ${
                            selectedId === img.id
                              ? "border-vermillion ring-2 ring-vermillion/30"
                              : "border-amber-400/60 hover:border-amber-400"
                          }`}
                        >
                          <div className="aspect-square bg-ink-soft">
                            <img
                              src={img.url}
                              alt={img.image_code}
                              className="h-full w-full object-contain"
                              loading="lazy"
                            />
                          </div>
                          <div className="px-2 py-1.5">
                            <span className="font-mono text-[10px] text-muted">
                              {img.image_code.split("_").slice(-2).join("_")}
                            </span>
                          </div>
                          {selectedId === img.id && (
                            <div className="absolute inset-0 flex items-center justify-center bg-vermillion/10">
                              <i className="ti ti-check rounded-full bg-vermillion p-1.5 text-ink" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {rest.length > 0 && (
                  <div>
                    {starred.length > 0 && (
                      <div className="mb-2 flex items-center gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-widest text-muted">All</span>
                      </div>
                    )}
                    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                      {rest.map((img) => (
                        <button
                          key={img.id}
                          onClick={() => setSelectedId(img.id)}
                          className={`group relative overflow-hidden rounded-xl border-2 transition-all ${
                            selectedId === img.id
                              ? "border-vermillion ring-2 ring-vermillion/30"
                              : img.liked
                                ? "border-green-500/60 hover:border-green-500"
                                : "border-line hover:border-vermillion/30"
                          }`}
                        >
                          <div className="aspect-square bg-ink-soft">
                            <img
                              src={img.url}
                              alt={img.image_code}
                              className="h-full w-full object-contain"
                              loading="lazy"
                            />
                          </div>
                          <div className="px-2 py-1.5">
                            <span className="font-mono text-[10px] text-muted">
                              {img.image_code.split("_").slice(-2).join("_")}
                            </span>
                          </div>
                          {img.liked && (
                            <div className="absolute right-1 top-1 rounded-full bg-green-500 px-1.5 py-0.5">
                              <span className="text-[7px] font-bold uppercase text-white">Selected</span>
                            </div>
                          )}
                          {selectedId === img.id && (
                            <div className="absolute inset-0 flex items-center justify-center bg-vermillion/10">
                              <i className="ti ti-check rounded-full bg-vermillion p-1.5 text-ink" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Footer actions */}
      {tab === "library" && selectedId && (
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleSelectFromLibrary}
            className="rounded-full bg-vermillion px-5 py-2 text-sm font-medium text-ink transition-colors hover:bg-vermillion-soft"
          >
            Use Selected
          </button>
        </div>
      )}
    </Modal>
  );
}
