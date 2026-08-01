import { useEffect, useState, useCallback, useRef } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { NavBar } from "../components/NavBar";
import { StageProgressBar } from "../components/StageProgressBar";
import { StageOutputPanel } from "../components/StageOutputPanel";
import { SketchTool } from "../components/stages/SketchTool";
import { PrintTool, type PrintState } from "../components/stages/PrintTool";
import { RenderTool, type RenderState } from "../components/stages/RenderTool";
import { TechPackTool } from "../components/stages/TechPackTool";
import { TechPackOutputPanel } from "../components/stages/TechPackOutputPanel";
import { PatternTool } from "../components/stages/PatternTool";
import { PatternOutputPanel } from "../components/stages/PatternOutputPanel";
import { VisualizationTool } from "../components/stages/VisualizationTool";
import { PhotoshootTool } from "../components/stages/PhotoshootTool";
import { useStudio } from "../state/StudioContext";
import { listImagesForGarment, toggleLike, toggleStar } from "../api/designImages";
import type { DesignImage, NodeKey } from "../types";
import { NODE_DEFS } from "../data/mockData";

const STAGE_NODE_KEYS: NodeKey[] = [
  "sketch", "print", "render", "techPack", "pattern", "visualization", "photoshoot",
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
  const [pendingCount, setPendingCount] = useState(0);

  // Print canvas state
  const [printState, setPrintState] = useState<PrintState>({
    motifImage: null,
    motifFile: null,
    scale: 1.0,
    rotation: 0,
    spacingX: 0,
    spacingY: 0,
    repeatType: "block",
    fabricType: "cotton",
    bgColor: "#ffffff",
    canvasSize: 1024,
  });

  // Render state
  const [_renderState, setRenderState] = useState<RenderState>({
    sketchImage: null,
    gender: "male",
    fabrics: [{ image: null, placements: [], prompt: "", scale: 1.0 }],
    numOutputs: 1,
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Fetch images for this garment + stage
  const fetchImages = async () => {
    if (!garmentId) return;
    setLoading(true);
    console.log(`[STAGE] Fetching images for garment=${garmentId}, stage=${currentStage}`);
    try {
      const data = await listImagesForGarment(garmentId, { node_key: currentStage });
      console.log(`[STAGE] Fetched ${data.length} images for stage=${currentStage}`);
      setImages(data);
    } catch (e) {
      console.error("[STAGE] Failed to load images:", e);
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

  const handleStartGenerating = (count: number) => {
    setPendingCount(count);
  };

  const handleUploadStatus = (uploading: boolean) => {
    if (uploading) {
      setPendingCount(1);
    } else {
      setPendingCount(0);
      fetchImages();
    }
  };

  const handleGenerated = (response: any) => {
    console.log("[STAGE] Generation complete — re-fetching images. Response:", {
      runCode: response?.run?.code,
      imageCount: response?.images?.length,
      success: response?.success,
    });
    setPendingCount(0);
    // Re-fetch images to include the new ones
    fetchImages();
  };

  const handleExport = () => {
    const likedImages = images.filter((img) => img.liked);
    likedImages.forEach((img, i) => {
      setTimeout(async () => {
        try {
          const resp = await fetch(img.url);
          const blob = await resp.blob();
          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = blobUrl;
          a.download = `${img.image_code}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(blobUrl);
        } catch {
          window.open(img.url, "_blank");
        }
      }, i * 200);
    });
  };

  const handlePrintStateChange = useCallback((newState: Partial<PrintState>) => {
    setPrintState((prev) => ({ ...prev, ...newState }));
  }, []);

  const handleRenderStateChange = useCallback((newState: Partial<RenderState>) => {
    setRenderState((prev) => ({ ...prev, ...newState }));
  }, []);

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

  // Canvas preview for print stage
  const printCanvasPreview = currentStage === "print" ? (
    <PrintCanvasPreview state={printState} canvasRef={canvasRef} />
  ) : undefined;

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
            onStartGenerating={handleStartGenerating}
            onUploadStatus={handleUploadStatus}
          />
        )}

        {currentStage === "print" && (
          <PrintTool
            garment={garment}
            season={season}
            onGenerated={handleGenerated}
            onStateChange={handlePrintStateChange}
            canvasRef={canvasRef}
            onStartGenerating={handleStartGenerating}
          />
        )}

        {currentStage === "render" && (
          <RenderTool
            garment={garment}
            season={season}
            onGenerated={handleGenerated}
            onStateChange={handleRenderStateChange}
            onStartGenerating={handleStartGenerating}
          />
        )}

        {currentStage === "techPack" && (
          <TechPackTool
            garment={garment}
            season={season}
            onGenerated={handleGenerated}
            renders={images}
            onStartGenerating={handleStartGenerating}
          />
        )}

        {currentStage === "pattern" && (
          <PatternTool
            garment={garment}
            season={season}
            onGenerated={handleGenerated}
            techPacks={images}
            onStartGenerating={handleStartGenerating}
          />
        )}

        {currentStage === "visualization" && (
          <VisualizationTool
            garment={garment}
            season={season}
            onGenerated={handleGenerated}
            onStartGenerating={handleStartGenerating}
          />
        )}

        {currentStage === "photoshoot" && (
          <PhotoshootTool
            garment={garment}
            season={season}
            onGenerated={handleGenerated}
            onStartGenerating={handleStartGenerating}
          />
        )}

        {currentStage !== "sketch" && currentStage !== "print" && currentStage !== "render" && currentStage !== "techPack" && currentStage !== "pattern" && currentStage !== "visualization" && currentStage !== "photoshoot" && (
          <aside className="flex w-full flex-col items-center justify-center bg-surface p-8 lg:w-[480px]">
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
          {currentStage === "techPack" ? (
            <TechPackOutputPanel
              images={images}
              imageType="tech_pack"
              onRefresh={fetchImages}
              pendingCount={pendingCount}
              onNextStage={handleNextStage}
              nextStageLabel={getNextStageLabel()}
            />
          ) : currentStage === "pattern" ? (
            <PatternOutputPanel
              images={images}
              imageType="pattern"
              onRefresh={fetchImages}
              pendingCount={pendingCount}
              onNextStage={handleNextStage}
              nextStageLabel={getNextStageLabel()}
            />
          ) : (
            <StageOutputPanel
              images={images}
              loading={loading}
              onToggleLike={handleToggleLike}
              onToggleStar={handleToggleStar}
              onNextStage={handleNextStage}
              nextStageLabel={getNextStageLabel()}
              canvasPreview={printCanvasPreview}
              isFinalStage={currentStage === "photoshoot"}
              onExport={handleExport}
              pendingCount={pendingCount}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Print Canvas Preview ──────────────────────────────────────────

function PrintCanvasPreview({
  state,
  canvasRef,
}: {
  state: PrintState;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !state.motifImage) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      const displaySize = 600;
      canvas.width = displaySize;
      canvas.height = displaySize;

      // Draw background
      if (state.bgColor.toLowerCase() !== "transparent") {
        ctx.fillStyle = state.bgColor;
        ctx.fillRect(0, 0, displaySize, displaySize);
      } else {
        ctx.clearRect(0, 0, displaySize, displaySize);
        const checkSize = 10;
        for (let y = 0; y < displaySize; y += checkSize) {
          for (let x = 0; x < displaySize; x += checkSize) {
            ctx.fillStyle =
              (Math.floor(x / checkSize) + Math.floor(y / checkSize)) % 2 === 0
                ? "#cccccc"
                : "#ffffff";
            ctx.fillRect(x, y, checkSize, checkSize);
          }
        }
      }

      const tileW = Math.max(10, img.width * state.scale);
      const tileH = Math.max(10, img.height * state.scale);
      const cellW = tileW + state.spacingX;
      const cellH = tileH + state.spacingY;

      const cols = Math.ceil(displaySize / cellW) + 2;
      const rows = Math.ceil(displaySize / cellH) + 2;
      const startX = -cellW;
      const startY = -cellH;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          let x = startX + c * cellW;
          let y = startY + r * cellH;

          if (state.repeatType === "half-drop" && c % 2 === 1) {
            y += cellH / 2;
          } else if (state.repeatType === "brick" && r % 2 === 1) {
            x += cellW / 2;
          }

          ctx.save();
          ctx.translate(x + tileW / 2, y + tileH / 2);

          if (state.rotation !== 0) {
            ctx.rotate((state.rotation * Math.PI) / 180);
          }

          let scaleX = 1;
          let scaleY = 1;
          if (state.repeatType === "mirror") {
            if (c % 2 === 1) scaleX = -1;
            if (r % 2 === 1) scaleY = -1;
          }
          ctx.scale(scaleX, scaleY);

          ctx.drawImage(img, -tileW / 2, -tileH / 2, tileW, tileH);
          ctx.restore();
        }
      }
    };
    img.src = state.motifImage;
  }, [
    state.motifImage,
    state.scale,
    state.rotation,
    state.spacingX,
    state.spacingY,
    state.repeatType,
    state.bgColor,
    canvasRef,
  ]);

  if (!state.motifImage) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <i className="ti ti-photo text-4xl text-muted" />
        <p className="text-sm text-muted">Upload a motif to see preview</p>
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className="max-h-full max-w-full rounded-lg border border-line"
      style={{ objectFit: "contain" }}
    />
  );
}
