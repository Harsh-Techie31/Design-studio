import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { NavBar } from "../components/NavBar";
import { MoodboardTile } from "../components/MoodboardTile";
import { PaletteSwatches } from "../components/PaletteSwatches";
import { KeywordChips } from "../components/KeywordChips";
import { GarmentCard } from "../components/GarmentCard";
import { Modal } from "../components/Modal";
import { StartMoodboardModal } from "../components/StartMoodboardModal";
import { useStudio } from "../state/StudioContext";
import { CATEGORY_DEFS, seedFromId, type GarmentCategory, type MoodboardImage } from "../types";

type SeasonTab = "overview" | "fabrics" | "prints" | "sketches" | "garments";

const SEASON_TABS: { key: SeasonTab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "fabrics", label: "Fabrics" },
  { key: "prints", label: "Prints" },
  { key: "sketches", label: "Sketches" },
  { key: "garments", label: "Garments" },
];

export function SeasonDetailPage() {
  const { seasonId } = useParams<{ seasonId: string }>();
  const {
    getSeason,
    getGarmentsForSeason,
    createGarment,
    setMoodboardImages,
    analyzeMoodboard,
  } = useStudio();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<GarmentCategory | null>(null);
  const [moodboardOpen, setMoodboardOpen] = useState(false);
  const [briefExpanded, setBriefExpanded] = useState(false);
  const [tab, setTab] = useState<SeasonTab>("overview");

  const season = getSeason(seasonId ?? "");

  if (!season) {
    return (
      <div className="min-h-screen bg-ink text-bone">
        <NavBar />
        <main className="mx-auto max-w-6xl px-6 py-24 text-center">
          <p className="text-bone-dim">Season not found.</p>
          <Link to="/seasons" className="mt-4 inline-block text-brass hover:text-brass-soft">
            Back to Seasons
          </Link>
        </main>
      </div>
    );
  }

  const garments = getGarmentsForSeason(season!.id);
  const seed = seedFromId(season!.id);
  const moodboardImages = season!.moodboard.images;
  const palette = season!.moodboard.analysis.palette;
  const keywords = season!.moodboard.analysis.keywords;
  const brief = season!.moodboard.analysis.brief;
  const status = season!.moodboard.status;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!category) return;
    const garment = await createGarment(season!.id, name, category);
    setName("");
    setCategory(null);
    setOpen(false);
    navigate(`/seasons/${season!.id}/garments/${garment.id}`);
  }

  async function handleMoodboardSave(images: MoodboardImage[], name: string) {
    await setMoodboardImages(season!.id, images, name);

    const hasRealImages = images.some((img) => !img.url.startsWith("mood-placeholder:"));
    if (hasRealImages) {
      analyzeMoodboard(season!.id);
    }
  }

  const garmentsSection = (
    <section className="mt-16 first:mt-0">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl text-bone">Garments</h2>
          <p className="mt-1 text-sm text-bone-dim">
            Everything you build here draws on this season's mood.
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="rounded-full bg-brass px-5 py-2 text-sm font-medium text-ink transition-colors hover:bg-brass-soft"
        >
          + New Garment
        </button>
      </div>

      {garments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line py-20 text-center text-bone-dim">
          No garments yet in this season.
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {garments.map((garment) => (
            <GarmentCard key={garment.id} garment={garment} />
          ))}
        </div>
      )}
    </section>
  );

  return (
    <div className="min-h-screen bg-ink text-bone">
      <NavBar crumbs={[{ label: "Seasons", to: "/seasons" }, { label: season.code }]} />

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-6 flex items-center justify-between px-0">
          <h1 className="font-display text-4xl text-bone">{season.code}</h1>
          <span className="text-sm text-muted">Created {season.created_at.slice(0, 10)}</span>
        </div>

        <div className="mb-10 flex gap-1 border-b border-line">
          {SEASON_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`-mb-px border-b-2 px-4 py-3 text-sm transition-colors ${
                tab === t.key
                  ? "border-brass text-bone"
                  : "border-transparent text-muted hover:text-bone-dim"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "overview" && (
        <>
        {/* Moodboard */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl text-bone-dim">
              Moodboard
              {season.moodboard.name && (
                <span className="font-normal italic text-brass"> - {season.moodboard.name}</span>
              )}
            </h2>
            {moodboardImages.length > 0 && (
              <span className="text-xs uppercase tracking-wide text-muted">
                {moodboardImages.length} images
              </span>
            )}
          </div>

          {moodboardImages.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-line py-20 text-center">
              <p className="text-sm text-bone-dim">
                No moodboard yet — import up to 12 images to set the mood for this season.
              </p>
              <button
                onClick={() => setMoodboardOpen(true)}
                className="rounded-full bg-brass px-5 py-2 text-sm font-medium text-ink transition-colors hover:bg-brass-soft"
              >
                Start Moodboard
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                {moodboardImages.map((img, i) => (
                  <MoodboardTile
                    key={i}
                    src={img.url}
                    seed={seed}
                    index={i}
                    className="aspect-square rounded-md"
                  />
                ))}
              </div>

              {/* Analysis Status */}
              {status === "analyzing" && (
                <div className="mt-4 flex items-center gap-3 rounded-xl border border-brass/20 bg-brass/[0.03] px-5 py-4">
                  <i className="ti ti-loader-2 animate-spin text-lg text-brass" />
                  <span className="text-sm text-bone-dim">Analyzing your mood…</span>
                </div>
              )}

              {status === "failed" && (
                <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/5 px-5 py-4">
                  <p className="text-sm text-red-400">
                    Analysis failed: {season.moodboard.analysis.error ?? "Unknown error"}
                  </p>
                  <button
                    onClick={() => analyzeMoodboard(season!.id)}
                    className="mt-2 text-xs text-brass hover:text-brass-soft"
                  >
                    Retry analysis
                  </button>
                </div>
              )}

              {/* Palette + Keywords + Brief */}
              {(palette.length > 0 || keywords.length > 0) && (
                <div className="mt-6 flex flex-col gap-5 rounded-xl border border-line bg-surface p-5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-10">
                    {palette.length > 0 && (
                      <div>
                        <p className="mb-2 text-xs uppercase tracking-wide text-muted">Palette</p>
                        <PaletteSwatches colors={palette} />
                      </div>
                    )}
                    {keywords.length > 0 && (
                      <div>
                        <p className="mb-2 text-xs uppercase tracking-wide text-muted">Mood</p>
                        <KeywordChips keywords={keywords} />
                      </div>
                    )}
                  </div>

                  {brief && (
                    <div className="sm:max-w-xs">
                      <button
                        onClick={() => setBriefExpanded(!briefExpanded)}
                        className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted hover:text-bone-dim transition-colors"
                      >
                        <i
                          className={`ti ti-chevron-right transition-transform ${briefExpanded ? "rotate-90" : ""}`}
                        />
                        Creative Brief
                      </button>
                      {briefExpanded && (
                        <p className="mt-2 text-sm leading-relaxed text-bone-dim">{brief}</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </section>

        <div className="mt-16">{garmentsSection}</div>
        </>
        )}

        {tab === "fabrics" && (
          <div className="py-16 text-center text-sm text-bone-dim">
            Fabric library for this season. Add fabrics you want available across all garments.
          </div>
        )}

        {tab === "prints" && (
          <div className="py-16 text-center text-sm text-bone-dim">
            Print library for this season.
          </div>
        )}

        {tab === "sketches" && (
          <div className="py-16 text-center text-sm text-bone-dim">
            Reference sketches you have uploaded manually for this season.
          </div>
        )}

        {tab === "garments" && garmentsSection}
      </main>

      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          setCategory(null);
        }}
        title="New Garment"
      >
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-xs uppercase tracking-wide text-muted">
              Category
            </label>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORY_DEFS.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => setCategory(c.code)}
                  className={`rounded-lg border px-4 py-2.5 text-left text-sm transition-colors ${
                    category === c.code
                      ? "border-brass bg-brass/10 text-brass"
                      : "border-line bg-ink-soft text-bone-dim hover:border-brass/40"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs uppercase tracking-wide text-muted">
              Garment name
            </label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Frayed Silk Trench"
              className="w-full rounded-lg border border-line bg-ink-soft px-3.5 py-2.5 text-bone placeholder:text-muted focus:border-brass/60 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={!category}
            className="mt-1 rounded-full bg-brass px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-brass-soft disabled:cursor-not-allowed disabled:opacity-40"
          >
            Create Garment
          </button>
        </form>
      </Modal>

      <StartMoodboardModal
        open={moodboardOpen}
        onClose={() => setMoodboardOpen(false)}
        onSave={handleMoodboardSave}
      />
    </div>
  );
}
