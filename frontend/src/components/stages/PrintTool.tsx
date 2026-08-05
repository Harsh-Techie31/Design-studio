import { useState, useRef, useEffect } from "react";
import { API_BASE } from "../../api/client";
import { removeMotifBackground } from "../../api/designImages";
import type { Garment, Season, DesignImage } from "../../types";

export interface PrintState {
  motifImage: string | null;
  processedMotifImage: string | null;
  motifFile: File | null;
  scale: number;
  rotation: number;
  spacingX: number;
  spacingY: number;
  repeatType: string;
  fabricType: string;
  bgColor: string;
  canvasSize: 1024 | 2048;
  isRemovingBg: boolean;
}

interface PrintToolProps {
  garment: Garment;
  season: Season;
  onGenerated: (image: DesignImage) => void;
  onStateChange?: (state: Partial<PrintState>) => void;
  canvasRef?: React.RefObject<HTMLCanvasElement | null>;
  onStartGenerating?: (count: number) => void;
}

const REPEAT_TYPES = [
  { value: "block", label: "Block", icon: "ti-grid-dots" },
  { value: "half-drop", label: "Half-Drop", icon: "ti-columns" },
  { value: "brick", label: "Brick", icon: "ti-layout-row" },
  { value: "mirror", label: "Mirror", icon: "ti-flip-vertical" },
];

const FABRIC_TYPES = [
  { value: "none", label: "None", desc: "No fabric texture" },
  { value: "cotton", label: "Cotton", desc: "Classic woven, breathable" },
  { value: "silk", label: "Silk", desc: "Luxurious, natural sheen" },
  { value: "linen", label: "Linen", desc: "Textured, relaxed" },
  { value: "denim", label: "Denim", desc: "Twill weave, sturdy" },
  { value: "satin", label: "Satin", desc: "Glossy surface" },
  { value: "chiffon", label: "Chiffon", desc: "Sheer, lightweight" },
  { value: "twill", label: "Twill", desc: "Diagonal rib pattern" },
  { value: "velvet", label: "Velvet", desc: "Soft pile, rich texture" },
  { value: "wool", label: "Wool", desc: "Warm, natural fiber" },
  { value: "poplin", label: "Poplin", desc: "Fine horizontal ribs" },
];

export function PrintTool({ garment, season, onGenerated, onStateChange, canvasRef, onStartGenerating }: PrintToolProps) {
  // Motif state
  const [motifImage, setMotifImage] = useState<string | null>(null);
  const [processedMotifImage, setProcessedMotifImage] = useState<string | null>(null);
  const [motifFile, setMotifFile] = useState<File | null>(null);

  // Real-time controls
  const [scale, setScale] = useState(1.0);
  const [rotation, setRotation] = useState(0);
  const [spacingX, setSpacingX] = useState(0);
  const [spacingY, setSpacingY] = useState(0);
  const [repeatType, setRepeatType] = useState("block");

  // AI params
  const [fabricType, setFabricType] = useState("cotton");
  const [bgColor, setBgColor] = useState("#ffffff");
  const [canvasSize, setCanvasSize] = useState<1024 | 2048>(1024);

  // UI state
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRemovingBg, setIsRemovingBg] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Moodboard palette from season analysis
  const moodboardPalette = season.moodboard.analysis.palette || [];

  // Notify parent of state changes
  useEffect(() => {
    onStateChange?.({
      motifImage,
      processedMotifImage,
      motifFile,
      scale,
      rotation,
      spacingX,
      spacingY,
      repeatType,
      fabricType,
      bgColor,
      canvasSize,
      isRemovingBg,
    });
  }, [
    motifImage,
    processedMotifImage,
    motifFile,
    scale,
    rotation,
    spacingX,
    spacingY,
    repeatType,
    fabricType,
    bgColor,
    canvasSize,
    isRemovingBg,
    onStateChange,
  ]);

  // ─── File upload ──────────────────────────────────────────────────

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError("File exceeds 10MB limit");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file (JPG, PNG, or WebP)");
      return;
    }
    if (file.type === "image/svg+xml") {
      setError("SVG files are not supported. Please use JPG, PNG, or WebP");
      return;
    }

    setError(null);
    setMotifFile(file);
    setProcessedMotifImage(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      setMotifImage(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // ─── Remove background ───────────────────────────────────────────

  const handleRemoveBackground = async () => {
    if (!motifImage) return;
    setError(null);
    setIsRemovingBg(true);
    try {
      const result = await removeMotifBackground(motifImage);
      if (result.image) {
        setProcessedMotifImage(result.image);
      }
    } catch {
      setError("Motif not suitable for background removal. Continuing with original image.");
    } finally {
      setIsRemovingBg(false);
    }
  };

  // ─── Export canvas to base64 ──────────────────────────────────────

  const exportCanvasToBase64 = (): string | null => {
    const canvas = canvasRef?.current;
    if (!canvas) return null;
    return canvas.toDataURL("image/png");
  };

  // ─── Generate ─────────────────────────────────────────────────────

  const handleGenerate = async () => {
    onStartGenerating?.(1);
    if (!motifImage) {
      setError("Please upload a motif image first");
      return;
    }

    setError(null);
    setIsGenerating(true);

    try {
      // Export canvas state as base64 image
      const canvasBase64 = exportCanvasToBase64();

      const res = await fetch(`${API_BASE}/api/garments/${garment.id}/nodes/print/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canvas_image: canvasBase64,
          fabric_type: fabricType,
          background_color: bgColor,
          canvas_width: canvasSize,
          canvas_height: canvasSize,
          scale,
          repeat_type: repeatType,
          spacing_x: spacingX,
          spacing_y: spacingY,
          rotation,
          note,
          moodboard_palette: moodboardPalette,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Generation failed" }));
        throw new Error(err.detail || "Print generation failed");
      }

      const data = await res.json();
      if (data.success && data.image) {
        onGenerated(data.image);
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
      {/* 1. Upload Motif */}
      <Section label="1. Upload Motif" required>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
        />
        {motifImage ? (
          <div className="relative">
            <img
              src={motifImage}
              alt="Motif"
              className="h-32 w-full rounded-lg border border-line object-contain"
            />
            <button
              onClick={() => {
                setMotifImage(null);
                setMotifFile(null);
              }}
              className="absolute right-2 top-2 rounded-full bg-ink/80 p-1 text-muted hover:text-bone"
            >
              <i className="ti ti-x text-sm" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed border-line bg-ink-soft p-6 transition-colors hover:border-accent/30"
          >
            <i className="ti ti-upload text-2xl text-muted" />
            <span className="text-sm text-muted">Click to upload motif</span>
            <span className="text-[11px] text-muted">JPG, PNG, max 10MB</span>
          </button>
        )}
      </Section>

      {/* Remove Background */}
      {motifImage && (
        <div className="mb-6 border-t border-line pt-5">
          <button
            onClick={handleRemoveBackground}
            disabled={isRemovingBg}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-line bg-ink-soft px-4 py-2.5 text-sm text-muted transition-all hover:border-accent/40 hover:text-bone disabled:opacity-50"
          >
            {isRemovingBg ? (
              <>
                <i className="ti ti-loader-2 animate-spin" />
                <span>Removing background...</span>
              </>
            ) : (
              <>
                <i className="ti ti-eraser" />
                <span>Remove Background</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* 2. Real-time Controls */}
      <Section label="2. Pattern Controls" hint="Real-time">
        {/* Repeat Type */}
        <div className="mb-4">
          <label className="mb-2 block text-[11px] uppercase tracking-wide text-muted">
            Repeat Type
          </label>
          <div className="grid grid-cols-2 gap-2">
            {REPEAT_TYPES.map((rt) => (
              <button
                key={rt.value}
                onClick={() => setRepeatType(rt.value)}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all ${
                  repeatType === rt.value
                    ? "border-accent bg-accent/15 font-semibold text-accent"
                    : "border-line bg-ink-soft text-muted hover:border-accent/30"
                }`}
              >
                <i className={`ti ${rt.icon} text-sm`} />
                <span>{rt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Scale */}
        <SliderControl
          label="Scale"
          value={scale}
          onChange={setScale}
          min={0.05}
          max={4.0}
          step={0.05}
          displayValue={`${scale.toFixed(2)}x`}
        />

        {/* Rotation */}
        <SliderControl
          label="Rotation"
          value={rotation}
          onChange={setRotation}
          min={0}
          max={360}
          step={1}
          displayValue={`${rotation}°`}
        />

        {/* H-Gap */}
        <SliderControl
          label="H-Gap"
          value={spacingX}
          onChange={setSpacingX}
          min={-100}
          max={100}
          step={1}
          displayValue={`${spacingX}px`}
        />

        {/* V-Gap */}
        <SliderControl
          label="V-Gap"
          value={spacingY}
          onChange={setSpacingY}
          min={-100}
          max={100}
          step={1}
          displayValue={`${spacingY}px`}
        />
      </Section>

      {/* 3. AI Layer */}
      <Section label="3. AI Layer" hint="Fabric & Color">
        {/* Fabric Type */}
        <div className="mb-4">
          <label className="mb-2 block text-[11px] uppercase tracking-wide text-muted">
            Fabric Background
          </label>
          <select
            value={fabricType}
            onChange={(e) => setFabricType(e.target.value)}
            className="w-full rounded-lg border border-line bg-ink-soft px-3 py-2 text-sm text-bone focus:border-accent/60 focus:outline-none"
          >
            {FABRIC_TYPES.map((ft) => (
              <option key={ft.value} value={ft.value}>
                {ft.label} — {ft.desc}
              </option>
            ))}
          </select>
        </div>

        {/* Background Color */}
        <div className="mb-4">
          <label className="mb-2 block text-[11px] uppercase tracking-wide text-muted">
            Background Color
          </label>

          {/* Color picker + hex input row */}
          <div className="mb-3 flex items-center gap-2">
            <div className="relative">
              <input
                type="color"
                value={bgColor}
                onChange={(e) => setBgColor(e.target.value)}
                className="absolute h-8 w-8 cursor-pointer opacity-0"
              />
              <div
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-line"
                style={{ backgroundColor: bgColor }}
              >
                <i className="ti ti-palette text-sm text-muted" />
              </div>
            </div>
            <input
              type="text"
              value={bgColor}
              onChange={(e) => setBgColor(e.target.value)}
              className="flex-1 rounded-lg border border-line bg-ink-soft px-3 py-2 font-mono text-sm text-bone focus:border-accent/60 focus:outline-none"
              placeholder="#ffffff"
            />
          </div>

          {/* Moodboard palette */}
          {moodboardPalette.length > 0 && (
            <div>
              <label className="mb-1.5 block text-[11px] uppercase text-muted">
                Moodboard Palette
              </label>
              <div className="flex flex-wrap gap-2">
                {moodboardPalette.map((color, i) => (
                  <button
                    key={i}
                    onClick={() => setBgColor(color)}
                    className={`h-7 w-7 rounded-lg border-2 transition-all ${
                      bgColor === color
                        ? "border-accent scale-110"
                        : "border-line hover:border-accent/30"
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Export Resolution */}
        <div className="mb-4">
          <label className="mb-2 block text-[11px] uppercase tracking-wide text-muted">
            Export Resolution
          </label>
          <div className="flex gap-2">
            {[
              { value: 1024 as const, label: "1K", sublabel: "1024px" },
              { value: 2048 as const, label: "2K", sublabel: "2048px" },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setCanvasSize(opt.value)}
                className={`flex flex-1 flex-col items-center rounded-lg border px-3 py-2 transition-all ${
                  canvasSize === opt.value
                    ? "border-accent bg-accent/15 font-semibold text-accent"
                    : "border-line bg-ink-soft text-muted hover:border-accent/30"
                }`}
              >
                <span className="text-sm font-bold">{opt.label}</span>
                <span className="text-[11px]">{opt.sublabel}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Note */}
        <div>
          <label className="mb-1 block text-[11px] uppercase text-muted">Note</label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 250))}
            placeholder="Optional note..."
            className="w-full rounded-lg border border-line bg-ink-soft px-3 py-2 text-sm text-bone placeholder:text-muted focus:border-accent/60 focus:outline-none"
          />
        </div>
      </Section>

      {/* Error */}
      {error && (
        <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* 4. Generate */}
      <div className="mt-auto flex flex-col gap-3 border-t border-line pt-4">
        <button
          onClick={handleGenerate}
          disabled={isGenerating || !motifImage}
          className={`flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold uppercase tracking-wider transition-all ${
            !motifImage
              ? "cursor-not-allowed bg-line text-muted"
              : "bg-accent text-ink hover:bg-accent-soft"
          }`}
        >
          {isGenerating ? (
            <>
              <i className="ti ti-loader-2 animate-spin" />
              <span>Generating with AI...</span>
            </>
          ) : (
            <>
              <i className="ti ti-sparkles" />
              <span>Generate Print</span>
            </>
          )}
        </button>
      </div>
    </aside>
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

function SliderControl({
  label,
  value,
  onChange,
  min,
  max,
  step,
  displayValue,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  displayValue: string;
}) {
  return (
    <div className="mb-3">
      <div className="mb-1 flex justify-between">
        <span className="text-[11px] uppercase tracking-wide text-muted">{label}</span>
        <span className="text-[11px] font-mono font-bold text-accent">{displayValue}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-accent"
      />
    </div>
  );
}
