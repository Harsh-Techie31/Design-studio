import { useState, useEffect } from "react";
import { ImagePickerModal } from "../ImagePickerModal";
import { generatePattern, type PatternGenerateResponse, listImagesForGarment } from "../../api/designImages";
import { CONSTRUCTION_OPTIONS } from "../../data/techpackConfig";
import { getDefaultBodyMeasurements, PATTERN_SETTINGS, PATTERN_SETTINGS_DEFAULTS } from "../../data/patternConfig";
import type { Garment, Season, DesignImage } from "../../types";

interface PatternToolProps {
  garment: Garment;
  season: Season;
  onGenerated: (image: any) => void;
  techPacks: DesignImage[];
  onStartGenerating?: (count: number) => void;
}

export function PatternTool({ garment, season, onGenerated, techPacks, onStartGenerating }: PatternToolProps) {
  const category = garment.category || "SHIRT";
  const [selectedTechPack, setSelectedTechPack] = useState<DesignImage | null>(null);
  const [tpPickerOpen, setTpPickerOpen] = useState(false);

  // Body measurements (AI pre-filled defaults)
  const [bodyMeasurements, setBodyMeasurements] = useState<Record<string, number>>({});
  const [editedMeasurements, setEditedMeasurements] = useState<Set<string>>(new Set());

  // Construction
  const [construction, setConstruction] = useState<Record<string, string>>({});

  // Pattern settings
  const [fabricType, setFabricType] = useState<string>("");
  const [seamAllowance, setSeamAllowance] = useState(PATTERN_SETTINGS_DEFAULTS.seamAllowance);
  const [hemAllowance, setHemAllowance] = useState(PATTERN_SETTINGS_DEFAULTS.hemAllowance);
  const [grainLine, setGrainLine] = useState(PATTERN_SETTINGS_DEFAULTS.grainLine);
  const [ease, setEase] = useState(PATTERN_SETTINGS_DEFAULTS.ease);
  const [patternMarkings, setPatternMarkings] = useState<string[]>([...PATTERN_SETTINGS_DEFAULTS.patternMarkings]);

  // Notes
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [numOutputs, setNumOutputs] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize construction defaults
  useEffect(() => {
    const fields = CONSTRUCTION_OPTIONS[category] || [];
    const defaults: Record<string, string> = {};
    for (const f of fields) defaults[f.field] = f.options[0];
    setConstruction(defaults);
  }, [category]);

  // Initialize body measurements
  useEffect(() => {
    setBodyMeasurements(getDefaultBodyMeasurements(category, "male"));
    setEditedMeasurements(new Set());
  }, [category]);

  // Auto-select: liked tech pack from previous stage, or first tech pack in picker
  useEffect(() => {
    if (selectedTechPack) return;
    let cancelled = false;
    (async () => {
      try {
        const liked = await listImagesForGarment(garment.id, { node_key: "techPack", liked: true });
        if (!cancelled && !selectedTechPack) {
          if (liked.length > 0) {
            setSelectedTechPack(liked[0]);
          } else if (techPacks.length > 0) {
            setSelectedTechPack(techPacks[0]);
          }
        }
      } catch {
        if (!cancelled && !selectedTechPack && techPacks.length > 0) {
          setSelectedTechPack(techPacks[0]);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [garment.id, techPacks]);

  const handleMeasurementChange = (field: string, value: number) => {
    setBodyMeasurements(prev => ({ ...prev, [field]: value }));
    setEditedMeasurements(prev => new Set(prev).add(field));
  };

  const toggleMarking = (marking: string) => {
    setPatternMarkings(prev =>
      prev.includes(marking) ? prev.filter(m => m !== marking) : [...prev, marking]
    );
  };

  const handleGenerate = async () => {
    onStartGenerating?.(numOutputs);
    if (!selectedTechPack) {
      setError("Please select a tech pack first");
      return;
    }
    setError(null);
    setIsGenerating(true);
    try {
      const result: PatternGenerateResponse = await generatePattern(garment.id, {
        tech_pack_image_url: selectedTechPack.id,
        gender: "male",
        body_measurements: bodyMeasurements,
        construction,
        fabric_type: fabricType || "Woven",
        seam_allowance: seamAllowance,
        hem_allowance: hemAllowance,
        grain_line: grainLine,
        ease,
        pattern_markings: patternMarkings,
        additional_notes: additionalNotes,
        num_outputs: numOutputs,
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

  const constructionFields = CONSTRUCTION_OPTIONS[category] || [];

  return (
    <aside className="flex h-full w-full flex-col overflow-y-auto bg-surface p-6 lg:w-[480px]">
      {/* Section A: Badges */}
      <Section label="A. Badges">
        <div className="flex flex-wrap gap-2">
          <Badge icon="ti-hanger" label="Category" value={category} />
          <Badge label="Base size" value="UK Large" />
          <Badge label="Grading" value="v2" />
        </div>
      </Section>

      {/* Section B: Tech Pack Selector */}
      <Section label="B. Tech Pack Reference">
        {selectedTechPack ? (
          <div className="relative">
            <img src={selectedTechPack.url} alt="Selected tech pack" className="h-24 w-full rounded-lg border border-line object-contain" />
            <button onClick={() => setTpPickerOpen(true)} className="absolute right-2 top-2 rounded bg-ink/80 p-1 text-muted hover:text-bone">
              <i className="ti ti-pencil text-[11px]" />
            </button>
            <div className="mt-1 font-mono text-[11px] text-muted">{selectedTechPack.image_code}</div>
            <button onClick={() => setTpPickerOpen(true)} className="mt-1 text-[11px] text-brass hover:text-brass-soft">Switch tech pack</button>
          </div>
        ) : (
          <button onClick={() => setTpPickerOpen(true)} className="flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed border-line bg-ink-soft p-6 transition-colors hover:border-brass/30">
            <i className="ti ti-photo text-2xl text-muted" />
            <span className="text-sm text-muted">Select a tech pack</span>
          </button>
        )}
      </Section>

      {/* Section C: Body / Drafting Measurements */}
      <Section label="C. Body Measurements" hint="AI pre-filled">
        <p className="mb-2 text-[9px] text-muted">Values estimated from Tech Pack. Edit if needed.</p>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(bodyMeasurements).map(([field, value]) => (
            <div key={field} className="flex items-center gap-2 rounded-lg border border-line bg-ink-soft px-2.5 py-1.5">
              <span className="flex-1 text-[11px] text-muted truncate">{field}</span>
              <input
                type="number"
                value={value}
                onChange={(e) => handleMeasurementChange(field, parseInt(e.target.value) || 0)}
                className={`w-14 rounded border border-line bg-ink px-1.5 py-0.5 text-right font-mono text-[11px] focus:border-brass/60 focus:outline-none ${
                  editedMeasurements.has(field) ? "text-bone" : "text-brass"
                }`}
              />
              <span className="text-[9px] text-muted">cm</span>
            </div>
          ))}
        </div>
      </Section>

      {/* Section D: Construction Details */}
      <Section label="D. Construction Details" hint={category}>
        {constructionFields.map((cf) => (
          <div key={cf.field} className="mb-3">
            <label className="mb-1.5 block text-[11px] uppercase tracking-wide text-muted">{cf.field}</label>
            <div className="flex flex-wrap gap-1.5">
              {cf.options.map((opt) => (
                <button
                  key={opt}
                  onClick={() => setConstruction(prev => ({ ...prev, [cf.field]: opt }))}
                  className={`rounded-full px-2.5 py-1 text-[11px] transition-all ${
                    construction[cf.field] === opt
                      ? "bg-brass/20 text-brass border border-brass/40"
                      : "bg-ink text-muted border border-line hover:border-brass/20"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        ))}
      </Section>

      {/* Section E: Pattern Settings */}
      <Section label="E. Pattern Settings">
        <ChipGroup label="Fabric type" options={[...PATTERN_SETTINGS.fabricType]} selected={fabricType} onSelect={setFabricType} />
        <ChipGroup label="Seam allowance" options={[...PATTERN_SETTINGS.seamAllowance]} selected={seamAllowance} onSelect={setSeamAllowance} />
        <ChipGroup label="Hem allowance" options={[...PATTERN_SETTINGS.hemAllowance]} selected={hemAllowance} onSelect={setHemAllowance} />
        <ChipGroup label="Grain line" options={[...PATTERN_SETTINGS.grainLine]} selected={grainLine} onSelect={setGrainLine} />
        <ChipGroup label="Ease" options={[...PATTERN_SETTINGS.ease]} selected={ease} onSelect={setEase} />
        <div className="mb-3">
          <label className="mb-1.5 block text-[11px] uppercase tracking-wide text-muted">Pattern markings</label>
          <div className="flex flex-wrap gap-1.5">
            {PATTERN_SETTINGS.patternMarkings.map((m) => (
              <button
                key={m}
                onClick={() => toggleMarking(m)}
                className={`rounded-full px-2.5 py-1 text-[11px] transition-all ${
                  patternMarkings.includes(m)
                    ? "bg-brass/20 text-brass border border-brass/40"
                    : "bg-ink text-muted border border-line hover:border-brass/20"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </Section>

      {/* Section F: Additional Notes */}
      <Section label="F. Additional Notes">
        <textarea
          value={additionalNotes}
          onChange={(e) => { if (e.target.value.length <= 200) setAdditionalNotes(e.target.value); }}
          maxLength={200}
          placeholder="Special pattern instructions (e.g., add extra ease at hip for pleats)"
          className="w-full min-h-[60px] rounded-lg border border-line bg-ink-soft px-3 py-2 text-sm text-bone placeholder:text-muted focus:border-brass/60 focus:outline-none resize-none"
        />
        <div className={`text-right text-[11px] mt-1 ${additionalNotes.length > 180 ? "text-brass" : "text-muted"}`}>
          {additionalNotes.length}/200
        </div>
      </Section>

      {error && (
        <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-400">{error}</div>
      )}

      {/* Section G: Output Controls */}
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
          disabled={isGenerating || !selectedTechPack}
          className={`flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold uppercase tracking-wider transition-all ${
            !selectedTechPack ? "cursor-not-allowed bg-line text-muted" : "bg-brass text-ink hover:bg-brass-soft"
          }`}
        >
          {isGenerating ? (
            <>
              <i className="ti ti-loader-2 animate-spin" />
              <span>Generating Pattern...</span>
            </>
          ) : (
            <>
              <i className="ti ti-sparkles" />
              <span>Generate Pattern</span>
            </>
          )}
        </button>
      </div>

      <ImagePickerModal
        open={tpPickerOpen}
        onClose={() => setTpPickerOpen(false)}
        onSelect={(img) => { setSelectedTechPack(img); setTpPickerOpen(false); }}
        seasonId={season.id}
        imageType="render"
        title="Choose Tech Pack"
      />
    </aside>
  );
}

function Section({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="mb-6 border-t border-line pt-5 first:border-0 first:pt-0">
      <div className="mb-3 flex items-center gap-2">
        <label className="text-[13px] font-semibold uppercase tracking-widest text-brass">{label}</label>
        {hint && <span className="text-[11px] text-muted">{hint}</span>}
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

function ChipGroup({ label, options, selected, onSelect }: { label: string; options: string[]; selected: string; onSelect: (v: string) => void }) {
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
