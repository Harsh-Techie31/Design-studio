import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { NavBar } from "../components/NavBar";
import { MoodboardTile } from "../components/MoodboardTile";
import { PaletteSwatches } from "../components/PaletteSwatches";
import { KeywordChips } from "../components/KeywordChips";
import { GarmentCard } from "../components/GarmentCard";
import { Modal } from "../components/Modal";
import { StartMoodboardModal } from "../components/StartMoodboardModal";
import { useStudio } from "../state/StudioContext";
import { listImagesForSeason, toggleLike, deleteImage } from "../api/designImages";
import { CATEGORY_DEFS, seedFromId, type GarmentCategory, type DesignImage, type MoodboardImage } from "../types";

type SeasonTab = "overview" | "prints" | "fabrics" | "sketches" | "firstRenders" | "techPacks" | "patterns" | "garments";

const SEASON_TABS: { key: SeasonTab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "prints", label: "Prints" },
  { key: "fabrics", label: "Fabrics" },
  { key: "sketches", label: "Sketches" },
  { key: "firstRenders", label: "Renders" },
  { key: "techPacks", label: "Tech Packs" },
  { key: "patterns", label: "Patterns" },
  { key: "garments", label: "Garments" },
];

export function SeasonDetailPage() {
  const { seasonId } = useParams<{ seasonId: string }>();
  const {
    getSeason,
    getGarmentsForSeason,
    createGarment,
    deleteGarment,
    setMoodboardImages,
    analyzeMoodboard,
    loading: studioLoading,
  } = useStudio();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [open, setOpen] = useState(() => searchParams.get("new") === "1");
  const [category, setCategory] = useState<GarmentCategory | null>(null);
  const [moodboardOpen, setMoodboardOpen] = useState(false);
  const [tab, setTab] = useState<SeasonTab>("overview");
  const [tabImages, setTabImages] = useState<DesignImage[]>([]);
  const [tabLoading, setTabLoading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const season = getSeason(seasonId ?? "");

  if (studioLoading && !season) {
    return (
      <div className="min-h-screen bg-ink text-bone">
        <NavBar />
        <main className="mx-auto max-w-7xl px-8 py-24 text-center">
          <i className="ti ti-loader-2 animate-spin text-2xl text-accent" />
        </main>
      </div>
    );
  }

  if (!season) {
    return (
      <div className="min-h-screen bg-ink text-bone">
        <NavBar />
        <main className="mx-auto max-w-7xl px-8 py-24 text-center">
          <p className="text-bone-dim">Season not found.</p>
          <Link to="/seasons" className="mt-4 inline-block font-mono text-xs uppercase tracking-wider text-accent hover:text-accent-soft">
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

  useEffect(() => {
    if (tab === "overview" || tab === "garments" || !seasonId) {
      setTabImages([]);
      return;
    }
    setTabLoading(true);
    const imageType = tab === "sketches" ? "sketch" : tab === "fabrics" ? "fabric" : tab === "prints" ? "print" : tab === "firstRenders" ? "render" : tab === "techPacks" ? "tech_pack" : tab === "patterns" ? "pattern" : tab;
    listImagesForSeason(seasonId, { image_type: imageType })
      .then(setTabImages)
      .catch(() => setTabImages([]))
      .finally(() => setTabLoading(false));
  }, [tab, seasonId]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!category) return;
    const garment = await createGarment(season!.id, category);
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

  async function handleToggleLike(imageId: string) {
    try {
      const target = tabImages.find((img) => img.id === imageId);
      if (!target) return;

      if (target.liked) {
        const updated = await toggleLike(imageId);
        setTabImages((prev) => prev.map((img) => (img.id === imageId ? updated : img)));
      } else {
        const currentlyLiked = tabImages.find((img) => img.liked);
        if (currentlyLiked) {
          const unliked = await toggleLike(currentlyLiked.id);
          setTabImages((prev) => prev.map((img) => (img.id === currentlyLiked.id ? unliked : img)));
        }
        const updated = await toggleLike(imageId);
        setTabImages((prev) => prev.map((img) => (img.id === imageId ? updated : img)));
      }
    } catch (e) {
      console.error("Failed to toggle like:", e);
    }
  }

  async function handleDeleteImage(imageId: string) {
    try {
      await deleteImage(imageId);
      setTabImages((prev) => prev.filter((img) => img.id !== imageId));
    } catch (e) {
      console.error("Failed to delete image:", e);
    }
  }

  const renderImageGrid = (images: DesignImage[], emptyMessage: string) => {
    if (tabLoading) {
      return (
        <div className="flex items-center justify-center py-16">
          <i className="ti ti-loader-2 animate-spin text-xl text-accent" />
        </div>
      );
    }
    if (images.length === 0) {
      return (
        <div className="border border-dashed border-line py-16 text-center text-sm text-bone-dim">
          {emptyMessage}
        </div>
      );
    }

    const starred = images.filter(img => img.starred);
    const selected = images.filter(img => img.liked && !img.starred);
    const rest = images.filter(img => !img.liked && !img.starred);

    const renderCard = (img: DesignImage) => (
      <div
        key={img.id}
        className={`group relative overflow-hidden transition-all ${
          img.starred
            ? "ring-2 ring-signal-amber/60"
            : img.liked
              ? "ring-2 ring-signal-green/60"
              : ""
        }`}
      >
        <div className="aspect-[3/4] bg-ink-soft">
          <img src={img.url} alt={img.image_code} className="h-full w-full object-contain" loading="lazy" />
        </div>
        <button
          onClick={() => handleDeleteImage(img.id)}
          className="absolute right-1.5 top-1.5 bg-accent p-1.5 text-white opacity-0 transition-opacity hover:bg-accent-soft group-hover:opacity-100"
          title="Delete image"
        >
          <i className="ti ti-trash text-xs" />
        </button>
        {img.starred && (
          <div className="absolute left-1.5 top-1.5 bg-signal-amber px-1.5 py-0.5">
            <span className="text-[7px] font-bold uppercase text-ink">Starred</span>
          </div>
        )}
        {img.liked && !img.starred && (
          <div className="absolute left-1.5 top-1.5 bg-signal-green px-1.5 py-0.5">
            <span className="text-[7px] font-bold uppercase text-ink">Selected</span>
          </div>
        )}
        <div className="flex items-center justify-between px-2 py-1.5">
          <span className="font-mono text-[10px] text-muted">
            {img.image_code.split("_").slice(-2).join("_")}
          </span>
          <button
            onClick={() => handleToggleLike(img.id)}
            className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-all ${
              img.liked
                ? "bg-signal-green text-ink"
                : "bg-ink text-muted hover:bg-signal-green/20 hover:text-signal-green"
            }`}
          >
            {img.liked ? "Selected" : "Select"}
          </button>
        </div>
      </div>
    );

    return (
      <div className="space-y-4">
        {starred.length > 0 && (
          <div>
            <div className="mb-2 flex items-center gap-2">
              <i className="ti ti-star-filled text-xs text-signal-amber" />
              <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-signal-amber">Starred</span>
            </div>
            <div className="grid grid-cols-3 gap-px sm:grid-cols-4 lg:grid-cols-5">
              {starred.map(renderCard)}
            </div>
          </div>
        )}
        {selected.length > 0 && (
          <div>
            <div className="mb-2 flex items-center gap-2">
              <i className="ti ti-circle-check-filled text-xs text-signal-green" />
              <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-signal-green">Selected</span>
            </div>
            <div className="grid grid-cols-3 gap-px sm:grid-cols-4 lg:grid-cols-5">
              {selected.map(renderCard)}
            </div>
          </div>
        )}
        {rest.length > 0 && (
          <div>
            {(starred.length > 0 || selected.length > 0) && (
              <div className="mb-2 flex items-center gap-2">
                <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-muted">All</span>
              </div>
            )}
            <div className="grid grid-cols-3 gap-px sm:grid-cols-4 lg:grid-cols-5">
              {rest.map(renderCard)}
            </div>
          </div>
        )}
      </div>
    );
  };

  const garmentsSection = (
    <section className="first:mt-0">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold tracking-tight text-bone">Garments</h2>
        <button
          onClick={() => setOpen(true)}
          className="bg-accent px-4 py-1.5 font-mono text-[11px] font-medium uppercase tracking-wider text-ink transition-colors hover:bg-accent-soft"
        >
          + New Garment
        </button>
      </div>

      {studioLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="border border-line bg-surface overflow-hidden animate-pulse">
              <div className="h-40 bg-line/30" />
              <div className="p-4 space-y-3">
                <div className="h-5 w-32 bg-line/30" />
                <div className="h-3 w-24 bg-line/20" />
              </div>
            </div>
          ))}
        </div>
      ) : garments.length === 0 ? (
        <div className="border border-dashed border-line py-14 text-center text-sm text-bone-dim">
          No garments yet. Create your first garment to start the pipeline.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {garments.map((garment) => (
            <GarmentCard
              key={garment.id}
              garment={garment}
              onDelete={(id) => {
                const g = garments.find((g) => g.id === id);
                if (g) setPendingDelete({ id: g.id, name: g.name });
              }}
            />
          ))}
        </div>
      )}
    </section>
  );

  return (
    <div className="min-h-screen bg-ink text-bone">
      <NavBar crumbs={[{ label: "Seasons", to: "/seasons" }, { label: season.code ?? "Untitled" }]} />

      <main className="mx-auto max-w-7xl px-8 py-6">
        <div className="mb-4 flex items-center justify-between px-0">
          <h1 className="font-display text-3xl font-bold tracking-tight text-bone">{season.code ?? "Untitled"}</h1>
          <span className="font-mono text-[11px] text-muted">{season.created_at.slice(0, 10)}</span>
        </div>

        <div className="mb-6 flex gap-0 border-b border-line">
          {SEASON_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`-mb-px border-b-2 px-4 py-2.5 font-mono text-xs uppercase tracking-wider transition-colors ${
                tab === t.key
                  ? "border-accent text-bone"
                  : "border-transparent text-muted hover:text-bone-dim"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "overview" && (
        <>
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold tracking-tight text-bone-dim">
              Moodboard
              {season.moodboard.name && (
                <span className="ml-2 font-normal text-accent"> — {season.moodboard.name}</span>
              )}
            </h2>
            {moodboardImages.length > 0 && (
              <span className="font-mono text-[11px] text-muted">
                {moodboardImages.length} images
              </span>
            )}
          </div>

          {moodboardImages.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 border border-dashed border-line py-16 text-center">
              <p className="text-sm text-bone-dim">
                No moodboard yet — import up to 12 images to set the mood for this season.
              </p>
              <button
                onClick={() => setMoodboardOpen(true)}
                className="bg-accent px-5 py-2 font-mono text-xs font-medium uppercase tracking-wider text-ink transition-colors hover:bg-accent-soft"
              >
                Start Moodboard
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-6 gap-px sm:grid-cols-8 lg:grid-cols-12">
                {moodboardImages.map((img, i) => (
                  <MoodboardTile
                    key={i}
                    src={img.url}
                    seed={seed}
                    index={i}
                    className="aspect-square"
                  />
                ))}
              </div>

              {status === "analyzing" && (
                <div className="mt-4 flex items-center gap-3 border border-accent/20 bg-accent/[0.03] px-5 py-4">
                  <i className="ti ti-loader-2 animate-spin text-lg text-accent" />
                  <span className="text-sm text-bone-dim">Analyzing your mood…</span>
                </div>
              )}

              {status === "failed" && (
                <div className="mt-6 border border-accent/20 bg-accent/[0.04] px-5 py-4">
                  <div className="flex items-start gap-3">
                    <i className="ti ti-alert-triangle mt-0.5 text-base text-accent/80" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-accent">Analysis failed</p>
                      <p className="mt-1 text-xs text-accent/60">
                        {season.moodboard.analysis.error ?? "Something went wrong. Please try again."}
                      </p>
                      <button
                        onClick={() => analyzeMoodboard(season!.id)}
                        className="mt-3 inline-flex items-center gap-1.5 border border-accent/20 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/20"
                      >
                        <i className="ti ti-refresh text-[11px]" />
                        Retry analysis
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {(palette.length > 0 || keywords.length > 0) && (
                <div className="mt-4 flex flex-col gap-4 bg-surface p-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-8">
                    {palette.length > 0 && (
                      <div>
                        <p className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-muted">Palette</p>
                        <PaletteSwatches colors={palette} />
                      </div>
                    )}
                    {keywords.length > 0 && (
                      <div>
                        <p className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-muted">Mood</p>
                        <KeywordChips keywords={keywords} />
                      </div>
                    )}
                  </div>

                  {brief && (
                    <div className="sm:max-w-xs">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-muted">Creative Brief</span>
                      <p className="mt-1 text-xs leading-relaxed text-bone-dim">{brief}</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </section>

        <div className="mt-10">{garmentsSection}</div>
        </>
        )}

        {tab === "prints" && (
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold tracking-tight text-bone-dim">Prints</h2>
              {tabImages.length > 0 && (
                <span className="font-mono text-[11px] text-muted">
                  {tabImages.length} prints
                </span>
              )}
            </div>
            {renderImageGrid(tabImages, "No prints yet. Generate prints from the garment workspace.")}
          </section>
        )}

        {tab === "fabrics" && (
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold tracking-tight text-bone-dim">Fabrics</h2>
              {tabImages.length > 0 && (
                <span className="font-mono text-[11px] text-muted">
                  {tabImages.length} fabrics
                </span>
              )}
            </div>
            {renderImageGrid(tabImages, "No fabrics yet. Upload fabric swatches from the Render stage.")}
          </section>
        )}

        {tab === "sketches" && (
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold tracking-tight text-bone-dim">Sketches</h2>
              {tabImages.length > 0 && (
                <span className="font-mono text-[11px] text-muted">
                  {tabImages.length} sketches
                </span>
              )}
            </div>
            {renderImageGrid(tabImages, "No sketches yet. Generate sketches from the garment workspace.")}
          </section>
        )}

        {tab === "firstRenders" && (
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold tracking-tight text-bone-dim">Renders</h2>
              {tabImages.length > 0 && (
                <span className="font-mono text-[11px] text-muted">
                  {tabImages.length} renders
                </span>
              )}
            </div>
            {renderImageGrid(tabImages, "No renders yet. Generate renders from the garment workspace.")}
          </section>
        )}

        {tab === "techPacks" && (
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold tracking-tight text-bone-dim">Tech Packs</h2>
              {tabImages.length > 0 && (
                <span className="font-mono text-[11px] text-muted">
                  {tabImages.length} tech packs
                </span>
              )}
            </div>
            {renderImageGrid(tabImages, "No tech packs yet. Generate tech packs from the garment workspace (Stage 4).")}
          </section>
        )}

        {tab === "patterns" && (
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold tracking-tight text-bone-dim">Patterns</h2>
              {tabImages.length > 0 && (
                <span className="font-mono text-[11px] text-muted">
                  {tabImages.length} patterns
                </span>
              )}
            </div>
            {renderImageGrid(tabImages, "No patterns yet. Generate patterns from the garment workspace (Stage 5).")}
          </section>
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
            <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-muted">
              Category
            </label>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORY_DEFS.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => setCategory(c.code)}
                  className={`border px-4 py-2.5 text-left text-sm transition-colors ${
                    category === c.code
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-line bg-ink text-bone-dim hover:border-accent/40"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <p className="font-mono text-[11px] text-muted">
            Name: <span className="text-bone-dim">{season?.code || "SS27"}_{"{CATEGORY}"}_{"{###}"}</span>
          </p>
          <button
            type="submit"
            disabled={!category}
            className="mt-1 bg-accent px-5 py-2.5 font-mono text-xs font-medium uppercase tracking-wider text-ink transition-colors hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-40"
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

      <Modal open={!!pendingDelete} onClose={() => !deleting && setPendingDelete(null)} title="Delete Garment">
        <p className="text-sm text-bone-dim">
          Are you sure you want to delete <span className="font-medium text-bone">{pendingDelete?.name}</span>? This will remove all its pipeline runs and generated images. This action cannot be undone.
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
                await deleteGarment(pendingDelete.id);
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
