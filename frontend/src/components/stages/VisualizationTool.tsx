import { useState } from "react";
import { ImagePickerModal } from "../ImagePickerModal";
import { generateVisualization } from "../../api/designImages";
import type { Garment, Season, DesignImage } from "../../types";

interface VisualizationToolProps {
  garment: Garment;
  season: Season;
  onGenerated: (image: DesignImage) => void;
  onStartGenerating?: (count: number) => void;
}

const MODEL_OPTIONS = [
  { value: "Model A", label: "Model A", specs: "Male • 6'0\" • Slim • UK Large" },
  { value: "Model B", label: "Model B", specs: "Female • 5'8\" • Slim • UK Large" },
];

const BACKGROUND_OPTIONS = ["Plain studio", "Outdoor", "Indoor"];
const LIGHTING_OPTIONS = ["Soft", "Dramatic", "Natural"];
const ASPECT_RATIO_OPTIONS = [
  { value: "1:1", label: "1:1 Square", width: 1024, height: 1024 },
  { value: "4:5", label: "4:5 Portrait", width: 1024, height: 1280 },
  { value: "16:9", label: "16:9 Landscape", width: 1280, height: 720 },
];

export function VisualizationTool({ garment, season, onGenerated, onStartGenerating }: VisualizationToolProps) {
  const category = garment.category || "SHIRT";

  const [renderImage, setRenderImage] = useState<DesignImage | null>(null);
  const [renderPickerOpen, setRenderPickerOpen] = useState(false);

  const [modelAvatar, setModelAvatar] = useState("Model A");
  const [background, setBackground] = useState(BACKGROUND_OPTIONS[0]);
  const [lighting, setLighting] = useState(LIGHTING_OPTIONS[0]);
  const [aspectRatio, setAspectRatio] = useState(ASPECT_RATIO_OPTIONS[0].value);
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [numOutputs, setNumOutputs] = useState(1);

  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    onStartGenerating?.(numOutputs);
    if (!renderImage) {
      setError("Please select a render first");
      return;
    }
    setError(null);
    setIsGenerating(true);

    const params = {
      render_image_url: renderImage.id,
      model_avatar: modelAvatar,
      background,
      lighting,
      aspect_ratio: aspectRatio,
      additional_notes: additionalNotes,
      num_outputs: numOutputs,
    };

    console.log("[VIZ] ─── Generate clicked ───");
    console.log("[VIZ] garment:", { id: garment.id, name: garment.name, category: garment.category });
    console.log("[VIZ] season:", { id: season.id, code: season.code });
    console.log("[VIZ] renderImage:", { id: renderImage.id, image_code: renderImage.image_code, url: renderImage.url?.substring(0, 80) });
    console.log("[VIZ] params:", JSON.stringify(params, null, 2));

    try {
      console.log("[VIZ] Calling generateVisualization API...");
      const result = await generateVisualization(garment.id, params);
      console.log("[VIZ] API response:", { success: result.success, imageCount: result.images?.length, model_avatar: result.model_avatar });
      console.log("[VIZ] run:", result.run);
      if (result.images?.length > 0) {
        console.log("[VIZ] images:", result.images.map((img: any) => ({ id: img.id, code: img.image_code, source: img.source, ai_model: img.ai_model })));
      }
      if (result.success && result.images?.length > 0) {
        onGenerated(result.images[0] as unknown as DesignImage);
      } else {
        console.warn("[VIZ] No images returned in response");
      }
    } catch (e: any) {
      console.error("[VIZ] Generation failed:", e.message, e);
      setError(e.message || "Generation failed");
    } finally {
      setIsGenerating(false);
      console.log("[VIZ] ─── Generate finished ───");
    }
  };

  return (
    <aside className="flex h-full w-full flex-col overflow-y-auto bg-surface p-6 lg:w-[480px]">
      {/* Section A: Badges */}
      <Section label="A. Badges">
        <div className="flex flex-wrap gap-2">
          <Badge icon="ti-hanger" label="Category" value={category} />
        </div>
      </Section>

      {/* Section B: Render Reference */}
      <Section label="B. Render Reference" required>
        {renderImage ? (
          <div className="relative">
            <img
              src={renderImage.url}
              alt="Selected render"
              className="h-32 w-full rounded-lg border border-line object-contain"
            />
            <button
              onClick={() => setRenderPickerOpen(true)}
              className="absolute right-2 top-2 rounded bg-ink/80 p-1 text-muted hover:text-bone"
            >
              <i className="ti ti-pencil text-[11px]" />
            </button>
            <div className="mt-1.5 font-mono text-[11px] text-muted">{renderImage.image_code}</div>
            <button onClick={() => setRenderPickerOpen(true)} className="mt-1 text-[11px] text-brass hover:text-brass-soft">
              Switch render
            </button>
          </div>
        ) : (
          <button
            onClick={() => setRenderPickerOpen(true)}
            className="flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed border-line bg-ink-soft p-6 transition-colors hover:border-brass/30"
          >
            <i className="ti ti-photo text-2xl text-muted" />
            <span className="text-sm text-muted">Choose Render</span>
            <span className="text-[11px] text-muted">Pick from library</span>
          </button>
        )}
      </Section>

      {/* Section C: Model */}
      <Section label="C. Model">
        <div className="grid grid-cols-2 gap-2.5">
          {MODEL_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setModelAvatar(opt.value)}
              className={`rounded-lg border p-3.5 text-center transition-all ${
                modelAvatar === opt.value
                  ? "border-brass bg-brass/15 text-bone"
                  : "border-line bg-ink-soft text-muted hover:border-brass/30"
              }`}
            >
              <i className="ti ti-user mx-auto mb-2 block text-lg" />
              <span className="block text-xs font-semibold">{opt.label}</span>
              <span className="mt-1 block text-[9px] leading-relaxed text-muted">{opt.specs}</span>
            </button>
          ))}
        </div>
      </Section>

      {/* Section D: Environment */}
      <Section label="D. Environment">
        <ChipGroup label="Background" options={BACKGROUND_OPTIONS} selected={background} onSelect={setBackground} />
        <ChipGroup label="Lighting" options={LIGHTING_OPTIONS} selected={lighting} onSelect={setLighting} />
      </Section>

      {/* Section E: Aspect Ratio */}
      <Section label="E. Aspect Ratio">
        <div className="flex flex-wrap gap-2">
          {ASPECT_RATIO_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setAspectRatio(opt.value)}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 transition-all ${
                aspectRatio === opt.value
                  ? "border-brass/60 bg-brass/10 text-brass"
                  : "border-line bg-ink-soft text-muted hover:border-brass/20"
              }`}
            >
              <div
                className={`border ${
                  aspectRatio === opt.value ? "border-brass/60" : "border-muted/40"
                }`}
                style={{
                  width: opt.value === "1:1" ? 16 : opt.value === "4:5" ? 12 : 20,
                  height: opt.value === "1:1" ? 16 : opt.value === "4:5" ? 15 : 11,
                }}
              />
              <span className="text-xs font-medium">{opt.label}</span>
            </button>
          ))}
        </div>
      </Section>

      {/* Section F: Additional Notes */}
      <Section label="F. Additional Notes">
        <textarea
          value={additionalNotes}
          onChange={(e) => {
            if (e.target.value.length <= 200) setAdditionalNotes(e.target.value);
          }}
          maxLength={200}
          placeholder="Any special notes for the 3D visualization..."
          className="w-full min-h-[60px] rounded-lg border border-line bg-ink-soft px-3 py-2 text-sm text-bone placeholder:text-muted focus:border-brass/60 focus:outline-none resize-none"
        />
        <div className={`text-right text-[11px] mt-1 ${additionalNotes.length > 180 ? "text-brass" : "text-muted"}`}>
          {additionalNotes.length}/200
        </div>
      </Section>

      {error && (
        <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-400">{error}</div>
      )}

      {/* Section F: Output Controls */}
      <div className="mt-auto flex flex-col gap-3 border-t border-line pt-4">
        <div className="flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-wide text-muted">Outputs</span>
          <div className="flex gap-1">
            {[1, 2, 3, 4].map((n) => (
              <button
                key={n}
                onClick={() => setNumOutputs(n)}
                className={`rounded px-3 py-1 text-sm transition-all ${
                  numOutputs === n ? "bg-brass text-ink font-semibold" : "bg-ink-soft text-muted hover:text-bone-dim"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={isGenerating || !renderImage}
          className={`flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold uppercase tracking-wider transition-all ${
            !renderImage ? "cursor-not-allowed bg-line text-muted" : "bg-brass text-ink hover:bg-brass-soft"
          }`}
        >
          {isGenerating ? (
            <>
              <i className="ti ti-loader-2 animate-spin" />
              <span>Generating Visualization...</span>
            </>
          ) : (
            <>
              <i className="ti ti-sparkles" />
              <span>Generate 3D Visualization</span>
            </>
          )}
        </button>
      </div>

      <ImagePickerModal
        open={renderPickerOpen}
        onClose={() => setRenderPickerOpen(false)}
        onSelect={(img) => {
          console.log("[VIZ] Render image selected:", { id: img.id, image_code: img.image_code, url: img.url?.substring(0, 80) });
          setRenderImage(img);
          setRenderPickerOpen(false);
        }}
        seasonId={season.id}
        imageType="render"
        title="Choose Render"
      />
    </aside>
  );
}

function Section({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="mb-6 border-t border-line pt-5 first:border-0 first:pt-0">
      <div className="mb-3 flex items-center gap-2">
        <label className="text-[13px] font-semibold uppercase tracking-widest text-brass">
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
      </div>
      {children}
    </div>
  );
}

function Badge({ icon, label, value }: { icon?: string; label?: string; value: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-ink-soft px-2.5 py-1.5 text-[11px] text-muted">
      {icon && <i className={`ti ${icon} text-sm`} />}
      {label && <span>{label}:</span>}
      <strong className="text-bone font-medium">{value}</strong>
    </div>
  );
}

function ChipGroup({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: string[];
  selected: string;
  onSelect: (v: string) => void;
}) {
  return (
    <div className="mb-3">
      <label className="mb-1.5 block text-[11px] uppercase tracking-wide text-muted">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => onSelect(opt)}
            className={`rounded-full px-2.5 py-1 text-[11px] transition-all ${
              selected === opt
                ? "bg-brass/20 text-brass border border-brass/40"
                : "bg-ink text-muted border border-line hover:border-brass/20"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}
