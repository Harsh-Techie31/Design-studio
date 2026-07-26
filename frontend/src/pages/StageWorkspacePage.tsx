import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { NavBar } from "../components/NavBar";
import { StageProgressBar } from "../components/StageProgressBar";
import { StageOutputPanel } from "../components/StageOutputPanel";
import { SketchTool } from "../components/stages/SketchTool";
import { useStudio } from "../state/StudioContext";
import { listImagesForGarment, toggleLike, toggleStar } from "../api/designImages";
import type { DesignImage, NodeKey, SketchGenerateResponse } from "../types";
import { NODE_DEFS } from "../data/mockData";

const STAGE_NODE_KEYS: NodeKey[] = [
  "sketch", "fabric", "render", "techPack", "pattern", "visualization", "photoshoot",
];

export function StageWorkspacePage() {
  const { seasonId, garmentId, nodeKey } = useParams<{
    seasonId: string;
    garmentId: string;
    nodeKey: string;
  }>();
  const navigate = useNavigate();
  const { getSeason, getGarment } = useStudio();

  const season = getSeason(seasonId ?? "");
  const garment = getGarment(garmentId ?? "");
  const currentStage = (nodeKey as NodeKey) || "sketch";

  const [images, setImages] = useState<DesignImage[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch images for this garment + stage
  const fetchImages = async () => {
    if (!garmentId) return;
    setLoading(true);
    try {
      const data = await listImagesForGarment(garmentId, { node_key: currentStage });
      setImages(data);
    } catch (e) {
      console.error("Failed to load images:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchImages();
  }, [garmentId, currentStage]);

  const handleToggleLike = async (imageId: string) => {
    try {
      const updated = await toggleLike(imageId);
      setImages((prev) => prev.map((img) => (img.id === imageId ? updated : img)));
    } catch (e) {
      console.error("Failed to toggle like:", e);
    }
  };

  const handleToggleStar = async (imageId: string) => {
    try {
      const updated = await toggleStar(imageId);
      setImages((prev) => prev.map((img) => (img.id === imageId ? updated : img)));
    } catch (e) {
      console.error("Failed to toggle star:", e);
    }
  };

  const handleGenerated = (response: SketchGenerateResponse) => {
    // Re-fetch images to include the new ones
    fetchImages();
  };

  const handleNextStage = () => {
    const currentIdx = STAGE_NODE_KEYS.indexOf(currentStage);
    if (currentIdx < STAGE_NODE_KEYS.length - 1) {
      const nextKey = STAGE_NODE_KEYS[currentIdx + 1];
      navigate(`/seasons/${seasonId}/garments/${garmentId}/stage/${nextKey}`);
    }
  };

  const getNextStageLabel = () => {
    const currentIdx = STAGE_NODE_KEYS.indexOf(currentStage);
    if (currentIdx < STAGE_NODE_KEYS.length - 1) {
      const nextDef = NODE_DEFS.find((d) => d.key === STAGE_NODE_KEYS[currentIdx + 1]);
      return `Proceed to ${nextDef?.label || "Next Stage"}`;
    }
    return "Final Stage";
  };

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
    <div className="flex h-screen flex-col bg-ink text-bone">
      {/* Top NavBar */}
      <NavBar
        crumbs={[
          { label: "Seasons", to: "/seasons" },
          { label: season.code ?? "Untitled", to: `/seasons/${season.id}` },
          {
            label: garment.name,
            to: `/seasons/${season.id}/garments/${garment.id}`,
          },
          { label: NODE_DEFS.find((d) => d.key === currentStage)?.label || currentStage },
        ]}
      />

      {/* Stage Progress Bar */}
      <StageProgressBar
        seasonId={season.id}
        garmentId={garment.id}
        currentStage={currentStage}
        garmentSummary={garment.node_summary}
      />

      {/* Main workspace: Left Panel + Right Panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel — stage-specific tool */}
        {currentStage === "sketch" && (
          <SketchTool
            garment={garment}
            season={season}
            onGenerated={handleGenerated}
          />
        )}

        {currentStage !== "sketch" && (
          <aside className="flex w-full flex-col items-center justify-center bg-surface p-8 lg:w-[350px]">
            <i className="ti ti-tools text-3xl text-muted" />
            <p className="mt-3 text-sm text-muted">
              {NODE_DEFS.find((d) => d.key === currentStage)?.label} tool coming soon
            </p>
            <p className="mt-1 text-xs text-muted">
              {NODE_DEFS.find((d) => d.key === currentStage)?.hint}
            </p>
          </aside>
        )}

        {/* Right Panel — output grid */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <StageOutputPanel
            images={images}
            loading={loading}
            onToggleLike={handleToggleLike}
            onToggleStar={handleToggleStar}
            onNextStage={handleNextStage}
            nextStageLabel={getNextStageLabel()}
          />
        </div>
      </div>
    </div>
  );
}
