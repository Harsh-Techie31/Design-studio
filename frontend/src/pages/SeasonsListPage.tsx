import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { NavBar } from "../components/NavBar";
import { SeasonCard } from "../components/SeasonCard";
import { Modal } from "../components/Modal";
import { useStudio } from "../state/StudioContext";

export function SeasonsListPage() {
  const { seasons, garments, createSeason } = useStudio();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const navigate = useNavigate();

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const season = await createSeason(name);
    setName("");
    setOpen(false);
    navigate(`/seasons/${season.id}`);
  }

  return (
    <div className="min-h-screen bg-ink text-bone">
      <NavBar
        action={
          <button
            onClick={() => setOpen(true)}
            className="rounded-full bg-brass px-5 py-2 text-sm font-medium text-ink transition-colors hover:bg-brass-soft"
          >
            + New Season
          </button>
        }
      />

      <main className="mx-auto max-w-6xl px-6 py-14">
        <div className="mb-10">
          <h1 className="font-display text-4xl text-bone">Seasons</h1>
          <p className="mt-2 text-sm text-bone-dim">
            Each season is a moodboard — import 12 images to set the tone for a collection,
            then build garments inside it.
          </p>
        </div>

        {seasons.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line py-24 text-center text-bone-dim">
            No seasons yet. Create your first one to set a mood.
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {seasons.map((season) => (
              <SeasonCard
                key={season.id}
                season={season}
                garmentCount={garments.filter((g) => g.season_id === season.id).length}
              />
            ))}
          </div>
        )}
      </main>

      <Modal open={open} onClose={() => setOpen(false)} title="New Season">
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-xs uppercase tracking-wide text-muted">
              Season name
            </label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ash & Ember"
              className="w-full rounded-lg border border-line bg-ink-soft px-3.5 py-2.5 text-bone placeholder:text-muted focus:border-brass/60 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="mt-1 rounded-full bg-brass px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-brass-soft"
          >
            Create Season
          </button>
        </form>
      </Modal>
    </div>
  );
}
