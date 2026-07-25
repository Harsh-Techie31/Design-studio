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
import { seedFromId } from "../types";

export function SeasonDetailPage() {
  const { seasonId } = useParams<{ seasonId: string }>();
  const { getSeason, getGarmentsForSeason, createGarment, setMoodboardImages } = useStudio();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [moodboardOpen, setMoodboardOpen] = useState(false);

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

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const garment = await createGarment(season!.id, name);
    setName("");
    setOpen(false);
    navigate(`/seasons/${season!.id}/garments/${garment.id}`);
  }

  return (
    <div className="min-h-screen bg-ink text-bone">
      <NavBar crumbs={[{ label: "Seasons", to: "/seasons" }, { label: season.name }]} />

      <main className="mx-auto max-w-6xl px-6 py-14">
        <div className="mb-2 flex items-center justify-between">
          <h1 className="font-display text-4xl text-bone">{season.name}</h1>
          <span className="text-sm text-muted">Created {season.created_at.slice(0, 10)}</span>
        </div>

        {/* Moodboard */}
        <section className="mt-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl text-bone-dim">Moodboard</h2>
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

              <div className="mt-6 flex flex-col gap-5 rounded-xl border border-line bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="mb-2 text-xs uppercase tracking-wide text-muted">Palette</p>
                  <PaletteSwatches colors={palette} />
                </div>
                <div>
                  <p className="mb-2 text-xs uppercase tracking-wide text-muted">Mood</p>
                  <KeywordChips keywords={keywords} />
                </div>
              </div>
            </>
          )}
        </section>

        {/* Garments */}
        <section className="mt-16">
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
      </main>

      <Modal open={open} onClose={() => setOpen(false)} title="New Garment">
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
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
            className="mt-1 rounded-full bg-brass px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-brass-soft"
          >
            Create Garment
          </button>
        </form>
      </Modal>

      <StartMoodboardModal
        open={moodboardOpen}
        onClose={() => setMoodboardOpen(false)}
        onSave={(images) => setMoodboardImages(season.id, images)}
      />
    </div>
  );
}
