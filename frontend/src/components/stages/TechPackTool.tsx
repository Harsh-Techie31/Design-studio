import { useState, useCallback, useEffect } from "react";
import { ImagePickerModal } from "../ImagePickerModal";
import { generateTechPack, type TechPackGenerateResponse, getImage, listImagesForGarment } from "../../api/designImages";
import {
  CONSTRUCTION_OPTIONS,
  STITCH_OPTIONS,
  SEAM_OPTIONS,
  getDefaultMeasurements,
  BOM_FIELDS,
} from "../../data/techpackConfig";
import type { Garment, Season, DesignImage } from "../../types";

export interface TechPackState {
  selectedRender: DesignImage | null;
  construction: Record<string, string>;
  stitchType: string;
  seamType: string;
  bom: Record<string, string>;
  measurements: Record<string, number>;
  constructionNotes: string;
  numOutputs: number;
}

interface TechPackToolProps {
  garment: Garment;
  season: Season;
  onGenerated: (image: any) => void;
  onStateChange?: (state: Partial<TechPackState>) => void;
  renders: DesignImage[];
  onStartGenerating?: (count: number) => void;
}

export function TechPackTool({
  garment,
  season,
  onGenerated,
  onStateChange,
  renders,
  onStartGenerating,
}: TechPackToolProps) {
  // Selected render
  const [selectedRender, setSelectedRender] = useState<DesignImage | null>(null);
  const [renderPickerOpen, setRenderPickerOpen] = useState(false);

  // Construction (auto-select first option for each field)
  const [construction, setConstruction] = useState<Record<string, string>>({});

  // Stitch & Seam
  const [stitchType, setStitchType] = useState("Lockstitch");
  const [seamType, setSeamType] = useState("Plain seam");

  // BOM
  const [bom, setBom] = useState<Record<string, string>>({});

  // Measurements
  const [measurements, setMeasurements] = useState<Record<string, number>>({});

  // Construction notes
  const [constructionNotes, setConstructionNotes] = useState("");

  // Output
  const [numOutputs, setNumOutputs] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const category = garment.category || "SHIRT";

  // Initialize construction defaults when category changes
  useEffect(() => {
    const fields = CONSTRUCTION_OPTIONS[category] || [];
    const defaults: Record<string, string> = {};
    for (const f of fields) {
      defaults[f.field] = f.options[0];
    }
    setConstruction(defaults);
  }, [category]);

  // Initialize measurements when category/gender changes
  useEffect(() => {
    const gender = (selectedRender?.params?.gender as string) || "male";
    setMeasurements(getDefaultMeasurements(category, gender));
  }, [category, selectedRender]);

  // Auto-select: liked render from previous stage, or first render in picker
  useEffect(() => {
    if (selectedRender) return;
    let cancelled = false;
    (async () => {
      try {
        const liked = await listImagesForGarment(garment.id, { node_key: "render", liked: true });
        if (!cancelled && !selectedRender) {
          if (liked.length > 0) {
            setSelectedRender(liked[0]);
          } else if (renders.length > 0) {
            setSelectedRender(renders[0]);
          }
        }
      } catch {
        if (!cancelled && !selectedRender && renders.length > 0) {
          setSelectedRender(renders[0]);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [garment.id, renders]);

  // Fetch referenced images (sketch + fabrics) when render changes
  const [refImages, setRefImages] = useState<DesignImage[]>([]);
  useEffect(() => {
    if (!selectedRender) {
      setRefImages([]);
      return;
    }

    const fetchRefs = async () => {
      const validRefs = (selectedRender.input_images || []).filter(
        ref => /^[0-9a-fA-F]{24}$/.test(ref.image_id)
      );

      let refs: DesignImage[] = [];

      // Try lineage first
      if (validRefs.length > 0) {
        try {
          refs = await Promise.all(validRefs.map(ref => getImage(ref.image_id)));
        } catch { /* ignore */ }
      }

      // Fallback: look up by node_key for this garment
      if (refs.length === 0 && garment?.id) {
        try {
          const [sketches, prints] = await Promise.all([
            listImagesForGarment(garment.id, { node_key: "sketch" }),
            listImagesForGarment(garment.id, { node_key: "print" }),
          ]);
          const latestSketch = sketches.sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
          const latestPrints = prints.sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 3);
          if (latestSketch) refs.push(latestSketch);
          refs.push(...latestPrints);
        } catch { /* ignore */ }
      }

      setRefImages(refs);
    };

    fetchRefs();
  }, [selectedRender?.id, garment?.id]);

  // Auto-fill main fabric BOM from render's fabric refs
  useEffect(() => {
    if (selectedRender?.input_images) {
      // The render's input_images should have fabric references
      // For now, we'll set a placeholder
      setBom(prev => ({
        ...prev,
        "Main fabric": prev["Main fabric"] || "",
      }));
    }
  }, [selectedRender]);

  // Notify parent of state changes
  useEffect(() => {
    onStateChange?.({
      selectedRender,
      construction,
      stitchType,
      seamType,
      bom,
      measurements,
      constructionNotes,
      numOutputs,
    });
  }, [selectedRender, construction, stitchType, seamType, bom, measurements, constructionNotes, numOutputs, onStateChange]);

  // ─── Handlers ───────────────────────────────────────────────────

  const handleRenderSelect = useCallback((image: DesignImage) => {
    setSelectedRender(image);
    setRenderPickerOpen(false);
  }, []);

  const handleConstructionChange = useCallback((field: string, value: string) => {
    setConstruction(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleBomChange = useCallback((key: string, value: string) => {
    setBom(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleMeasurementChange = useCallback((field: string, value: number) => {
    setMeasurements(prev => ({ ...prev, [field]: value }));
  }, []);

  // ─── Generate ─────────────────────────────────────────────────────

  const handleGenerate = async () => {
    onStartGenerating?.(numOutputs);
    if (!selectedRender) {
      setError("Please select a render first");
      return;
    }

    setError(null);
    setIsGenerating(true);

    try {
      const result: TechPackGenerateResponse = await generateTechPack(garment.id, {
        render_image_id: selectedRender.id,
        gender: (selectedRender.params?.gender as string) || "male",
        construction,
        stitch_type: stitchType,
        seam_type: seamType,
        bom,
        measurements,
        construction_notes: constructionNotes,
        num_outputs: numOutputs,
        note,
      });

      if (result.success && result.image) {
        onGenerated(result.image);
      }
    } catch (e: any) {
      setError(e.message || "Generation failed");
    } finally {
      setIsGenerating(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────

  const constructionFields = CONSTRUCTION_OPTIONS[category] || [];
  const measureFields = Object.keys(measurements);

  return (
    <aside className="flex h-full w-full flex-col overflow-y-auto bg-surface p-6 lg:w-[480px]">
      {/* Section A: References */}
      <Section label="A. References from Previous Stages">
        {/* Render reference */}
        <div className="mb-3">
          <label className="mb-1.5 block text-[11px] uppercase tracking-wide text-muted">
            Render (Stage 3)
          </label>
          {selectedRender ? (
            <div className="relative">
              <img
                src={selectedRender.url}
                alt="Selected render"
                className="h-24 w-full rounded-lg border border-line object-contain"
              />
              <button
                onClick={() => setRenderPickerOpen(true)}
                className="absolute right-2 top-2 rounded bg-ink/80 p-1 text-muted hover:text-bone"
              >
                <i className="ti ti-pencil text-[11px]" />
              </button>
              <div className="mt-1 font-mono text-[11px] text-muted">
                {selectedRender.image_code}
              </div>
              <button
                onClick={() => setRenderPickerOpen(true)}
                className="mt-1 text-[11px] text-vermillion hover:text-vermillion-soft"
              >
                Switch render
              </button>
            </div>
          ) : (
            <button
              onClick={() => setRenderPickerOpen(true)}
              className="flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed border-line bg-ink-soft p-6 transition-colors hover:border-vermillion/30"
            >
              <i className="ti ti-photo text-2xl text-muted" />
              <span className="text-sm text-muted">Select a render</span>
            </button>
          )}
        </div>

        {/* Auto-pulled sketch + fabric refs */}
        {selectedRender?.input_images && selectedRender.input_images.length > 0 && (
          <div className="mt-3">
            <span className="mb-2 block text-[9px] uppercase tracking-wide text-muted">
              Auto-pulled from render: {selectedRender.input_images.length} reference(s)
            </span>
            <div className="flex flex-wrap gap-2">
              {refImages.map((ref) => {
                const stageLabel = ref.node_key === "sketch" ? "SKT" : ref.node_key === "print" ? "PRT" : ref.node_key;
                return (
                  <div key={ref.id} className="group relative">
                    <img
                      src={ref.url}
                      alt={ref.image_code}
                      className="h-16 w-16 rounded-lg border border-line object-cover"
                    />
                    <div className="absolute inset-x-0 bottom-0 rounded-b-lg bg-gradient-to-t from-black/80 to-transparent px-1 py-0.5">
                      <div className="text-center font-mono text-[7px] text-bone-dim truncate">
                        {ref.image_code.split("_").slice(-2).join("_")}
                      </div>
                    </div>
                    <div className="absolute left-0.5 top-0.5 rounded bg-vermillion/80 px-1 py-px text-[7px] font-bold text-ink">
                      {stageLabel}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Section>

      {/* Section B: Garment Info */}
      <Section label="B. Garment Info">
        <div className="flex flex-wrap gap-2">
          <Badge icon="ti-hanger" label="Category" value={category} />
          <Badge label="Gender" value={(selectedRender?.params?.gender as string) || "—"} />
          <Badge
            mono
            value={`${season.code}_${category}_${String(garment.style_number).padStart(3, "0")}`}
          />
        </div>
      </Section>

      {/* Section C: Construction Details */}
      <Section label={`C. Construction Details`} hint={category}>
        {constructionFields.map((cf) => (
          <div key={cf.field} className="mb-3">
            <label className="mb-1.5 block text-[11px] uppercase tracking-wide text-muted">
              {cf.field}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {cf.options.map((opt) => (
                <button
                  key={opt}
                  onClick={() => handleConstructionChange(cf.field, opt)}
                  className={`rounded-full px-2.5 py-1 text-[11px] transition-all ${
                    construction[cf.field] === opt
                      ? "bg-vermillion/20 text-vermillion border border-vermillion/40"
                      : "bg-ink text-muted border border-line hover:border-vermillion/20"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        ))}
      </Section>

      {/* Section D: Stitch & Seam */}
      <Section label="D. Stitch and Seam">
        <div className="mb-3">
          <label className="mb-1.5 block text-[11px] uppercase tracking-wide text-muted">
            Stitch type
          </label>
          <div className="flex flex-wrap gap-1.5">
            {STITCH_OPTIONS.map((opt) => (
              <button
                key={opt}
                onClick={() => setStitchType(opt)}
                className={`rounded-full px-2.5 py-1 text-[11px] transition-all ${
                  stitchType === opt
                    ? "bg-vermillion/20 text-vermillion border border-vermillion/40"
                    : "bg-ink text-muted border border-line hover:border-vermillion/20"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-[11px] uppercase tracking-wide text-muted">
            Seam type
          </label>
          <div className="flex flex-wrap gap-1.5">
            {SEAM_OPTIONS.map((opt) => (
              <button
                key={opt}
                onClick={() => setSeamType(opt)}
                className={`rounded-full px-2.5 py-1 text-[11px] transition-all ${
                  seamType === opt
                    ? "bg-vermillion/20 text-vermillion border border-vermillion/40"
                    : "bg-ink text-muted border border-line hover:border-vermillion/20"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      </Section>

      {/* Section E: BOM */}
      <Section label="E. Bill of Materials">
        <div className="flex flex-col gap-2.5">
          {BOM_FIELDS.map((bf) => (
            <div key={bf.key}>
              <div className="mb-1 flex items-center gap-1.5">
                <span className="text-[11px] text-muted">{bf.key}</span>
                {bf.autoFilled && (
                  <span className="rounded-full bg-vermillion/10 px-1.5 py-0.5 text-[8px] text-vermillion">
                    auto-filled
                  </span>
                )}
              </div>
              <input
                value={bom[bf.key] || ""}
                onChange={(e) => handleBomChange(bf.key, e.target.value)}
                placeholder={bf.placeholder}
                className="w-full rounded-lg border border-line bg-ink-soft px-3 py-2 text-sm text-bone placeholder:text-muted focus:border-vermillion/60 focus:outline-none"
              />
            </div>
          ))}
        </div>
      </Section>

      {/* Section F: Measurements */}
      <Section label="F. Measurements" hint="UK Large">
        <div className="grid grid-cols-2 gap-2">
          {measureFields.map((field) => (
            <div key={field} className="flex items-center gap-2 rounded-lg border border-line bg-ink-soft px-2.5 py-1.5">
              <span className="flex-1 text-[11px] text-muted truncate">{field}</span>
              <input
                type="number"
                value={measurements[field] || ""}
                onChange={(e) => handleMeasurementChange(field, parseInt(e.target.value) || 0)}
                className="w-14 rounded border border-line bg-ink px-1.5 py-0.5 text-right font-mono text-[11px] text-vermillion focus:border-vermillion/60 focus:outline-none"
              />
              <span className="text-[9px] text-muted">cm</span>
            </div>
          ))}
        </div>
      </Section>

      {/* Section G: Construction Notes */}
      <Section label="G. Construction Notes">
        <textarea
          value={constructionNotes}
          onChange={(e) => {
            if (e.target.value.length <= 200) setConstructionNotes(e.target.value);
          }}
          maxLength={200}
          placeholder="Double needle topstitch at 6mm, bar tack at stress points, etc."
          className="w-full min-h-[60px] rounded-lg border border-line bg-ink-soft px-3 py-2 text-sm text-bone placeholder:text-muted focus:border-vermillion/60 focus:outline-none resize-none"
        />
        <div className={`text-right text-[11px] mt-1 ${constructionNotes.length > 180 ? "text-vermillion" : "text-muted"}`}>
          {constructionNotes.length}/200
        </div>
        <div className="mt-3">
          <label className="mb-1 block text-[11px] uppercase text-muted">Additional Note</label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 250))}
            placeholder="Optional note..."
            className="w-full rounded-lg border border-line bg-ink-soft px-3 py-2 text-sm text-bone placeholder:text-muted focus:border-vermillion/60 focus:outline-none"
          />
        </div>
      </Section>

      {/* Error */}
      {error && (
        <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Section H: Output Controls */}
      <div className="mt-auto flex flex-col gap-3 border-t border-line pt-4">
        {/* Quantity */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-wide text-muted">Outputs</span>
          <div className="flex gap-1">
            {[1, 2, 3, 4].map((n) => (
              <button
                key={n}
                onClick={() => setNumOutputs(n)}
                className={`rounded px-3 py-1 text-sm transition-all ${
                  numOutputs === n
                    ? "bg-vermillion text-ink font-semibold"
                    : "bg-ink-soft text-muted hover:text-bone-dim"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Generate */}
        <button
          onClick={handleGenerate}
          disabled={isGenerating || !selectedRender}
          className={`flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold uppercase tracking-wider transition-all ${
            !selectedRender
              ? "cursor-not-allowed bg-line text-muted"
              : "bg-vermillion text-ink hover:bg-vermillion-soft"
          }`}
        >
          {isGenerating ? (
            <>
              <i className="ti ti-loader-2 animate-spin" />
              <span>Generating Tech Pack...</span>
            </>
          ) : (
            <>
              <i className="ti ti-sparkles" />
              <span>Generate Tech Pack</span>
            </>
          )}
        </button>
      </div>

      {/* Render Picker Modal */}
      <ImagePickerModal
        open={renderPickerOpen}
        onClose={() => setRenderPickerOpen(false)}
        onSelect={handleRenderSelect}
        seasonId={season.id}
        imageType="render"
        title="Choose Render"
      />
    </aside>
  );
}

// ─── Helper components ─────────────────────────────────────────────

function Section({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6 border-t border-line pt-5 first:border-0 first:pt-0">
      <div className="mb-3 flex items-center gap-2">
        <label className="text-[13px] font-semibold uppercase tracking-widest text-vermillion">
          {label}
        </label>
        {hint && <span className="text-[11px] text-muted">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Badge({
  icon,
  label,
  value,
  mono,
}: {
  icon?: string;
  label?: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-ink-soft px-2.5 py-1.5 text-[11px] text-muted">
      {icon && <i className={`ti ${icon} text-sm`} />}
      {label && <span>{label}:</span>}
      <strong className={`text-bone font-medium ${mono ? "font-mono text-[11px]" : ""}`}>
        {value}
      </strong>
    </div>
  );
}
