import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { NavBar } from "../components/NavBar";
import { NodeCard } from "../components/NodeCard";
import { PaletteSwatches } from "../components/PaletteSwatches";
import { Modal } from "../components/Modal";
import { PlaceholderTile } from "../components/PlaceholderTile";
import { useStudio } from "../state/StudioContext";
import { NODE_DEFS } from "../data/mockData";
import type { NodeDef } from "../types";

export function GarmentDetailPage() {
  const { seasonId, garmentId } = useParams<{ seasonId: string; garmentId: string }>();
  const { getSeason, getGarment } = useStudio();
  const [activeNode, setActiveNode] = useState<NodeDef | null>(null);

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

  return (
    <div className="min-h-screen bg-ink text-bone">
      <NavBar
        crumbs={[
          { label: "Seasons", to: "/seasons" },
          { label: season.name, to: `/seasons/${season.id}` },
          { label: garment.name },
        ]}
      />

      <main className="mx-auto max-w-6xl px-6 py-14">
        <div className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-5">
            <PlaceholderTile seed={garment.seed} className="h-20 w-20 rounded-xl" />
            <div>
              <h1 className="font-display text-4xl text-bone">{garment.name}</h1>
              <p className="mt-1 text-sm text-bone-dim">
                Inspired by <span className="text-brass">{season.name}</span>
              </p>
            </div>
          </div>
          <PaletteSwatches colors={season.palette} size="sm" />
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {NODE_DEFS.map((def) => (
            <NodeCard
              key={def.key}
              def={def}
              status={garment.nodeStatus[def.key]}
              onOpen={() => setActiveNode(def)}
            />
          ))}
        </div>
      </main>

      <Modal
        open={activeNode !== null}
        onClose={() => setActiveNode(null)}
        title={activeNode?.label ?? ""}
      >
        <p className="text-sm text-bone-dim">{activeNode?.hint}</p>
        <div className="mt-4 rounded-lg border border-dashed border-line px-4 py-10 text-center text-sm text-muted">
          This node's tool isn't wired up yet — it'll drop in here.
        </div>
      </Modal>
    </div>
  );
}
