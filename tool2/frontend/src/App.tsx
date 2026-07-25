import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Upload,
  Image as ImageIcon,
  Plus,
  Minus,
  Trash2,
  RefreshCw,
  Sliders,
  Download,
  AlertCircle,
  Heart,
  Grid,
  ChevronRight
} from "lucide-react";

// Pre-defined premium SVG patterns to use as default presets
const PRESETS = [
  {
    name: "Orange Hibiscus",
    id: "hibiscus",
    url: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="200" height="200"><path d="M50 15 C40 10 30 20 35 35 C20 30 10 40 15 50 C10 60 20 70 35 65 C30 80 40 90 50 85 C60 90 70 80 65 65 C80 70 90 60 85 50 C90 40 80 30 65 35 C70 20 60 10 50 15 Z" fill="%23d97706" opacity="0.95" /><path d="M50 25 C45 20 38 28 41 38 C30 35 22 42 26 50 C22 58 30 65 41 62 C38 72 45 80 50 75 C55 80 62 72 59 62 C70 65 78 58 74 50 C78 42 70 35 59 38 C62 28 55 20 50 25 Z" fill="%23b45309" opacity="0.9" /><circle cx="50" cy="50" r="10" fill="%23f59e0b" /><path d="M50 50 L50 25 M50 50 L68 38 M50 50 L68 62 M50 50 L50 75 M50 50 L32 62 M50 50 L32 38" stroke="%2378350f" stroke-width="2.5" stroke-linecap="round" /><circle cx="50" cy="25" r="3" fill="%23ef4444" /><circle cx="68" cy="38" r="3" fill="%23ef4444" /><circle cx="68" cy="62" r="3" fill="%23ef4444" /><circle cx="50" cy="75" r="3" fill="%23ef4444" /><circle cx="32" cy="62" r="3" fill="%23ef4444" /><circle cx="32" cy="38" r="3" fill="%23ef4444" /></svg>`
  },
  {
    name: "Tropical Monstera",
    id: "monstera",
    url: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="200" height="200"><path d="M50 10 C25 10 15 30 15 55 C15 75 30 90 50 90 C70 90 85 75 85 55 C85 30 75 10 50 10 Z" fill="%23059669" /><path d="M50 90 L50 10" stroke="%23047857" stroke-width="4" stroke-linecap="round" /><path d="M50 30 Q30 35 20 32 M50 45 Q25 50 10 45 M50 60 Q28 70 18 80 M50 30 Q70 35 80 32 M50 45 Q75 50 90 45 M50 60 Q72 70 82 80" stroke="%23047857" stroke-width="3.5" stroke-linecap="round" /><path d="M30 25 C25 25 22 30 25 35 C28 40 35 35 30 25 Z M20 42 C15 42 12 48 15 53 C18 58 25 53 20 42 Z M70 25 C75 25 78 30 75 35 C72 40 65 35 70 25 Z M80 42 C85 42 88 48 85 53 C82 58 75 53 80 42 Z" fill="%230b0c0e" /></svg>`
  },
  {
    name: "Golden Deco",
    id: "deco",
    url: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="200" height="200"><path d="M50 5 L95 50 L50 95 L5 50 Z" fill="none" stroke="%23d97706" stroke-width="3" /><path d="M50 15 L85 50 L50 85 L15 50 Z" fill="none" stroke="%23f59e0b" stroke-width="2" /><path d="M50 25 L75 50 L50 75 L25 50 Z" fill="none" stroke="%23fbbf24" stroke-width="1.5" /><circle cx="50" cy="50" r="12" fill="%23b45309" stroke="%23f59e0b" stroke-width="1.5" /><line x1="50" y1="5" x2="50" y2="95" stroke="%23d97706" stroke-width="1.5" /><line x1="5" y1="50" x2="95" y2="50" stroke="%23d97706" stroke-width="1.5" /></svg>`
  }
];

interface PantoneColor {
  name: string;
  hex: string;
}

// Extensive, elegant palette of standard fashion & design Pantone shades
const PANTONE_LIBRARY: PantoneColor[] = [
  { name: "PANTONE 11-0104 TCX (Pearled Ivory)", hex: "#fcf8f2" },
  { name: "PANTONE 11-0601 TCX (Bright White)", hex: "#ffffff" },
  { name: "PANTONE 12-0304 TCX (Hemlock)", hex: "#e2e8dd" },
  { name: "PANTONE 14-1907 TCX (Peach Blossom)", hex: "#ebd3d4" },
  { name: "PANTONE 19-3921 TCX (Black Iris)", hex: "#1e293b" },
  { name: "PANTONE 19-4010 TCX (Total Eclipse)", hex: "#0f172a" },
  { name: "PANTONE 19-4005 TCX (Stretch Limo)", hex: "#111827" },
  { name: "PANTONE 13-0905 TCX (Birch)", hex: "#dfd5c6" },
  { name: "PANTONE 16-1325 TCX (Copper)", hex: "#b27a56" },
  { name: "PANTONE 18-1244 TCX (Ginger Bread)", hex: "#8c5638" },
  { name: "PANTONE 19-1559 TCX (Red Pear)", hex: "#7a2a32" },
  { name: "PANTONE 17-1564 TCX (Fiesta)", hex: "#dd4132" },
  { name: "PANTONE 15-1157 TCX (Flame Orange)", hex: "#f05a28" },
  { name: "PANTONE 12-0736 TCX (Lemon)", hex: "#f5d042" },
  { name: "PANTONE 15-0343 TCX (Greenery)", hex: "#88b04b" },
  { name: "PANTONE 19-4052 TCX (Classic Blue)", hex: "#0f4c81" },
  { name: "PANTONE 18-3838 TCX (Ultra Violet)", hex: "#5f4b8b" },
  { name: "PANTONE 16-1546 TCX (Living Coral)", hex: "#ff6f61" },
  { name: "PANTONE 17-5104 TCX (Ultimate Gray)", hex: "#939597" },
  { name: "PANTONE 13-1520 TCX (Rose Quartz)", hex: "#f7cac9" },
  { name: "PANTONE 15-3919 TCX (Serenity)", hex: "#91a8d0" },
  { name: "PANTONE 18-1438 TCX (Marsala)", hex: "#955251" },
  { name: "PANTONE 15-5217 TCX (Blue Turquoise)", hex: "#53b0ae" },
  { name: "PANTONE 14-0848 TCX (Mimosa)", hex: "#f0c05a" },
  { name: "PANTONE 18-2045 TCX (Pink Flambé)", hex: "#e2583e" },
  { name: "PANTONE 18-1662 TCX (Flame Scarlet)", hex: "#cd212a" },
  { name: "PANTONE 19-4526 TCX (Blue Lagoon)", hex: "#005c6a" },
  { name: "PANTONE 19-0303 TCX (Jet Black)", hex: "#131313" },
  { name: "PANTONE 11-4001 TCX (Brilliant White)", hex: "#f4f5f0" },
  { name: "PANTONE 13-1023 TCX (Peach Fuzz)", hex: "#ffbe98" },
  { name: "PANTONE 18-1750 TCX (Viva Magenta)", hex: "#be3455" },
  { name: "PANTONE 17-3938 TCX (Very Peri)", hex: "#6667ab" },
  { name: "PANTONE 19-4027 TCX (Indigo)", hex: "#2b304a" },
  { name: "PANTONE 14-4112 TCX (Sky Blue)", hex: "#a1c2db" },
  { name: "PANTONE 16-1452 TCX (Firecracker)", hex: "#f36942" },
  { name: "PANTONE 19-1759 TCX (Port)", hex: "#6b2a3a" },
  { name: "PANTONE 14-4514 TCX (Turquoise)", hex: "#45b5c4" },
  { name: "PANTONE 15-1247 TCX (Tangerine)", hex: "#f38b3c" },
  { name: "PANTONE 18-3224 TCX (Radiant Orchid)", hex: "#b163a3" }
];

function hexToRgb(hex: string) {
  const cleaned = hex.replace("#", "");
  if (cleaned.length !== 6) return { r: 255, g: 255, b: 255 };
  const r = parseInt(cleaned.substring(0, 2), 16);
  const g = parseInt(cleaned.substring(2, 4), 16);
  const b = parseInt(cleaned.substring(4, 6), 16);
  return { r, g, b };
}

function getClosestPantone(hex: string): string {
  const { r: r1, g: g1, b: b1 } = hexToRgb(hex);
  let closestName = "PANTONE Custom Shade";
  let minDistance = Infinity;

  for (const pantone of PANTONE_LIBRARY) {
    const { r: r2, g: g2, b: b2 } = hexToRgb(pantone.hex);
    const dist = Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
    if (dist < minDistance) {
      minDistance = dist;
      closestName = pantone.name;
    }
  }
  return closestName;
}

export default function App() {
  // Upload and Image Preview States
  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [selectedPresetId, setSelectedPresetId] = useState<string>("hibiscus");
  
  // Replication Controls
  const [scale, setScale] = useState<number>(1.0);
  const [repeatType] = useState<string>("block"); // block, half-drop, brick, mirror
  const [backgroundColor, setBackgroundColor] = useState<string>("#fcf8f2"); // Creamy elegant fabric background
  const [isTransparent, setIsTransparent] = useState<boolean>(false);
  const [spacingX, setSpacingX] = useState<number>(0);
  const [spacingY, setSpacingY] = useState<number>(0);
  const [rotation, setRotation] = useState<number>(0);
  
  // Advanced background removal / Chroma-Keying
  const [removeBg, setRemoveBg] = useState<boolean>(false);
  const [bgThreshold, setBgThreshold] = useState<number>(30);
  const [bgTargetColor, setBgTargetColor] = useState<{ r: number; g: number; b: number }>({ r: 255, g: 255, b: 255 });
  const [bgSampleHex, setBgSampleHex] = useState<string>("#ffffff");

  // Output Resolution Settings
  const [canvasResolution, setCanvasResolution] = useState<number>(1024);
  const [isGeneratingHighRes, setIsGeneratingHighRes] = useState<boolean>(false);
  const [highResImageUrl, setHighResImageUrl] = useState<string>("");

  // Canvas Refs for Rendering
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Active status feedback
  const [isLiked, setIsLiked] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Pre-loaded Swatches for background color selection
  const colorSwatches = [
    { name: "Cream Soft", hex: "#fcf8f2" },
    { name: "Sage Pastel", hex: "#e2e8dd" },
    { name: "Dusty Rose", hex: "#ebd3d4" },
    { name: "Slate Dark", hex: "#1e293b" },
    { name: "Navy Rich", hex: "#0f172a" },
    { name: "Charcoal Deep", hex: "#111827" },
    { name: "White Blank", hex: "#ffffff" }
  ];

  // Load preset or user image into HTML Image object
  useEffect(() => {
    // Determine the image source URL
    let urlToLoad = previewUrl;
    if (!urlToLoad) {
      const preset = PRESETS.find(p => p.id === selectedPresetId);
      urlToLoad = preset ? preset.url : PRESETS[0].url;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = urlToLoad;
    img.onload = () => {
      setSourceImage(img);
      setErrorMessage("");
    };
    img.onerror = () => {
      setErrorMessage("Failed to load selected motif image structure.");
    };
  }, [previewUrl, selectedPresetId]);

  // Handle local File Upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setSelectedPresetId(""); // Reset preset selection
    }
  };

  const clearImage = () => {
    setPreviewUrl("");
    setSelectedPresetId("hibiscus");
    setScale(1.0);
    setRotation(0);
    setSpacingX(0);
    setSpacingY(0);
    setRemoveBg(false);
  };

  // Helper function to color distance
  const getColorDistance = (r1: number, g1: number, b1: number, r2: number, g2: number, b2: number) => {
    return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
  };

  // Draw Tiled Pattern onto the Canvas in real-time
  useEffect(() => {
    if (!sourceImage || !previewCanvasRef.current) return;

    const canvas = previewCanvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set preview canvas layout sizing (we draw at 800x800 for high performance view)
    const drawWidth = 800;
    const drawHeight = 800;
    canvas.width = drawWidth;
    canvas.height = drawHeight;

    // 1. Fill background on canvas
    ctx.clearRect(0, 0, drawWidth, drawHeight);
    if (!isTransparent) {
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, drawWidth, drawHeight);
    }

    // 2. Create offscreen canvas to process the motif tile (handles scale, rotation, spacing, chroma BG removal)
    const tileCanvas = document.createElement("canvas");
    const tileCtx = tileCanvas.getContext("2d");
    if (!tileCtx) return;

    // Original dimension of motif
    const origW = sourceImage.width || 100;
    const origH = sourceImage.height || 100;

    // Scale-based tile dimensions
    let tileW = Math.max(10, Math.floor(origW * scale));
    let tileH = Math.max(10, Math.floor(origH * scale));

    // Handle Rotation bounds resizing
    let rotRad = (rotation * Math.PI) / 180;
    let boundW = tileW;
    let boundH = tileH;
    
    if (rotation !== 0) {
      // Calculate bounding box for rotated tile so we don't clip corners
      boundW = Math.ceil(Math.abs(tileW * Math.cos(rotRad)) + Math.abs(tileH * Math.sin(rotRad)));
      boundH = Math.ceil(Math.abs(tileW * Math.sin(rotRad)) + Math.abs(tileH * Math.cos(rotRad)));
    }

    tileCanvas.width = boundW;
    tileCanvas.height = boundH;

    // Draw original image onto offscreen canvas to perform pixel analysis if removing background
    const analysisCanvas = document.createElement("canvas");
    analysisCanvas.width = origW;
    analysisCanvas.height = origH;
    const analysisCtx = analysisCanvas.getContext("2d");
    
    if (analysisCtx) {
      analysisCtx.drawImage(sourceImage, 0, 0, origW, origH);
      
      // If chroma-key background removal is active
      if (removeBg) {
        const imgData = analysisCtx.getImageData(0, 0, origW, origH);
        const data = imgData.data;
        const targetR = bgTargetColor.r;
        const targetG = bgTargetColor.g;
        const targetB = bgTargetColor.b;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          
          const dist = getColorDistance(r, g, b, targetR, targetG, targetB);
          if (dist <= bgThreshold) {
            data[i + 3] = 0; // Set alpha to transparent
          }
        }
        // Write back cleaned pixels
        analysisCtx.putImageData(imgData, 0, 0);
      }
    }

    // Draw & Rotate processed motif onto our tile canvas
    tileCtx.save();
    tileCtx.translate(boundW / 2, boundH / 2);
    if (rotation !== 0) {
      tileCtx.rotate(rotRad);
    }
    // Draw from processed analysis canvas
    tileCtx.drawImage(analysisCanvas, -tileW / 2, -tileH / 2, tileW, tileH);
    tileCtx.restore();

    // 3. Tile drawing on main canvas
    const cellW = boundW + spacingX;
    const cellH = boundH + spacingY;

    // Cover standard area with buffers to support offsets bleed-over
    const cols = Math.ceil(drawWidth / cellW) + 2;
    const rows = Math.ceil(drawHeight / cellH) + 2;

    const startX = -cellW;
    const startY = -cellH;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        let x = startX + (c * cellW);
        let y = startY + (r * cellH);

        // Layout repeat configurations
        if (repeatType === "half-drop") {
          // Odd columns shifted down vertically by 50%
          if (c % 2 === 1) {
            y += Math.floor(cellH / 2);
          }
        } else if (repeatType === "brick") {
          // Odd rows shifted right horizontally by 50%
          if (r % 2 === 1) {
            x += Math.floor(cellW / 2);
          }
        }

        // Draw the tile with potential mirroring operations
        if (repeatType === "mirror") {
          const flipH = (c % 2 === 1);
          const flipV = (r % 2 === 1);

          ctx.save();
          // Translate to center of target tile cell
          ctx.translate(x + boundW / 2, y + boundH / 2);
          // Scale negatively for mirroring flips
          ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
          ctx.drawImage(tileCanvas, -boundW / 2, -boundH / 2);
          ctx.restore();
        } else {
          // Normal draw
          ctx.drawImage(tileCanvas, x, y);
        }
      }
    }
  }, [
    sourceImage,
    scale,
    repeatType,
    backgroundColor,
    isTransparent,
    spacingX,
    spacingY,
    rotation,
    removeBg,
    bgThreshold,
    bgTargetColor
  ]);

  // Handle Canvas Pixel color-grabber sampler for background removal
  const handleCanvasSamplerClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!sourceImage) return;
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Map screen click coordinate to actual image space
    const xRatio = sourceImage.width / rect.width;
    const yRatio = sourceImage.height / rect.height;
    const imgX = Math.floor(clickX * xRatio);
    const imgY = Math.floor(clickY * yRatio);

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = sourceImage.width;
    tempCanvas.height = sourceImage.height;
    const tempCtx = tempCanvas.getContext("2d");
    if (!tempCtx) return;

    tempCtx.drawImage(sourceImage, 0, 0);
    try {
      const pixel = tempCtx.getImageData(imgX, imgY, 1, 1).data;
      const r = pixel[0];
      const g = pixel[1];
      const b = pixel[2];
      setBgTargetColor({ r, g, b });
      
      const hex = "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
      setBgSampleHex(hex);
      setRemoveBg(true); // Automatically turn on background removal
    } catch (err) {
      console.error("Failed to sample color due to cross-origin limitations.", err);
    }
  };

  // Convert Hex string to RGB
  const handleHexInputChange = (hex: string) => {
    setBgSampleHex(hex);
    const cleaned = hex.replace("#", "");
    if (cleaned.length === 6) {
      const r = parseInt(cleaned.substring(0, 2), 16);
      const g = parseInt(cleaned.substring(2, 4), 16);
      const b = parseInt(cleaned.substring(4, 6), 16);
      if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
        setBgTargetColor({ r, g, b });
      }
    }
  };

  // Trigger high-fidelity rendering pipeline using the python FastAPI backend
  const handleBackendGenerate = async () => {
    if (!sourceImage) {
      setErrorMessage("Please upload a fabric/motif first.");
      return;
    }

    setIsGeneratingHighRes(true);
    setErrorMessage("");
    setHighResImageUrl("");

    try {
      // 1. Prepare Form Data
      const formData = new FormData();
      
      // Determine image file blob
      let fileToUpload: Blob;
      if (previewUrl) {
        const response = await fetch(previewUrl);
        fileToUpload = await response.blob();
      } else {
        const preset = PRESETS.find(p => p.id === selectedPresetId);
        const response = await fetch(preset ? preset.url : PRESETS[0].url);
        fileToUpload = await response.blob();
      }

      formData.append("motif_image", fileToUpload, "motif.png");
      formData.append("scale", scale.toString());
      formData.append("repeat_type", repeatType);
      formData.append("background_color", isTransparent ? "transparent" : backgroundColor);
      formData.append("remove_bg", removeBg.toString());
      formData.append("bg_threshold", bgThreshold.toString());
      formData.append("bg_target_r", bgTargetColor.r.toString());
      formData.append("bg_target_g", bgTargetColor.g.toString());
      formData.append("bg_target_b", bgTargetColor.b.toString());
      formData.append("spacing_x", spacingX.toString());
      formData.append("spacing_y", spacingY.toString());
      formData.append("rotation", rotation.toString());
      formData.append("canvas_width", canvasResolution.toString());
      formData.append("canvas_height", canvasResolution.toString());

      // 2. Query backend server (Port 8001 to prevent conflicts with Tool 1)
      const apiResponse = await fetch("http://127.0.0.1:8001/api/replicate", {
        method: "POST",
        body: formData
      });

      if (!apiResponse.ok) {
        const errorData = await apiResponse.json();
        throw new Error(errorData.detail || "Error generating high-res print from backend.");
      }

      const data = await apiResponse.json();
      setHighResImageUrl(data.image);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "FastAPI Backend is offline. Operating fully on offline Frontend Tiler.");
    } finally {
      setIsGeneratingHighRes(false);
    }
  };

  // Download Output Canvas
  const downloadPattern = () => {
    let downloadUrl = "";
    let filename = `design-print-${repeatType}-${scale}x.png`;

    // If we have a backend rendered high-res file, prefer that!
    if (highResImageUrl) {
      downloadUrl = highResImageUrl;
    } else if (previewCanvasRef.current) {
      // Otherwise download current real-time canvas
      downloadUrl = previewCanvasRef.current.toDataURL("image/png");
    }

    if (downloadUrl) {
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0c0e] text-gray-100 flex flex-col font-sans">
      
      {/* HEADER NAVBAR */}
      <header className="border-b border-gray-800 bg-[#12131a] px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-600/10 p-2 rounded-lg border border-emerald-500/20">
            <Sparkles className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-medium">Techniques</span>
              <ChevronRight className="w-3 h-3 text-gray-600" />
              <span className="text-xs text-emerald-400 font-semibold tracking-wide">Motif & Fabric Repeater</span>
            </div>
            <h1 className="text-base font-bold text-white tracking-tight">Pattern Studio (Tool 2)</h1>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <span className="text-xs text-gray-400 bg-gray-800/60 px-2.5 py-1.2 rounded-md font-mono border border-gray-700/40">
            Active Workspace: Tool 2
          </span>
          <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm">
            P
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* RIGHT COLUMN: REPLICATED CANVAS OUTPUTS PANEL (Order-last moves it to the right on desktop) */}
        <div className="lg:col-span-8 flex flex-col gap-8 lg:order-last">

          {/* VIEWPORT ROW: INPUT AND GENERATED CANVAS OUTSIDE */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            
            {/* INPUT MOTIF CARD (Hidden here, moved to the left sidebar dashboard below the Upload Swatch section) */}
            <div className="md:col-span-4 flex flex-col gap-3 hidden">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
                <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
                Input Motif / Fabric
              </h3>
              
              <div className="bg-[#12131a] border border-gray-800 rounded-xl p-4 flex flex-col items-center justify-center min-h-[280px] relative shadow-lg">
                {sourceImage ? (
                  <div className="w-full flex flex-col items-center justify-between h-full gap-4">
                    <div className="w-full aspect-square max-w-[180px] bg-gray-950 rounded-lg flex items-center justify-center border border-gray-800 overflow-hidden relative group">
                      <img 
                        src={previewUrl || (PRESETS.find(p => p.id === selectedPresetId)?.url)} 
                        alt="Source Motif"
                        className="max-w-full max-h-full object-contain p-2"
                      />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="text-[10px] text-gray-300 px-2 py-1 bg-gray-900 border border-gray-700 rounded">
                          {selectedPresetId ? "Default Preset" : "Uploaded Image"}
                        </span>
                      </div>
                    </div>
                    
                    <div className="w-full flex flex-col gap-1.5">
                      <div className="text-xs text-center font-medium text-gray-300 truncate w-full px-2">
                        {selectedPresetId ? `Preset: ${PRESETS.find(p => p.id === selectedPresetId)?.name}` : "Custom Swatch File"}
                      </div>
                      <div className="text-[10px] text-center text-gray-500 font-mono">
                        {sourceImage.width} x {sourceImage.height} px
                      </div>
                      <button
                        onClick={clearImage}
                        className="mt-2 text-xs text-red-400 hover:text-red-300 font-semibold flex items-center justify-center gap-1 py-1.5 hover:bg-red-500/10 rounded-lg transition-colors border border-transparent hover:border-red-500/20"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Remove & Reset
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-gray-500 py-8">
                    <AlertCircle className="w-8 h-8 mx-auto text-yellow-500/80 mb-2 animate-bounce" />
                    <p className="text-xs">No active image loaded.</p>
                  </div>
                )}
              </div>
            </div>

            {/* REPLICATED OUTPUT CANVAS */}
            <div className="md:col-span-12 flex flex-col gap-6">
              
              {/* MANUAL TILE PREVIEW (LOCAL HTML5 CANVAS) */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
                    <Grid className="w-3.5 h-3.5 text-emerald-400" />
                    Manual Fabric Repeater (Realtime Canvas)
                  </h3>
                  <div className="flex items-center gap-1.5">
                    <button 
                      onClick={() => setIsLiked(!isLiked)} 
                      className={`p-1.5 rounded-lg border transition-all ${isLiked ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' : 'bg-gray-800/40 border-gray-700/50 text-gray-400 hover:text-gray-300'}`}
                    >
                      <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-current' : ''}`} />
                    </button>
                    <button 
                      onClick={downloadPattern}
                      className="text-[10px] bg-gray-800/80 hover:bg-gray-700 border border-gray-700 hover:border-gray-600 px-2.5 py-1.5 rounded-lg text-gray-300 font-medium flex items-center gap-1 transition-colors"
                    >
                      <Download className="w-3 h-3" /> Save File
                    </button>
                  </div>
                </div>

                <div className="bg-[#12131a] border border-gray-800 rounded-xl p-4 flex flex-col items-center justify-center min-h-[360px] relative shadow-2xl overflow-hidden transparent-grid shadow-inner">
                  <canvas
                    ref={previewCanvasRef}
                    onClick={handleCanvasSamplerClick}
                    title="Click any pixel on motif to sample as the background color to remove."
                    className="w-full max-w-[340px] md:max-w-full aspect-square border border-gray-800/80 rounded-lg overflow-hidden object-cover cursor-crosshair transition-transform duration-300"
                  />
                  {errorMessage && (
                    <div className="mt-3 text-red-400 text-xs flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-lg w-full">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{errorMessage}</span>
                    </div>
                  )}
                  <div className="mt-3 flex items-center justify-between w-full text-[10px] text-gray-500">
                    <span>Display rendering mode: HTML5 Canvas (Realtime 60FPS)</span>
                    <span>Grid bounds: 800 x 800 scale grid</span>
                  </div>
                </div>
              </div>

              {/* AI TILE PREVIEW (HIGH-RESOLUTION PYTHON ENGINE) */}
              <div className="flex flex-col gap-3 border-t border-gray-800/40 pt-6">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                  AI Tiled Fabric Preview (High-Resolution Python Engine)
                </h3>
                
                <div className="bg-[#12131a] border border-emerald-500/15 rounded-xl p-4 flex flex-col items-center justify-center min-h-[360px] relative shadow-2xl overflow-hidden group">
                  {isGeneratingHighRes ? (
                    <div className="absolute inset-0 bg-black/75 backdrop-blur-sm z-20 flex flex-col items-center justify-center gap-3">
                      <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
                      <div className="text-sm font-semibold text-white">Generating High-Resolution Print...</div>
                      <div className="text-xs text-gray-400 px-6 text-center">Tiling design coordinates via backend Pillow engine.</div>
                    </div>
                  ) : null}

                  {highResImageUrl ? (
                    <div className="w-full max-w-[340px] md:max-w-full aspect-square bg-gray-950 rounded-lg overflow-hidden relative border border-gray-800/60 flex items-center justify-center">
                      <img 
                        src={highResImageUrl} 
                        alt="High Resolution Tile"
                        className="max-w-full max-h-full object-contain"
                      />
                      <button
                        onClick={downloadPattern}
                        className="absolute bottom-3 right-3 bg-emerald-600/90 border border-emerald-500 hover:bg-emerald-500 text-xs text-white px-3 py-2 rounded-lg font-bold flex items-center gap-1.5 shadow"
                      >
                        <Download className="w-3.5 h-3.5" /> Download 1K/2K Masterprint
                      </button>
                    </div>
                  ) : (
                    <div className="w-full max-w-[340px] md:max-w-full aspect-square border border-dashed border-gray-800 rounded-lg flex flex-col items-center justify-center p-6 text-center bg-gray-950/20">
                      <Sparkles className="w-10 h-10 text-emerald-500/40 mb-3" />
                      <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider">AI Fabric Not Yet Rendered</h4>
                      <p className="text-[11px] text-gray-500 max-w-xs mt-1.5 leading-relaxed">
                        Adjust scale, rotation, spacing or key out backgrounds on the right dashboard, then click <span className="text-emerald-400 font-semibold">Let Gemini Style</span> to render the high-resolution Pillow masterprint.
                      </p>
                    </div>
                  )}

                  <div className="mt-3 flex items-center justify-between w-full text-[10px] text-gray-500">
                    <span>Display rendering mode: Python Pillow Raster (Uncompressed)</span>
                    <span>Tiling resolution: {canvasResolution} x {canvasResolution} px</span>
                  </div>
                </div>
              </div>

            </div>

          </div>

        </div>

        {/* LEFT COLUMN: ACTION DASHBOARD PANEL (Order-first moves it to the left on desktop) */}
        <div className="lg:col-span-4 flex flex-col gap-6 lg:order-first">
          
          <div className="bg-[#12131a] border border-gray-800 rounded-xl p-6 shadow-2xl flex flex-col gap-6 sticky top-24">
            
            <div className="flex items-center justify-between border-b border-gray-800 pb-4">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-sm tracking-tight text-white">Tiling Parameters</span>
              </div>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-bold uppercase">
                Ready
              </span>
            </div>

            {/* FILE UPLOAD ZONE */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-gray-300">Upload Swatch / Motif</span>
              <div className="relative group border border-dashed border-gray-800 hover:border-emerald-500/50 rounded-lg p-4 bg-gray-950/20 hover:bg-emerald-950/5 transition-all text-center">
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <Upload className="w-5 h-5 mx-auto text-gray-500 group-hover:text-emerald-400 mb-1.5 transition-colors" />
                <span className="text-[11px] font-medium text-gray-400 group-hover:text-gray-200">
                  Drag & Drop or Click to Browse
                </span>
                <p className="text-[9px] text-gray-600 mt-1">PNG, JPG, SVG or WEBP</p>
              </div>
            </div>

            {/* INPUT MOTIF CARD (RENDERS DIRECTLY BELOW THE FILE UPLOAD ZONE!) */}
            <div className="flex flex-col gap-2 border-t border-gray-800/40 pt-4">
              <span className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
                Input Motif / Fabric Swatch
              </span>
              
              <div className="bg-gray-950/40 border border-gray-800 rounded-xl p-4 flex flex-col items-center justify-center min-h-[160px] relative shadow-inner">
                {sourceImage ? (
                  <div className="w-full flex flex-col items-center justify-between h-full gap-4">
                    <div className="w-full aspect-square max-w-[120px] bg-gray-950 rounded-lg flex items-center justify-center border border-gray-800 overflow-hidden relative group">
                      <img 
                        src={previewUrl || (PRESETS.find(p => p.id === selectedPresetId)?.url)} 
                        alt="Source Motif"
                        className="max-w-full max-h-full object-contain p-2"
                      />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="text-[10px] text-gray-300 px-2 py-1 bg-gray-900 border border-gray-700 rounded">
                          {selectedPresetId ? "Default Preset" : "Uploaded Image"}
                        </span>
                      </div>
                    </div>
                    
                    <div className="w-full flex flex-col gap-1 text-center">
                      <div className="text-xs font-medium text-gray-300 truncate w-full px-2">
                        {selectedPresetId ? `Preset: ${PRESETS.find(p => p.id === selectedPresetId)?.name}` : "Custom Swatch File"}
                      </div>
                      <div className="text-[10px] text-center text-gray-500 font-mono">
                        {sourceImage.width} x {sourceImage.height} px
                      </div>
                      <button
                        onClick={clearImage}
                        className="mt-2 text-xs text-red-400 hover:text-red-300 font-semibold flex items-center justify-center gap-1 py-1 hover:bg-red-500/10 rounded-lg transition-colors border border-transparent"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Remove & Reset
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-gray-600 py-4">
                    <AlertCircle className="w-6 h-6 mx-auto text-yellow-500/60 mb-1" />
                    <p className="text-[11px]">No active image loaded.</p>
                  </div>
                )}
              </div>
            </div>

            {/* SCALE INPUT (MAIN REQUESTED FEATURE) */}
            <div className="flex flex-col gap-2 border-t border-gray-800/40 pt-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-gray-300">Design Scale Factor</span>
                <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  {scale.toFixed(2)}x
                </span>
              </div>
              <p className="text-[10px] text-gray-500 -mt-1">Controls how much the design motif is scaled up or down on the canvas to replicate.</p>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setScale(prev => Math.max(0.05, Number((prev - 0.05).toFixed(2))))}
                  className="p-1.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white border border-gray-700"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <input 
                  type="range" 
                  min="0.05" 
                  max="4.00" 
                  step="0.05"
                  value={scale}
                  onChange={(e) => setScale(Number(parseFloat(e.target.value).toFixed(2)))}
                  className="flex-1 accent-emerald-500 h-1.5 bg-gray-800 rounded-lg cursor-pointer"
                />
                <button 
                  onClick={() => setScale(prev => Math.min(4.00, Number((prev + 0.05).toFixed(2))))}
                  className="p-1.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white border border-gray-700"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* SPACING AND ROTATION EXPANDABLE CONTROLS */}
            <div className="border-t border-gray-800/80 pt-4 flex flex-col gap-4">
              
              {/* ROTATION SLIDER */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-gray-300">Motif Rotation</span>
                  <span className="text-xs font-mono font-bold text-gray-400">{rotation}°</span>
                </div>
                <div className="flex items-center gap-3">
                  <input 
                    type="range" 
                    min="0" 
                    max="360" 
                    step="15"
                    value={rotation}
                    onChange={(e) => setRotation(Number(e.target.value))}
                    className="flex-1 accent-emerald-500 h-1 bg-gray-800 rounded-lg cursor-pointer"
                  />
                  <button 
                    onClick={() => setRotation(0)} 
                    title="Reset Rotation" 
                    className="p-1 rounded bg-gray-800 hover:bg-gray-700 border border-gray-700 text-[9px] text-gray-400 hover:text-white"
                  >
                    Reset
                  </button>
                </div>
              </div>

              {/* SPACING SLIDERS */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-gray-400">H-Gap: {spacingX}px</span>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={spacingX}
                    onChange={(e) => setSpacingX(Number(e.target.value))}
                    className="accent-emerald-500 h-1 bg-gray-800 rounded cursor-pointer"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-gray-400">V-Gap: {spacingY}px</span>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={spacingY}
                    onChange={(e) => setSpacingY(Number(e.target.value))}
                    className="accent-emerald-500 h-1 bg-gray-800 rounded cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* CHROMA KEY / BACKGROUND REMOVAL */}
            <div className="border-t border-gray-800/80 pt-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-300">Motif Chroma Key</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={removeBg} 
                    onChange={(e) => setRemoveBg(e.target.checked)}
                    className="sr-only peer" 
                  />
                  <div className="w-8 h-4 bg-gray-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-gray-400 after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-600 peer-checked:after:bg-white"></div>
                </label>
              </div>

              {removeBg && (
                <div className="bg-gray-950/40 border border-gray-800/60 rounded-lg p-3 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-400">Target BG Hex Color</span>
                    <input 
                      type="color" 
                      value={bgSampleHex} 
                      onChange={(e) => handleHexInputChange(e.target.value)}
                      className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
                    />
                  </div>
                  
                  <div className="flex justify-between items-center -mt-1">
                    <span className="text-[9px] text-gray-500">Selected: RGB({bgTargetColor.r},{bgTargetColor.g},{bgTargetColor.b})</span>
                    <input 
                      type="text" 
                      value={bgSampleHex}
                      onChange={(e) => handleHexInputChange(e.target.value)}
                      className="w-14 bg-gray-900 border border-gray-800 rounded px-1 text-[9px] font-mono text-center text-gray-300"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between items-center text-[10px] text-gray-400">
                      <span>Tolerance Threshold</span>
                      <span className="font-mono">{bgThreshold}</span>
                    </div>
                    <input 
                      type="range" 
                      min="10" 
                      max="150" 
                      value={bgThreshold}
                      onChange={(e) => setBgThreshold(Number(e.target.value))}
                      className="accent-emerald-500 h-1 bg-gray-800 rounded-lg cursor-pointer"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* CANVAS BACKGROUND CONFIG */}
            <div className="border-t border-gray-800/80 pt-4 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-300">Canvas Fill Color</span>
                <label className="flex items-center gap-1.5 text-[10px] text-gray-400 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={isTransparent}
                    onChange={(e) => setIsTransparent(e.target.checked)}
                    className="accent-emerald-500 rounded"
                  />
                  <span>Transparent</span>
                </label>
              </div>

              {!isTransparent && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <input 
                      type="color" 
                      value={backgroundColor}
                      onChange={(e) => setBackgroundColor(e.target.value)}
                      className="w-8 h-8 rounded-lg border-0 bg-transparent cursor-pointer shrink-0"
                    />
                    <div className="flex-1 flex flex-col gap-0.5">
                      <input 
                        type="text" 
                        value={backgroundColor}
                        onChange={(e) => setBackgroundColor(e.target.value)}
                        className="w-full bg-gray-950 border border-gray-800 rounded-lg px-2.5 py-1 text-xs font-mono text-gray-300"
                      />
                      <div className="text-[10px] font-bold text-emerald-400 font-mono tracking-tight leading-none pt-0.5">
                        {getClosestPantone(backgroundColor)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {colorSwatches.map((color) => (
                      <button
                        key={color.name}
                        onClick={() => setBackgroundColor(color.hex)}
                        className={`w-4 h-4 rounded-full border border-gray-800 transition-transform ${backgroundColor === color.hex ? 'scale-125 border-emerald-500 ring-1 ring-emerald-500' : 'hover:scale-110'}`}
                        style={{ backgroundColor: color.hex }}
                        title={`${color.name} - ${getClosestPantone(color.hex)}`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* HIGH-RES BACKEND EXPORT OPTIONS */}
            <div className="border-t border-gray-800/80 pt-4 flex flex-col gap-2">
              <span className="text-xs font-semibold text-gray-300">Export Canvas Resolution</span>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { size: 1024, label: "1K Print (1024x1024)" },
                  { size: 2048, label: "2K High-Res (2048x2048)" }
                ].map((res) => (
                  <button
                    key={res.size}
                    onClick={() => setCanvasResolution(res.size)}
                    className={`p-2 rounded-lg border text-center transition-all ${canvasResolution === res.size ? 'bg-emerald-600/10 border-emerald-500 text-white font-semibold' : 'bg-gray-950/40 border-gray-800 text-gray-400 text-xs'}`}
                  >
                    <span className="text-[10px]">{res.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* MAIN ACTION BUTTON */}
            <div className="flex flex-col gap-2 border-t border-gray-800/80 pt-4">
              <button
                onClick={handleBackendGenerate}
                disabled={isGeneratingHighRes || !sourceImage}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-800 disabled:text-gray-600 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg animate-pulse-glow cursor-pointer"
              >
                <Sparkles className={`w-4 h-4 ${isGeneratingHighRes ? 'animate-spin' : ''}`} />
                <span>{isGeneratingHighRes ? 'AI Rendering Fabric...' : 'Let Gemini Style'}</span>
              </button>
              
              <button
                onClick={downloadPattern}
                disabled={!sourceImage}
                className="w-full bg-gray-950 hover:bg-gray-900 border border-gray-800 hover:border-gray-700 disabled:border-transparent text-gray-300 disabled:text-gray-600 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Masterprint</span>
              </button>
            </div>

          </div>

        </div>

      </main>

      {/* FOOTER */}
      <footer className="border-t border-gray-800 bg-[#0b0c0e] py-6 px-6 mt-12 text-center text-xs text-gray-500">
        <p>© 2026 Design Studio Inc. All rights reserved. Professional Textile & Print CAD Workspace.</p>
      </footer>

    </div>
  );
}
