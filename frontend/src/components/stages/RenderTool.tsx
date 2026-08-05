import { useState, useCallback, useEffect } from "react";
import { ImagePickerModal } from "../ImagePickerModal";
import { API_BASE } from "../../api/client";
import { listImagesForGarment } from "../../api/designImages";
import type { Garment, Season, DesignImage } from "../../types";

export interface RenderFabricSlot {
  image: DesignImage | null;
  placements: string[];
  prompt: string;
  scale: number;
}

export interface RenderState {
  sketchImage: DesignImage | null;
  gender: string;
  fabrics: RenderFabricSlot[];
  numOutputs: number;
}

interface RenderToolProps {
  garment: Garment;
  season: Season;
  onGenerated: (image: DesignImage) => void;
  onStateChange?: (state: Partial<RenderState>) => void;
  onStartGenerating?: (count: number) => void;
}

const GENDER_OPTIONS = [
  { value: "male", label: "Male", icon: "ti-user" },
  { value: "female", label: "Female", icon: "ti-user" },
  { value: "unisex", label: "Unisex", icon: "ti-users" },
];

const PLACEMENT_OPTIONS = [
  { value: "All-over", label: "All-over" },
  { value: "Chest", label: "Chest" },
  { value: "Back", label: "Back" },
  { value: "Hem", label: "Hem" },
  { value: "Sleeve", label: "Sleeve" },
  { value: "Waistband", label: "Waistband" },
  { value: "Pocket facing", label: "Pocket facing" },
  { value: "Yoke", label: "Yoke" },
  { value: "Collar", label: "Collar" },
  { value: "Cuff", label: "Cuff" },
  { value: "Placket", label: "Placket" },
];

const MAX_FABRICS = 3;

export function RenderTool({ garment, season, onGenerated, onStateChange, onStartGenerating }: RenderToolProps) {
  // Sketch state
  const [sketchImage, setSketchImage] = useState<DesignImage | null>(null);

  // Fetch liked sketch from previous stage
  useEffect(() => {
    if (!garment?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const liked = await listImagesForGarment(garment.id, { node_key: "sketch", liked: true });
        if (!cancelled && liked.length > 0 && !sketchImage) {
          setSketchImage(liked[0]);
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [garment?.id]);

  // Gender
  const [gender, setGender] = useState("male");

  // Fabric slots (up to 3)
  const [fabrics, setFabrics] = useState<RenderFabricSlot[]>([
    { image: null, placements: [], prompt: "", scale: 1.0 },
  ]);

  // Fetch liked print for first fabric slot
  useEffect(() => {
    if (!garment?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const liked = await listImagesForGarment(garment.id, { node_key: "print", liked: true });
        if (!cancelled && liked.length > 0) {
          setFabrics(prev => {
            if (prev[0]?.image) return prev;
            const next = [...prev];
            next[0] = { ...next[0], image: liked[0] };
            return next;
          });
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [garment?.id]);

  // Output quantity
  const [numOutputs, setNumOutputs] = useState(1);

  // UI state
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");

  // Modal state
  const [sketchPickerOpen, setSketchPickerOpen] = useState(false);
  const [fabricPickerIndex, setFabricPickerIndex] = useState<number | null>(null);

  // Notify parent of state changes
  const notifyStateChange = useCallback(() => {
    onStateChange?.({
      sketchImage,
      gender,
      fabrics,
      numOutputs,
    });
  }, [sketchImage, gender, fabrics, numOutputs, onStateChange]);

  // ─── Sketch picker handlers ───────────────────────────────────────

  const handleSketchSelect = useCallback((image: DesignImage) => {
    setSketchImage(image);
    setTimeout(notifyStateChange, 0);
  }, [notifyStateChange]);

  // ─── Fabric slot handlers ─────────────────────────────────────────

  const handleFabricSelect = useCallback((image: DesignImage) => {
    if (fabricPickerIndex === null) return;
    setFabrics(prev => {
      const next = [...prev];
      next[fabricPickerIndex] = { ...next[fabricPickerIndex], image };
      return next;
    });
    setFabricPickerIndex(null);
    setTimeout(notifyStateChange, 0);
  }, [fabricPickerIndex, notifyStateChange]);

  const addFabricSlot = useCallback(() => {
    if (fabrics.length >= MAX_FABRICS) return;
    setFabrics(prev => [...prev, { image: null, placements: [], prompt: "", scale: 1.0 }]);
  }, [fabrics.length]);

  const removeFabricSlot = useCallback((index: number) => {
    setFabrics(prev => prev.filter((_, i) => i !== index));
    setTimeout(notifyStateChange, 0);
  }, [notifyStateChange]);

  const togglePlacement = useCallback((fabricIndex: number, placement: string) => {
    setFabrics(prev => {
      const next = [...prev];
      const slot = next[fabricIndex];
      const placements = slot.placements.includes(placement)
        ? slot.placements.filter(p => p !== placement)
        : [...slot.placements, placement];
      next[fabricIndex] = { ...slot, placements };
      return next;
    });
    setTimeout(notifyStateChange, 0);
  }, [notifyStateChange]);

  const updateFabricPrompt = useCallback((fabricIndex: number, prompt: string) => {
    setFabrics(prev => {
      const next = [...prev];
      next[fabricIndex] = { ...next[fabricIndex], prompt };
      return next;
    });
    setTimeout(notifyStateChange, 0);
  }, [notifyStateChange]);

  const updateFabricScale = useCallback((fabricIndex: number, scale: number) => {
    setFabrics(prev => {
      const next = [...prev];
      next[fabricIndex] = { ...next[fabricIndex], scale };
      return next;
    });
    setTimeout(notifyStateChange, 0);
  }, [notifyStateChange]);

  // ─── Generate ─────────────────────────────────────────────────────

  const handleGenerate = async () => {
    onStartGenerating?.(numOutputs);
    if (!sketchImage) {
      setError("Please select a sketch first");
      return;
    }

    const validFabrics = fabrics.filter(f => f.image !== null);
    if (validFabrics.length === 0) {
      setError("Please add at least one fabric");
      return;
    }

    setError(null);
    setIsGenerating(true);

    try {
      const res = await fetch(`${API_BASE}/api/garments/${garment.id}/nodes/render/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sketch_image: sketchImage.url,
          sketch_image_id: sketchImage.id,
          gender,
          num_outputs: numOutputs,
          fabrics: validFabrics.map(f => ({
            image_url: f.image!.url,
            image_id: f.image!.id,
            placements: f.placements,
            prompt: f.prompt,
            scale: f.scale,
          })),
          note,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Generation failed" }));
        throw new Error(err.detail || "Render generation failed");
      }

      const data = await res.json();
      if (data.success && data.images?.length > 0) {
        // Return first image as DesignImage
        onGenerated(data.images[0]);
      }
    } catch (e: any) {
      setError(e.message || "Generation failed");
    } finally {
      setIsGenerating(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <aside className="flex h-full w-full flex-col overflow-y-auto bg-surface p-6 lg:w-[480px]">
      {/* 1. Sketch */}
      <Section label="1. Sketch" required>
        {sketchImage ? (
          <div className="relative">
            <img
              src={sketchImage.url}
              alt="Sketch"
              className="h-32 w-full rounded-lg border border-line object-contain"
            />
            <button
              onClick={() => setSketchImage(null)}
              className="absolute right-2 top-2 rounded-full bg-ink/80 p-1 text-muted hover:text-bone"
            >
              <i className="ti ti-x text-sm" />
            </button>
            <div className="mt-1.5 font-mono text-[11px] text-muted">
              {sketchImage.image_code}
            </div>
          </div>
        ) : (
          <button
            onClick={() => setSketchPickerOpen(true)}
            className="flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed border-line bg-ink-soft p-6 transition-colors hover:border-accent/30"
          >
            <i className="ti ti-pencil-ruler text-2xl text-muted" />
            <span className="text-sm text-muted">Choose Sketch</span>
            <span className="text-[11px] text-muted">Upload or pick from library</span>
          </button>
        )}
      </Section>

      {/* 2. Gender */}
      <Section label="2. Gender">
        <div className="flex gap-2">
          {GENDER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setGender(opt.value)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-all ${
                gender === opt.value
                  ? "border-accent bg-accent/15 font-semibold text-accent"
                  : "border-line bg-ink-soft text-muted hover:border-accent/30"
              }`}
            >
              <i className={`ti ${opt.icon}`} />
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      </Section>

      {/* 3. Fabrics */}
      <Section label="3. Fabrics" hint={`${fabrics.filter(f => f.image).length}/${MAX_FABRICS}`}>
        <div className="flex flex-col gap-4">
          {fabrics.map((slot, idx) => (
            <FabricSlotCard
              key={idx}
              index={idx}
              slot={slot}
              onPickImage={() => setFabricPickerIndex(idx)}
              onRemove={() => removeFabricSlot(idx)}
              onTogglePlacement={(placement) => togglePlacement(idx, placement)}
              onPromptChange={(prompt) => updateFabricPrompt(idx, prompt)}
              onScaleChange={(scale) => updateFabricScale(idx, scale)}
              canRemove={fabrics.length > 1}
            />
          ))}
        </div>
        {fabrics.length < MAX_FABRICS && (
          <button
            onClick={addFabricSlot}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-line py-2 text-sm text-muted transition-colors hover:border-accent/30 hover:text-bone-dim"
          >
            <i className="ti ti-plus" />
            Add Fabric
          </button>
        )}
      </Section>

      {/* 4. Trims (disabled) */}
      <Section label="4. Trims" hint="Coming Soon">
        <div className="rounded-lg border border-line bg-ink-soft p-4 text-center">
          <i className="ti ti-scissors text-xl text-muted" />
          <p className="mt-1.5 text-sm text-muted">Trims selection coming soon</p>
        </div>
      </Section>

      {/* 5. Note */}
      <Section label="5. Note">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 250))}
          placeholder="Optional note..."
          className="w-full rounded-lg border border-line bg-ink-soft px-3 py-2.5 text-sm text-bone placeholder:text-muted focus:border-accent/60 focus:outline-none"
        />
      </Section>

      {/* Error */}
      {error && (
        <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* 5. Generate */}
      <div className="mt-auto flex flex-col gap-3 border-t border-line pt-4">
        {/* Output quantity */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-wide text-muted">Outputs</span>
          <div className="flex gap-1">
            {[1, 2, 4].map(n => (
              <button
                key={n}
                onClick={() => setNumOutputs(n)}
                className={`rounded px-3 py-1 text-sm transition-all ${
                  numOutputs === n
                    ? "bg-accent text-ink font-semibold"
                    : "bg-ink-soft text-muted hover:text-bone-dim"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={isGenerating || !sketchImage || fabrics.every(f => !f.image)}
          className={`flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold uppercase tracking-wider transition-all ${
            !sketchImage || fabrics.every(f => !f.image)
              ? "cursor-not-allowed bg-line text-muted"
              : "bg-accent text-ink hover:bg-accent-soft"
          }`}
        >
          {isGenerating ? (
            <>
              <i className="ti ti-loader-2 animate-spin" />
              <span>Generating Render...</span>
            </>
          ) : (
            <>
              <i className="ti ti-sparkles" />
              <span>Generate Render</span>
            </>
          )}
        </button>
      </div>

      {/* Image Pickers */}
      <ImagePickerModal
        open={sketchPickerOpen}
        onClose={() => setSketchPickerOpen(false)}
        onSelect={handleSketchSelect}
        seasonId={season.id}
        imageType="sketch"
        title="Choose Sketch"
      />

      <ImagePickerModal
        open={fabricPickerIndex !== null}
        onClose={() => setFabricPickerIndex(null)}
        onSelect={handleFabricSelect}
        seasonId={season.id}
        imageType="fabric"
        title="Choose Fabric"
      />
    </aside>
  );
}

// ─── Fabric Slot Card ──────────────────────────────────────────────

function FabricSlotCard({
  index,
  slot,
  onPickImage,
  onRemove,
  onTogglePlacement,
  onPromptChange,
  onScaleChange,
  canRemove,
}: {
  index: number;
  slot: RenderFabricSlot;
  onPickImage: () => void;
  onRemove: () => void;
  onTogglePlacement: (placement: string) => void;
  onPromptChange: (prompt: string) => void;
  onScaleChange: (scale: number) => void;
  canRemove: boolean;
}) {
  return (
    <div className="rounded-lg border border-line bg-ink-soft p-3">
      {/* Header */}
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-accent">
          Fabric #{index + 1}
        </span>
        {canRemove && (
          <button onClick={onRemove} className="text-muted hover:text-red-400">
            <i className="ti ti-trash text-sm" />
          </button>
        )}
      </div>

      {/* Image picker */}
      {slot.image ? (
        <div className="relative mb-2.5">
          <img
            src={slot.image.url}
            alt={`Fabric ${index + 1}`}
            className="h-20 w-full rounded border border-line object-contain"
          />
          <button
            onClick={onPickImage}
            className="absolute right-1.5 top-1.5 rounded bg-ink/80 p-1 text-muted hover:text-bone"
          >
            <i className="ti ti-pencil text-[11px]" />
          </button>
          <div className="mt-1 font-mono text-[9px] text-muted">
            {slot.image.image_code}
          </div>
        </div>
      ) : (
        <button
          onClick={onPickImage}
          className="mb-2.5 flex w-full items-center justify-center gap-2 rounded border-2 border-dashed border-line py-4 text-sm text-muted transition-colors hover:border-accent/30"
        >
          <i className="ti ti-upload" />
          Pick Fabric
        </button>
      )}

      {/* Placement chips */}
      <div className="mb-2.5">
        <label className="mb-1.5 block text-[9px] uppercase tracking-wide text-muted">
          Placement
        </label>
        <div className="flex flex-wrap gap-1.5">
          {PLACEMENT_OPTIONS.map((p) => (
            <button
              key={p.value}
              onClick={() => onTogglePlacement(p.value)}
              className={`rounded-full px-3 py-1.5 text-[11px] font-medium transition-all ${
                slot.placements.includes(p.value)
                  ? "bg-accent/20 text-accent border border-accent/40"
                  : "bg-ink-soft text-muted border border-line hover:border-accent/30"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Scale slider */}
      <div className="mb-2.5">
        <div className="mb-1 flex justify-between">
          <span className="text-[9px] uppercase tracking-wide text-muted">Scale</span>
          <span className="text-[11px] font-mono font-bold text-accent">{slot.scale.toFixed(1)}x</span>
        </div>
        <input
          type="range"
          min={0.5}
          max={2.0}
          step={0.1}
          value={slot.scale}
          onChange={(e) => onScaleChange(parseFloat(e.target.value))}
          className="w-full accent-accent"
        />
      </div>

      {/* Prompt */}
      <div>
        <label className="mb-1 block text-[9px] uppercase tracking-wide text-muted">
          Prompt
        </label>
        <input
          value={slot.prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          placeholder="e.g. Apply to chest pocket area..."
          className="w-full rounded border border-line bg-ink px-2.5 py-1.5 text-[11px] text-bone placeholder:text-muted focus:border-accent/60 focus:outline-none"
        />
      </div>
    </div>
  );
}

// ─── Helper components ─────────────────────────────────────────────

function Section({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6 border-t border-line pt-5 first:border-0 first:pt-0">
      <div className="mb-3 flex items-center gap-2">
        <label className="text-[13px] font-semibold uppercase tracking-widest text-accent">
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
        {hint && <span className="text-[11px] text-muted">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
