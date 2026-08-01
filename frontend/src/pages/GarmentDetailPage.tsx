import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { NavBar } from "../components/NavBar";
import { NodeCard } from "../components/NodeCard";
import { PaletteSwatches } from "../components/PaletteSwatches";
import { PlaceholderTile } from "../components/PlaceholderTile";
import { useStudio } from "../state/StudioContext";
import { NODE_DEFS } from "../data/mockData";
import { seedFromId } from "../types";
import { listImagesForGarment } from "../api/designImages";

export function GarmentDetailPage() {
  const { seasonId, garmentId } = useParams<{ seasonId: string; garmentId: string }>();
  const { getSeason, getGarment } = useStudio();
  const navigate = useNavigate();

  const season = getSeason(seasonId ?? "");
  const garment = getGarment(garmentId ?? "");

  if (!season || !garment) {
    return (
      <div className="min-h-screen bg-ink text-bone">
        <NavBar />
        <main className="mx-auto max-w-6xl px-6 py-24 text-center">
          <p className="text-bone-dim">Garment not found.</p>
          <Link to="/seasons" className="mt-4 inline-block text-brass hover:text-brass-soft">
            Back to Seasons
          </Link>
        </main>
      </div>
    );
  }

  const seed = seedFromId(garment.id);
  const palette = season.moodboard.analysis.palette;
  const [bestImage, setBestImage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchBestImage = async () => {
      try {
        const allImages = await listImagesForGarment(garment.id);
        if (cancelled || allImages.length === 0) return;
        for (const key of ["photoshoot", "render", "sketch"]) {
          const match = allImages.find((img) => img.node_key === key);
          if (match?.url) {
            setBestImage(match.url);
            return;
          }
        }
      } catch {}
    };
    fetchBestImage();
    return () => { cancelled = true; };
  }, [garment.id]);

  return (
    <div className="min-h-screen bg-ink text-bone">
      <NavBar
        crumbs={[
          { label: "Seasons", to: "/seasons" },
          { label: season.code ?? "Untitled", to: `/seasons/${season.id}` },
          { label: garment.name },
        ]}
      />

      <main className="mx-auto max-w-6xl px-6 py-14">
        <div className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-5">
            {bestImage ? (
              <img
                src={bestImage}
                alt={garment.name}
                className="h-20 w-20 rounded-xl object-cover"
              />
            ) : (
              <PlaceholderTile seed={seed} className="h-20 w-20 rounded-xl" />
            )}
            <div>
              <h1 className="font-display text-4xl text-bone">{garment.name}</h1>
              <p className="mt-1 text-sm text-bone-dim">
                Inspired by{" "}
                <Link to={`/seasons/${season.id}`} className="text-brass hover:text-brass-soft">
                  {season.moodboard.name ?? season.code}
                </Link>
              </p>
            </div>
          </div>
          <PaletteSwatches colors={palette} size="sm" />
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {NODE_DEFS.map((def) => (
            <NodeCard
              key={def.key}
              def={def}
              summary={garment.node_summary[def.key]}
              onOpen={() =>
                navigate(`/seasons/${season.id}/garments/${garment.id}/stage/${def.key}`)
              }
            />
          ))}
        </div>
      </main>
    </div>
  );
}
