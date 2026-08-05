import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { NavBar } from "../components/NavBar";
import { SeasonCard } from "../components/SeasonCard";
import { Modal } from "../components/Modal";
import { useStudio } from "../state/StudioContext";

function normalizeCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
}

export function SeasonsListPage() {
  const { seasons, garments, loading, createSeason, deleteSeason } = useStudio();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [pendingDelete, setPendingDelete] = useState<{ id: string; code: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!code) return;
    const season = await createSeason(code);
    setCode("");
    setOpen(false);
    navigate(`/seasons/${season.id}`);
  }

  return (
    <div className="min-h-screen bg-ink text-bone">
      <NavBar
        action={
          <button
            onClick={() => setOpen(true)}
            className="bg-accent px-5 py-2 font-mono text-xs font-medium uppercase tracking-wider text-ink transition-colors hover:bg-accent-soft"
          >
            + New Season
          </button>
        }
      />

      <main className="mx-auto max-w-7xl px-8 py-14">
        <div className="mb-10">
          <h1 className="font-display text-3xl font-bold tracking-tight text-bone">Seasons</h1>
          <p className="mt-2 text-sm text-bone-dim">
            Each season is a moodboard — import 12 images to set the tone for a collection,
            then build garments inside it.
          </p>
        </div>

        {loading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-surface overflow-hidden animate-pulse">
                <div className="h-40 bg-line/30" />
                <div className="p-4 space-y-3">
                  <div className="h-5 w-24 bg-line/30" />
                  <div className="h-3 w-32 bg-line/20" />
                  <div className="h-3 w-20 bg-line/20" />
                </div>
              </div>
            ))}
          </div>
        ) : seasons.length === 0 ? (
          <div className="border border-dashed border-line py-24 text-center text-bone-dim">
            No seasons yet. Create your first one to set a mood.
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {seasons.map((season) => (
              <SeasonCard
                key={season.id}
                season={season}
                garmentCount={garments.filter((g) => g.season_id === season.id).length}
                onDelete={(id) => {
                  const s = seasons.find((s) => s.id === id);
                  if (s) setPendingDelete({ id: s.id, code: s.code ?? "Untitled" });
                }}
              />
            ))}
          </div>
        )}
      </main>

      <Modal open={open} onClose={() => setOpen(false)} title="New Season">
        <p className="mb-4 -mt-2 text-sm text-bone-dim">
          A season is a fashion cycle. Give it a short code — you'll name the moodboard next.
        </p>
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-muted">
              Season Code
            </label>
            <input
              autoFocus
              value={code}
              onChange={(e) => setCode(normalizeCode(e.target.value))}
              placeholder="e.g. SS27, AW27, RESORT27"
              maxLength={12}
              className="w-full border border-line bg-ink px-3.5 py-2.5 font-mono text-sm text-bone placeholder:text-muted focus:border-accent focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={!code}
            className="mt-1 bg-accent px-5 py-2.5 font-mono text-xs font-medium uppercase tracking-wider text-ink transition-colors hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-40"
          >
            Create Season
          </button>
        </form>
      </Modal>

      <Modal open={!!pendingDelete} onClose={() => !deleting && setPendingDelete(null)} title="Delete Season">
        <p className="text-sm text-bone-dim">
          Are you sure you want to delete <span className="font-medium text-bone">{pendingDelete?.code}</span> and all its garments? This action cannot be undone.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={() => setPendingDelete(null)}
            disabled={deleting}
            className="border border-line px-4 py-2 text-sm text-bone transition-colors hover:bg-surface-hi disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={async () => {
              if (!pendingDelete) return;
              setDeleting(true);
              try {
                await deleteSeason(pendingDelete.id);
                setPendingDelete(null);
              } finally {
                setDeleting(false);
              }
            }}
            disabled={deleting}
            className="flex items-center gap-2 bg-accent/20 px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/30 disabled:opacity-40"
          >
            {deleting && <i className="ti ti-loader-2 animate-spin text-xs" />}
            {deleting ? "Cleaning up..." : "Delete"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
