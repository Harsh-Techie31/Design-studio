import { useState, useEffect } from "react";
import { ImagePickerModal } from "../ImagePickerModal";
import { generatePhotoshoot, listImagesForGarment } from "../../api/designImages";
import type { Garment, Season, DesignImage } from "../../types";

interface PhotoshootToolProps {
  garment: Garment;
  season: Season;
  onGenerated: (image: DesignImage) => void;
  onStartGenerating?: (count: number) => void;
}

const SHOT_TYPE_OPTIONS = ["Single shot", "Multi-angle", "Editorial", "Full body + Detail"];

const LOCATION_OPTIONS = [
  "Urban street",
  "Garden/Park",
  "Beach/Coast",
  "Forest/Woods",
  "Rooftop",
  "Cobblestone alley",
  "Open field",
  "Waterfront",
  "Desert",
  "Mountain trail",
];

const TIME_OF_DAY_OPTIONS = ["Golden hour", "Midday", "Blue hour", "Overcast", "Sunset"];

const MOOD_OPTIONS = [
  "Candid",
  "Editorial",
  "Lifestyle",
  "Fashion forward",
  "Minimal",
  "Dramatic",
  "Romantic",
];

const POSE_OPTIONS = ["Standing", "Walking", "Sitting", "Leaning", "Dynamic"];

export function PhotoshootTool({ garment, season, onGenerated, onStartGenerating }: PhotoshootToolProps) {
  const category = garment.category || "SHIRT";
  const moodboardReady = season.moodboard?.status === "ready";

  const [vizImage, setVizImage] = useState<DesignImage | null>(null);
  const [vizPickerOpen, setVizPickerOpen] = useState(false);

  // Fetch liked visualization from previous stage
  useEffect(() => {
    if (!garment?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const liked = await listImagesForGarment(garment.id, { node_key: "visualization", liked: true });
        if (!cancelled && liked.length > 0 && !vizImage) {
          setVizImage(liked[0]);
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [garment?.id]);

  const [moodboardInfluence, setMoodboardInfluence] = useState(moodboardReady);
  const [shotType, setShotType] = useState(SHOT_TYPE_OPTIONS[0]);
  const [location, setLocation] = useState(LOCATION_OPTIONS[0]);
  const [timeOfDay, setTimeOfDay] = useState(TIME_OF_DAY_OPTIONS[0]);
  const [mood, setMood] = useState(MOOD_OPTIONS[0]);
  const [pose, setPose] = useState(POSE_OPTIONS[0]);
  const [customPose, setCustomPose] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [numOutputs, setNumOutputs] = useState(1);

  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    onStartGenerating?.(numOutputs);
    if (!vizImage) {
      setError("Please select a mockup first");
      return;
    }
    setError(null);
    setIsGenerating(true);

    const params = {
      visualization_image_url: vizImage.id,
      moodboard_influence: moodboardReady && moodboardInfluence,
      shot_type: shotType,
      location,
      time_of_day: timeOfDay,
      mood,
      pose,
      custom_pose: customPose,
      additional_notes: additionalNotes,
      num_outputs: numOutputs,
    };

    console.log("[SHOOT] ─── Generate clicked ───");
    console.log("[SHOOT] garment:", { id: garment.id, name: garment.name, category: garment.category });
    console.log("[SHOOT] season:", { id: season.id, code: season.code });
    console.log("[SHOOT] vizImage:", { id: vizImage.id, image_code: vizImage.image_code, url: vizImage.url?.substring(0, 80) });
    console.log("[SHOOT] moodboardReady:", moodboardReady, "moodboardInfluence:", moodboardInfluence);
    console.log("[SHOOT] params:", JSON.stringify(params, null, 2));

    try {
      console.log("[SHOOT] Calling generatePhotoshoot API...");
      const result = await generatePhotoshoot(garment.id, params);
      console.log("[SHOOT] API response:", { success: result.success, imageCount: result.images?.length, model_avatar: result.model_avatar });
      console.log("[SHOOT] run:", result.run);
      if (result.images?.length > 0) {
        console.log("[SHOOT] images:", result.images.map((img: any) => ({ id: img.id, code: img.image_code, source: img.source, ai_model: img.ai_model })));
      }
      if (result.success && result.images?.length > 0) {
        onGenerated(result.images[0] as unknown as DesignImage);
      } else {
        console.warn("[SHOOT] No images returned in response");
      }
    } catch (e: any) {
      console.error("[SHOOT] Generation failed:", e.message, e);
      setError(e.message || "Generation failed");
    } finally {
      setIsGenerating(false);
      console.log("[SHOOT] ─── Generate finished ───");
    }
  };

  return (
    <aside className="flex h-full w-full flex-col overflow-y-auto bg-surface p-6 lg:w-[480px]">
      {/* Section A: Badges */}
      <Section label="A. Badges">
        <div className="flex flex-wrap gap-2">
          <Badge icon="ti-hanger" label="Category" value={category} />
          {vizImage && (
            <Badge
              icon="ti-user"
              label="Model"
              value={((vizImage.params as any)?.model_avatar as string) || "Model A"}
            />
          )}
        </div>
      </Section>

      {/* Section B: Mockup Reference */}
      <Section label="B. Mockup Reference" required>
        {vizImage ? (
          <div className="relative">
            <img
              src={vizImage.url}
              alt="Selected mockup"
              className="h-32 w-full rounded-lg border border-line object-contain"
            />
            <button
              onClick={() => setVizPickerOpen(true)}
              className="absolute right-2 top-2 rounded bg-ink/80 p-1 text-muted hover:text-bone"
            >
              <i className="ti ti-pencil text-[11px]" />
            </button>
            <div className="mt-1.5 font-mono text-[11px] text-muted">{vizImage.image_code}</div>
            <button onClick={() => setVizPickerOpen(true)} className="mt-1 text-[11px] text-brass hover:text-brass-soft">
              Switch mockup
            </button>
          </div>
        ) : (
          <button
            onClick={() => setVizPickerOpen(true)}
            className="flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed border-line bg-ink-soft p-6 transition-colors hover:border-brass/30"
          >
            <i className="ti ti-cube text-2xl text-muted" />
            <span className="text-sm text-muted">Choose Mockup</span>
            <span className="text-[11px] text-muted">Pick from library</span>
          </button>
        )}
      </Section>

      {/* Section C: Moodboard Influence */}
      <Section label="C. Moodboard Influence">
        <button
          type="button"
          disabled={!moodboardReady}
          onClick={() => setMoodboardInfluence((v) => !v)}
          className={`flex w-full items-center justify-between rounded-lg border px-3.5 py-2.5 transition-all ${
            !moodboardReady
              ? "cursor-not-allowed border-line bg-ink-soft opacity-50"
              : "border-line bg-ink-soft hover:border-brass/30"
          }`}
        >
          <span className="text-sm text-bone-dim">
            {moodboardReady ? "Let the season's mood influence this scene" : "No moodboard in this season"}
          </span>
          <span
            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
              moodboardReady && moodboardInfluence ? "bg-brass" : "bg-line"
            }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                moodboardReady && moodboardInfluence ? "" : ""
              }`}
              style={{ transform: moodboardReady && moodboardInfluence ? "translateX(18px)" : "translateX(2px)" }}
            />
          </span>
        </button>
      </Section>

      {/* Section D: Shot Type */}
      <Section label="D. Shot Type">
        <ChipGroup label="" options={SHOT_TYPE_OPTIONS} selected={shotType} onSelect={setShotType} />
      </Section>

      {/* Section E: Location */}
      <Section label="E. Location">
        <ChipGroup label="" options={LOCATION_OPTIONS} selected={location} onSelect={setLocation} />
      </Section>

      {/* Section F: Time of Day */}
      <Section label="F. Time of Day">
        <ChipGroup label="" options={TIME_OF_DAY_OPTIONS} selected={timeOfDay} onSelect={setTimeOfDay} />
      </Section>

      {/* Section G: Mood */}
      <Section label="G. Mood">
        <ChipGroup label="" options={MOOD_OPTIONS} selected={mood} onSelect={setMood} />
      </Section>

      {/* Section H: Pose */}
      <Section label="H. Pose">
        <ChipGroup label="" options={POSE_OPTIONS} selected={pose} onSelect={setPose} />
        <input
          value={customPose}
          onChange={(e) => setCustomPose(e.target.value)}
          placeholder="Custom pose details (e.g., hand in pocket, looking away)"
          className="mt-2 w-full rounded-lg border border-line bg-ink-soft px-3 py-2 text-sm text-bone placeholder:text-muted focus:border-brass/60 focus:outline-none"
        />
      </Section>

      {/* Section I: Additional Notes */}
      <Section label="I. Additional Notes">
        <textarea
          value={additionalNotes}
          onChange={(e) => {
            if (e.target.value.length <= 200) setAdditionalNotes(e.target.value);
          }}
          maxLength={200}
          placeholder="Any special notes for the photoshoot..."
          className="w-full min-h-[60px] rounded-lg border border-line bg-ink-soft px-3 py-2 text-sm text-bone placeholder:text-muted focus:border-brass/60 focus:outline-none resize-none"
        />
        <div className={`text-right text-[11px] mt-1 ${additionalNotes.length > 180 ? "text-brass" : "text-muted"}`}>
          {additionalNotes.length}/200
        </div>
      </Section>

      {error && (
        <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-400">{error}</div>
      )}

      {/* Section J: Output Controls */}
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
          disabled={isGenerating || !vizImage}
          className={`flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold uppercase tracking-wider transition-all ${
            !vizImage ? "cursor-not-allowed bg-line text-muted" : "bg-brass text-ink hover:bg-brass-soft"
          }`}
        >
          {isGenerating ? (
            <>
              <i className="ti ti-loader-2 animate-spin" />
              <span>Generating Photoshoot...</span>
            </>
          ) : (
            <>
              <i className="ti ti-sparkles" />
              <span>Generate Photoshoot</span>
            </>
          )}
        </button>
      </div>

      <ImagePickerModal
        open={vizPickerOpen}
        onClose={() => setVizPickerOpen(false)}
        onSelect={(img) => {
          console.log("[SHOOT] Viz image selected:", { id: img.id, image_code: img.image_code, url: img.url?.substring(0, 80) });
          setVizImage(img);
          setVizPickerOpen(false);
        }}
        seasonId={season.id}
        imageType="3d"
        title="Choose Mockup"
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
    <div className="mb-1">
      {label && <label className="mb-1.5 block text-[11px] uppercase tracking-wide text-muted">{label}</label>}
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
