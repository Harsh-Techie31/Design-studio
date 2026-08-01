import { useState, useRef } from "react";
import type { Garment, Season } from "../../types";
import { generateSketch, type SketchGenerateResponse } from "../../api/designImages";

interface SketchToolProps {
  garment: Garment;
  season: Season;
  onGenerated: (response: SketchGenerateResponse) => void;
  onStartGenerating?: (count: number) => void;
}

const SILHOUETTES: Record<string, string[]> = {
  SHIRT: ["Regular fit", "Slim", "Oversized", "Cropped", "Boxy"],
  TEE: ["Regular fit", "Slim", "Oversized", "Cropped", "Boxy", "Longline"],
  TOP: ["Fitted", "Relaxed", "Cropped", "Draped", "Peplum"],
  DRESS: ["Bodycon", "A-line", "Shift", "Maxi", "Wrap", "Fit-and-flare"],
  SKIRT: ["A-line", "Pencil", "Pleated", "Maxi", "Mini", "Wrap"],
  PANT: ["Fitted", "Straight", "Wide-leg", "Relaxed", "Tapered", "Cropped"],
  SHORT: ["Regular", "Relaxed", "Tailored", "High-waist", "Bermuda"],
  JACKET: ["Fitted", "Relaxed", "Oversized", "Cropped", "Longline"],
  SWTSHRT: ["Regular", "Oversized", "Cropped", "Boxy"],
  JUMP: ["Fitted", "Relaxed", "Wide-leg", "Tapered", "Cropped"],
};

const STYLE_DESCRIPTORS: Record<string, string[]> = {
  SHIRT: ["Minimalist", "Tailored", "Relaxed", "Camp collar", "Mandarin collar", "Band collar", "Utility", "Western", "Oversized cuff", "Linen-feel"],
  TEE: ["Minimalist", "Streetwear", "Vintage", "Boxy cut", "Raw hem", "Drop shoulder", "Henley", "Pocket tee", "Acid wash", "Distressed"],
  TOP: ["Minimalist", "Draped", "Structured", "Off-shoulder", "Halter", "Wrap front", "Ruched", "Corset-inspired", "Asymmetric", "Layered"],
  DRESS: ["Minimalist", "Tailored", "Flowy", "Tiered", "Wrap", "Shirt dress", "Slip dress", "Cutout", "Ruched", "Smocked"],
  SKIRT: ["Minimalist", "Tailored", "Pleated", "Tiered", "Slit", "Wrap", "Handkerchief hem", "Godet", "Sarong", "Ruched"],
  PANT: ["Minimalist", "Tailored", "Pleated", "High-waist", "Cargo", "Utility", "Deconstructed", "Paperbag waist", "Drawstring", "Cuffed"],
  SHORT: ["Minimalist", "Tailored", "Cargo", "Utility", "Pleated", "Drawstring", "Raw hem", "High-waist", "Athletic", "Bermuda"],
  JACKET: ["Minimalist", "Tailored", "Bomber", "Biker", "Field jacket", "Coach", "Trucker", "Cropped", "Parka", "Shacket"],
  SWTSHRT: ["Minimalist", "Streetwear", "Vintage", "Oversized", "Half-zip", "Hoodie", "Cropped", "Color-block", "Distressed", "Varsity"],
  JUMP: ["Minimalist", "Tailored", "Utility", "Boiler suit", "Wrap", "Belted", "Strapless", "Wide-leg", "Cropped", "Drawstring"],
};

const CATEGORY_LABELS: Record<string, string> = {
  SHIRT: "Shirt",
  TEE: "Tee",
  TOP: "Top",
  DRESS: "Dress",
  SKIRT: "Skirt",
  PANT: "Pant",
  SHORT: "Short",
  JACKET: "Jacket",
  SWTSHRT: "Sweatshirt",
  JUMP: "Jumpsuit",
};

export function SketchTool({ garment, season, onGenerated, onStartGenerating }: SketchToolProps) {
  const category = garment.category || "PANT";

  const [gender, setGender] = useState<string | null>(null);
  const [silhouette, setSilhouette] = useState<string | null>(null);
  const [selectedDescriptors, setSelectedDescriptors] = useState<string[]>([]);
  const [promptText, setPromptText] = useState("");
  const [selectedMoodboards, setSelectedMoodboards] = useState<number[]>([]);
  const [moodInfluence, setMoodInfluence] = useState(60);
  const [view, setView] = useState("Front and back");
  const [numOutputs, setNumOutputs] = useState(1);
  const [note, setNote] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const moodboardImages = season.moodboard.images;
  const hasMoodboard = moodboardImages.length > 0;

  const handleDescriptorToggle = (desc: string) => {
    const isCurrentlyActive = selectedDescriptors.includes(desc);

    if (!isCurrentlyActive) {
      setSelectedDescriptors((prev) => [...prev, desc]);
      setPromptText((pt) => {
        const trimmed = pt.trim();
        if (trimmed === "") return desc;
        return `${trimmed}, ${desc}`;
      });
    } else {
      setSelectedDescriptors((prev) => prev.filter((d) => d !== desc));
      setPromptText((pt) => {
        let result = pt;
        while (result.includes(desc)) {
          result = result.replace(desc, "");
        }
        return result
          .replace(/,\s*,/g, ",")
          .replace(/^,\s*/, "")
          .replace(/,\s*$/, "")
          .trim();
      });
    }
  };

  const handleMoodboardToggle = (index: number) => {
    setSelectedMoodboards((prev) => {
      if (prev.includes(index)) return prev.filter((i) => i !== index);
      if (prev.length >= 3) return prev;
      return [...prev, index];
    });
  };

  const handleGenerate = async () => {
    onStartGenerating?.(numOutputs);
    if (!gender) {
      setError("Please select a gender");
      return;
    }
    if (!silhouette) {
      setError("Please select a silhouette");
      return;
    }
    setError(null);
    setIsGenerating(true);

    try {
      const response = await generateSketch(garment.id, {
        gender,
        silhouette,
        descriptors: selectedDescriptors,
        prompt_text: promptText,
        moodboard_refs: selectedMoodboards.map((i) => moodboardImages[i]?.url || ""),
        mood_influence: moodInfluence,
        view,
        num_outputs: numOutputs,
        note,
      });
      onGenerated(response);
    } catch (e: any) {
      setError(e.message || "Generation failed");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("File exceeds 5MB limit");
      return;
    }
    // TODO: Upload to backend and create DesignImage
    setError(null);
  };

  const promptLength = promptText.length;
  const isPromptGold = promptLength >= 180;
  const isPromptOver = promptLength > 200;

  return (
    <aside className="flex h-full w-full flex-col overflow-y-auto bg-surface p-6 lg:w-[480px]">
      {/* 1. Category (read-only) */}
      <Section label="1. Category" hint="From garment">
        <div className="inline-flex items-center gap-2 rounded-lg border border-brass/30 bg-brass/10 px-3 py-1.5">
          <i className="ti ti-shirt text-sm text-brass" />
          <span className="text-sm font-medium text-brass">{CATEGORY_LABELS[category]}</span>
        </div>
      </Section>

      {/* 2. Gender */}
      <Section label="2. Gender" required>
        <div className="flex flex-wrap gap-2">
          {["Menswear", "Womenswear", "Unisex"].map((g) => (
            <Chip key={g} active={gender === g} onClick={() => setGender(g)}>
              {g}
            </Chip>
          ))}
        </div>
      </Section>

      {/* 3. Silhouette */}
      <Section label="3. Silhouette" required hint={CATEGORY_LABELS[category]}>
        <div className="flex flex-wrap gap-1.5">
          {SILHOUETTES[category]?.map((s) => (
            <Chip key={s} active={silhouette === s} onClick={() => setSilhouette(s)} small>
              {s}
            </Chip>
          ))}
        </div>
      </Section>

      {/* 4. Style Descriptors */}
      <Section label="4. Style Descriptors" hint="Multiple">
        <div className="mb-3 flex flex-wrap gap-1.5">
          {STYLE_DESCRIPTORS[category]?.map((desc) => (
            <Chip
              key={desc}
              active={selectedDescriptors.includes(desc)}
              onClick={() => handleDescriptorToggle(desc)}
              small
            >
              {desc}
            </Chip>
          ))}
        </div>
        <div className="relative">
          <textarea
            value={promptText}
            onChange={(e) => {
              if (e.target.value.length <= 220) setPromptText(e.target.value);
            }}
            maxLength={220}
            placeholder="E.g. Double breasted waist with tailored fit details..."
            className={`w-full resize-none rounded-lg border bg-ink-soft p-3 text-sm text-bone placeholder:text-muted focus:outline-none ${
              isPromptOver
                ? "border-red-500"
                : isPromptGold
                ? "border-amber-500"
                : "border-line focus:border-brass/60"
            }`}
            rows={3}
          />
          <div className="mt-1 flex justify-between px-1">
            <span className="text-[11px] text-muted">Appends to prompt</span>
            <span
              className={`text-[11px] font-mono ${
                isPromptOver ? "text-red-500" : isPromptGold ? "text-amber-500" : "text-muted"
              }`}
            >
              {promptLength}/200
            </span>
          </div>
        </div>
      </Section>

      {/* 5. Moodboard Reference */}
      <Section label="5. Moodboard Reference" hint="Up to 3">
        <div className="relative">
          <div className="pointer-events-none opacity-40">
            {hasMoodboard ? (
              <div className="flex flex-wrap gap-1.5">
                {moodboardImages.slice(0, 7).map((img, i) => {
                  const isSelected = selectedMoodboards.includes(i);
                  return (
                    <button
                      key={i}
                      onClick={() => handleMoodboardToggle(i)}
                      className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-all ${
                        isSelected
                          ? "border-brass bg-brass/10 text-brass"
                          : "border-line bg-ink-soft text-muted hover:border-brass/30"
                      }`}
                    >
                      <span
                        className="h-3 w-3 rounded-full border border-white/20"
                        style={{ backgroundColor: season.moodboard.analysis.palette[i % 5] }}
                      />
                      <span className="max-w-[80px] truncate">
                        {img.url.split("/").pop()?.slice(0, 12) || `#${i + 1}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-line bg-ink-soft p-4 text-center">
                <i className="ti ti-photo-off text-lg text-muted" />
                <p className="mt-1 text-sm text-muted">
                  No moodboard yet. Add one in the season overview.
                </p>
              </div>
            )}

            {/* Mood Influence Slider */}
            {hasMoodboard && (
              <div className="mt-3 rounded-lg border border-line bg-ink-soft p-3">
                <div className="mb-1 flex justify-between">
                  <span className="text-[11px] uppercase tracking-wide text-muted">Mood Influence</span>
                  <span className="text-[12px] font-bold text-brass">{moodInfluence}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={moodInfluence}
                  onChange={(e) => setMoodInfluence(parseInt(e.target.value))}
                  className="w-full accent-brass"
                />
              </div>
            )}
          </div>
          <span className="absolute right-0 top-0 rounded-full bg-line px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
            Coming Soon
          </span>
        </div>
      </Section>

      {/* 6. View */}
      <Section label="6. View Layout" required>
        <div className="flex gap-2">
          {["Front only", "Front and back", "Back only"].map((v) => (
            <Chip key={v} active={view === v} onClick={() => setView(v)}>
              {v}
            </Chip>
          ))}
        </div>
      </Section>

      {/* 7. Output Quantity + Note */}
      <Section label="7. Sketches Per Batch" required>
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((n) => (
            <Chip key={n} active={numOutputs === n} onClick={() => setNumOutputs(n)} small>
              {n}
            </Chip>
          ))}
        </div>
        <div className="mt-3">
          <label className="mb-1 block text-[11px] uppercase text-muted">Note</label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 250))}
            placeholder="Optional note..."
            className="w-full rounded-lg border border-line bg-ink-soft px-3 py-2.5 text-sm text-bone placeholder:text-muted focus:border-brass/60 focus:outline-none"
          />
        </div>
      </Section>

      {/* Error */}
      {error && (
        <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* 8. Generate + Upload */}
      <div className="mt-auto flex flex-col gap-3 border-t border-line pt-4">
        <button
          onClick={handleGenerate}
          disabled={isGenerating || !gender || !silhouette}
          className={`flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold uppercase tracking-wider transition-all ${
            !gender || !silhouette
              ? "cursor-not-allowed bg-line text-muted"
              : "bg-brass text-ink hover:bg-brass-soft"
          }`}
        >
          {isGenerating ? (
            <>
              <i className="ti ti-loader-2 animate-spin" />
              <span>Generating...</span>
            </>
          ) : (
            <>
              <i className="ti ti-sparkles" />
              <span>Generate Sketches</span>
            </>
          )}
        </button>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-line" />
          <span className="text-[11px] uppercase text-muted">or</span>
          <div className="h-px flex-1 bg-line" />
        </div>

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept="image/*"
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-ink-soft py-3 text-sm text-muted transition-colors hover:border-brass/30 hover:text-brass"
        >
          <i className="ti ti-upload" />
          <span>Upload your own sketch</span>
        </button>
        <span className="text-center text-[11px] text-muted">JPG, PNG, max 5MB</span>
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
        <label className="text-[13px] font-semibold uppercase tracking-widest text-brass">
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
        {hint && <span className="text-[11px] text-muted">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Chip({
  active,
  onClick,
  small,
  children,
}: {
  active: boolean;
  onClick: () => void;
  small?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border transition-all ${
        small ? "px-3 py-2 text-[12px]" : "px-3.5 py-2.5 text-sm"
      } ${
        active
          ? "border-brass bg-brass/15 font-semibold text-brass"
          : "border-line bg-ink-soft text-muted hover:border-brass/30"
      }`}
    >
      {children}
    </button>
  );
}
