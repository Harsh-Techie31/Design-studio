import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Upload,
  Image as ImageIcon,
  Plus,
  Trash2,
  Cpu,
  RefreshCw,
  Sliders,
  Download,
  CheckCircle,
  AlertCircle,
  Key,
  Layers,
  Info,
  Scissors,
  Maximize2
} from "lucide-react";

interface FabricItem {
  id: string;
  image: File | null;
  previewUrl: string;
  prompt: string;
}

export default function App() {
  // Main states
  const [sketchImage, setSketchImage] = useState<File | null>(null);
  const [sketchPreview, setSketchPreview] = useState<string>("");
  const [sketchPrompt, setSketchPrompt] = useState<string>("");
  
  // Fabric sections
  const [fabrics, setFabrics] = useState<FabricItem[]>([
    { id: "fab-1", image: null, previewUrl: "", prompt: "" }
  ]);

  // Abort controller for stopping/canceling active generation
  const abortControllerRef = React.useRef<AbortController | null>(null);

  // Model & Options
  const [selectedModel, setSelectedModel] = useState<string>("gemini-3.1-flash-image");
  const [selectedRatio, setSelectedRatio] = useState<string>("1:1");
  const [selectedQuality, setSelectedQuality] = useState<string>("2K");
  const [selectedGender, setSelectedGender] = useState<string>("Female");

  // Custom API key override
  const [customApiKey, setCustomApiKey] = useState<string>("");
  const [showKeyField, setShowKeyField] = useState<boolean>(false);

  // Lightbox view state
  const [showFullscreen, setShowFullscreen] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  // Generation status states
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationProgress, setGenerationProgress] = useState<number>(0);
  const [currentStageText, setCurrentStageText] = useState<string>("");
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string>("");
  const [generatedPrompt, setGeneratedPrompt] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");

  // Simulated animation steps during rendering
  const generationStages = [
    { text: "Reading input garment sketch & mapping silhouette lines...", progress: 12 },
    { text: "Analyzing clothing dimensions & stitch layouts...", progress: 28 },
    { text: "Extracting uploaded fabric patterns & micro-texture details...", progress: 45 },
    { text: "Fusing fabric designs onto structural garment layers...", progress: 62 },
    { text: "Configuring lighting matrix for fashion studio photo shoot...", progress: 80 },
    { text: "Rendering high-fidelity materials, sewing details & model pose...", progress: 95 },
    { text: "Finalizing render and exporting canvas image...", progress: 100 }
  ];

  // Progressive timer simulation
  useEffect(() => {
    let progressInterval: NodeJS.Timeout;
    if (isGenerating) {
      setGenerationProgress(0);
      setCurrentStageText(generationStages[0].text);
      
      let currentStageIdx = 0;
      const intervalTime = 3000; // 3 seconds per stage to allow realistic animation feedback

      progressInterval = setInterval(() => {
        currentStageIdx++;
        if (currentStageIdx < generationStages.length) {
          setCurrentStageText(generationStages[currentStageIdx].text);
          setGenerationProgress(generationStages[currentStageIdx].progress);
        } else {
          clearInterval(progressInterval);
        }
      }, intervalTime);
    }
    return () => {
      if (progressInterval) clearInterval(progressInterval);
    };
  }, [isGenerating]);

  // Keyboard shortcut listener for escape key in lightbox preview
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowFullscreen(false);
        setZoomLevel(1);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Handlers for sketch image
  const handleSketchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSketchImage(file);
      setSketchPreview(URL.createObjectURL(file));
      setErrorMsg("");
    }
  };

  // Handlers for fabric images
  const handleFabricImageChange = (id: string, file: File | null) => {
    if (!file) return;
    setFabrics(prev =>
      prev.map(item => {
        if (item.id === id) {
          if (item.previewUrl) {
            URL.revokeObjectURL(item.previewUrl);
          }
          return {
            ...item,
            image: file,
            previewUrl: URL.createObjectURL(file)
          };
        }
        return item;
      })
    );
  };

  const handleFabricPromptChange = (id: string, text: string) => {
    setFabrics(prev =>
      prev.map(item => (item.id === id ? { ...item, prompt: text } : item))
    );
  };

  const addFabricField = () => {
    const newId = `fab-${Date.now()}`;
    setFabrics(prev => [...prev, { id: newId, image: null, previewUrl: "", prompt: "" }]);
  };

  const removeFabricField = (id: string) => {
    if (fabrics.length === 1) {
      setFabrics([{ id: "fab-1", image: null, previewUrl: "", prompt: "" }]);
      return;
    }
    setFabrics(prev => {
      const target = prev.find(item => item.id === id);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter(item => item.id !== id);
    });
  };

  // Stop or cancel active design generation
  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
  };

  // Submit First Render job to Backend
  const triggerFirstRender = async () => {
    if (!sketchImage) {
      setErrorMsg("Please upload a base garment sketch image before generating!");
      return;
    }

    setIsGenerating(true);
    setErrorMsg("");
    setGeneratedImageUrl("");
    setGeneratedPrompt("");

    // Create abort controller for stopping the request
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const formData = new FormData();
    formData.append("sketch_image", sketchImage);
    formData.append("sketch_prompt", sketchPrompt);
    formData.append("model_name", selectedModel);
    formData.append("ratio", selectedRatio);
    formData.append("quality", selectedQuality);
    formData.append("gender", selectedGender);

    // Build lists of active fabric files & their corresponding prompts
    const activeFabrics = fabrics.filter(f => f.image !== null);
    const fabricPromptsList: string[] = [];

    activeFabrics.forEach((fab) => {
      if (fab.image) {
        formData.append("fabric_images", fab.image);
        fabricPromptsList.push(fab.prompt);
      }
    });

    formData.append("fabric_prompts_json", JSON.stringify(fabricPromptsList));

    try {
      const response = await fetch("http://127.0.0.1:8000/api/first-render", {
        method: "POST",
        body: formData,
        headers: customApiKey
          ? { "X-Gemini-API-Key": customApiKey }
          : undefined,
        signal: controller.signal,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Error generating render. Please verify backend state & API Key.");
      }

      if (data.success) {
        setGeneratedImageUrl(data.image);
        setGeneratedPrompt(data.prompt);
      } else {
        throw new Error("Unable to parse render output from Gemini Imagen API.");
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        console.log("Generation stopped by the designer.");
        setErrorMsg("Fusing generation stopped by user.");
      } else {
        console.error(err);
        setErrorMsg(err.message || "Unable to reach design backend. Ensure python backend is running on port 8000.");
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0c10] text-gray-100 flex flex-col font-sans">
      {/* Header Panel */}
      <header className="border-b border-gray-800 bg-[#0f111a] px-6 py-4 sticky top-0 z-50 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl shadow-lg shadow-purple-500/10 animate-pulse-glow">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div className="text-left">
              <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 via-indigo-200 to-white bg-clip-text text-transparent tracking-tight">
                Design Studio <span className="text-xs bg-purple-900/40 text-purple-400 px-2 py-0.5 rounded border border-purple-800/60 font-semibold ml-1">v2.0</span>
              </h1>
              <p className="text-xs text-gray-400">High-Fidelity Virtual Material Fusing Suite</p>
            </div>
          </div>

          {/* Controls & API status */}
          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              onClick={() => setShowKeyField(!showKeyField)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
                customApiKey 
                  ? "bg-emerald-950/40 border-emerald-800/80 text-emerald-300" 
                  : "bg-gray-900/60 border-gray-800 text-gray-300 hover:border-gray-700"
              }`}
            >
              <Key className="w-3.5 h-3.5" />
              {customApiKey ? "API Key Confirmed" : "Configure Gemini API Key"}
            </button>

            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping inline-block"></span>
              <span className="font-semibold text-gray-300">Backend Connected</span>
            </div>
          </div>
        </div>

        {/* Floating Custom API Key Box */}
        {showKeyField && (
          <div className="max-w-7xl mx-auto mt-3 p-4 bg-gray-950 rounded-xl border border-gray-800/80 flex flex-col sm:flex-row items-center gap-3 shadow-2xl animate-shimmer">
            <div className="text-xs text-gray-400 max-w-md text-left">
              <span className="font-bold text-gray-300 block mb-0.5">Custom Gemini API Override</span>
              If your backend <code className="bg-gray-900 px-1 py-0.5 rounded text-indigo-400">.env</code> isn't configured, paste your Google AI Studio API key here. It overrides the server default securely.
            </div>
            <div className="relative flex-grow w-full">
              <input
                type="password"
                placeholder="AIzaSy..."
                value={customApiKey}
                onChange={(e) => setCustomApiKey(e.target.value)}
                className="w-full bg-gray-900 border border-gray-800 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 rounded-lg py-2 pl-3 pr-10 text-xs font-mono outline-none text-white transition-all"
              />
              {customApiKey && (
                <button 
                  onClick={() => setCustomApiKey("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white text-xs cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
            <button
              onClick={() => setShowKeyField(false)}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-xs rounded-lg transition-colors font-medium cursor-pointer"
            >
              Done
            </button>
          </div>
        )}
      </header>

      {/* Main Studio Body */}
      <main className="flex-grow max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* Left Input Sidebar Panel (Columns 1-7) */}
        <section className="lg:col-span-7 flex flex-col gap-5 text-left">
          
          {/* Section title */}
          <div className="flex items-center justify-between border-b border-gray-800 pb-3">
            <div className="flex items-center gap-2">
              <Sliders className="w-5 h-5 text-purple-400" />
              <h2 className="text-lg font-bold text-white">First Render parameters</h2>
            </div>
            <span className="text-xs text-purple-400 bg-purple-950/40 px-2 py-0.5 rounded-full border border-purple-900/60 font-medium">
              Multimodal Fusion Mode
            </span>
          </div>

          {/* STEP 1: GARMENT SKETCH UPLOAD */}
          <div className="bg-[#121420]/80 border border-gray-800/80 rounded-2xl p-5 shadow-sm hover:border-gray-700/60 transition-all flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-indigo-950/80 text-indigo-400 border border-indigo-800/60 flex items-center justify-center text-xs font-bold">1</span>
                <h3 className="text-sm font-semibold text-white">Garment Silhouette Sketch</h3>
              </div>
              <span className="text-xs text-gray-500 font-medium">PNG or JPG</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Image Input Zone */}
              <div className="relative group">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleSketchChange}
                  id="sketch-upload"
                  className="hidden"
                />
                
                {sketchPreview ? (
                  <div className="relative h-44 rounded-xl overflow-hidden border border-purple-500/30 group-hover:border-purple-500/60 transition-all bg-gray-950 flex items-center justify-center">
                    <img
                      src={sketchPreview}
                      alt="Garment Sketch Preview"
                      className="max-h-full max-w-full object-contain p-2"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <label
                        htmlFor="sketch-upload"
                        className="p-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg cursor-pointer text-xs font-semibold flex items-center gap-1.5"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Replace
                      </label>
                      <button
                        onClick={() => {
                          setSketchImage(null);
                          setSketchPreview("");
                        }}
                        className="p-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <label
                    htmlFor="sketch-upload"
                    className="flex flex-col items-center justify-center h-44 border-2 border-dashed border-gray-800 hover:border-purple-500/50 bg-gray-950/40 hover:bg-purple-950/10 rounded-xl cursor-pointer transition-all duration-300 p-4 text-center group"
                  >
                    <Upload className="w-8 h-8 text-gray-500 group-hover:text-purple-400 mb-2.5 transition-colors" />
                    <span className="text-xs font-semibold text-gray-300 group-hover:text-purple-300">Click or Drag Sketch</span>
                    <span className="text-[10px] text-gray-500 mt-1">Accepts sketches, drawings, CAD silhouettes</span>
                  </label>
                )}
              </div>

              {/* Prompt field */}
              <div className="flex flex-col gap-2">
                <label className="text-xs text-gray-400 font-medium flex items-center gap-1">
                  <span>Additional Garment Prompt</span>
                  <span className="text-[10px] text-gray-500">(Optional - backend default prompt used otherwise)</span>
                </label>
                <textarea
                  placeholder="e.g. A sleek trenchcoat, asymmetric heavy collar, double breasted buttons, futuristic details..."
                  value={sketchPrompt}
                  onChange={(e) => setSketchPrompt(e.target.value)}
                  rows={6}
                  className="w-full flex-grow bg-gray-950/80 border border-gray-800 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 text-xs text-white rounded-xl p-3 outline-none resize-none transition-all placeholder-gray-600 font-normal leading-relaxed"
                />
              </div>
            </div>
          </div>

          {/* STEP 2: FABRIC SELECTION & TEXTURING SECTION */}
          <div className="bg-[#121420]/80 border border-gray-800/80 rounded-2xl p-5 shadow-sm hover:border-gray-700/60 transition-all flex flex-col gap-4">
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-purple-950/80 text-purple-400 border border-purple-800/60 flex items-center justify-center text-xs font-bold">2</span>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-semibold text-white">Fabric Texture Fusing</h3>
                  <span className="text-[10px] bg-indigo-950/50 border border-indigo-900/50 text-indigo-400 px-1.5 py-0.5 rounded">Multi-Fabric enabled</span>
                </div>
              </div>
              <button
                type="button"
                onClick={addFabricField}
                className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 bg-purple-950/30 hover:bg-purple-950/60 px-2.5 py-1 rounded-lg border border-purple-900/60 font-semibold transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Fabric Card
              </button>
            </div>

            <p className="text-xs text-gray-400 leading-normal bg-gray-950/40 p-3 rounded-lg border border-gray-800/40 flex items-start gap-2">
              <Info className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
              Upload swatches of the fabric textures. Describe exactly where to apply each texture in the input prompt fields below (e.g. <em>"Sleeves made of fabric 1"</em>).
            </p>

            {/* Dynamic Fabric Cards List */}
            <div className="flex flex-col gap-3.5 max-h-[340px] overflow-y-auto pr-1">
              {fabrics.map((fabric, idx) => (
                <div
                  key={fabric.id}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-3 p-3 bg-gray-950/60 border border-gray-800/70 rounded-xl hover:border-gray-800 transition-all items-center relative group"
                >
                  {/* Fabric Swatch Upload (Cols 1-4) */}
                  <div className="sm:col-span-4 relative h-20 rounded-lg overflow-hidden border border-gray-800 group-hover:border-gray-700 bg-gray-950/80 flex items-center justify-center">
                    {fabric.previewUrl ? (
                      <div className="relative w-full h-full flex items-center justify-center">
                        <img
                          src={fabric.previewUrl}
                          alt={`Fabric ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <label
                            htmlFor={`fabric-upload-${fabric.id}`}
                            className="p-1.5 bg-purple-600 hover:bg-purple-500 rounded text-white cursor-pointer text-[10px] font-bold"
                          >
                            Replace
                          </label>
                        </div>
                      </div>
                    ) : (
                      <label
                        htmlFor={`fabric-upload-${fabric.id}`}
                        className="flex flex-col items-center justify-center w-full h-full cursor-pointer hover:bg-purple-950/10 transition-colors p-2 text-center"
                      >
                        <Upload className="w-5 h-5 text-gray-500 mb-1" />
                        <span className="text-[10px] text-gray-400 font-semibold">Upload Fabric {idx + 1}</span>
                      </label>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFabricImageChange(fabric.id, e.target.files?.[0] || null)}
                      id={`fabric-upload-${fabric.id}`}
                      className="hidden"
                    />
                  </div>

                  {/* Fabric Prompt Details (Cols 5-11) */}
                  <div className="sm:col-span-7 flex flex-col gap-1.5">
                    <label className="text-[10px] text-gray-400 font-semibold flex items-center gap-1">
                      <Scissors className="w-3 h-3 text-purple-400" />
                      Fabric #{idx + 1} Prompt Specification
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. main dress / pocket patches / inner jacket lining"
                      value={fabric.prompt}
                      onChange={(e) => handleFabricPromptChange(fabric.id, e.target.value)}
                      className="w-full bg-gray-950/80 border border-gray-800 focus:border-purple-500 text-xs text-white rounded-lg px-2.5 py-1.5 outline-none transition-all placeholder-gray-600 font-normal"
                    />
                  </div>

                  {/* Remove Button (Col 12) */}
                  <div className="sm:col-span-1 flex items-center justify-center">
                    <button
                      type="button"
                      onClick={() => removeFabricField(fabric.id)}
                      className="p-2 text-gray-500 hover:text-rose-400 hover:bg-rose-950/20 rounded-lg transition-all cursor-pointer"
                      title="Remove Fabric"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* STEP 3: ADVANCED DESIGN CONTROLS */}
          <div className="bg-[#121420]/80 border border-gray-800/80 rounded-2xl p-5 shadow-sm hover:border-gray-700/60 transition-all flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-pink-950/80 text-pink-400 border border-pink-800/60 flex items-center justify-center text-xs font-bold">3</span>
              <h3 className="text-sm font-semibold text-white">Model Selection & Shoot Configuration</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              
              {/* SELECT MODEL (WORKING FEATURE) */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-gray-400 font-semibold flex items-center justify-between">
                  <span>Select Model</span>
                  <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider bg-emerald-950/50 px-1 py-0.2 rounded border border-emerald-900/50">Working Feature</span>
                </label>
                <div className="relative">
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 text-xs text-white rounded-xl py-2 px-3 outline-none focus:border-purple-500 cursor-pointer appearance-none transition-all"
                  >
                    <option value="gemini-3.1-flash-image">Nano Banana 2 (Standard)</option>
                    <option value="gemini-3.1-flash-lite-image">Nano Banana 2 Lite</option>
                    <option value="gemini-3-pro-image">Nano Banana Pro</option>
                    <option value="gemini-2.5-flash-image">Nano Banana (Legacy)</option>
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500 text-[10px]">▼</div>
                </div>
                <span className="text-[10px] text-gray-500">Choose look: Standard, Lite, Pro, or Legacy avatar.</span>
              </div>

              {/* SELECT GENDER (WORKING FEATURE) */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-gray-400 font-semibold flex items-center justify-between">
                  <span>Sizing & Cut</span>
                  <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider bg-emerald-950/50 px-1 py-0.2 rounded border border-emerald-900/50">Working Feature</span>
                </label>
                <div className="relative">
                  <select
                    value={selectedGender}
                    onChange={(e) => setSelectedGender(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 text-xs text-white rounded-xl py-2 px-3 outline-none focus:border-purple-500 cursor-pointer appearance-none transition-all"
                  >
                    <option value="Female">Female (Tailored Cuts)</option>
                    <option value="Male">Male (Structured Cuts)</option>
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500 text-[10px]">▼</div>
                </div>
                <span className="text-[10px] text-gray-500">Specify design target cut style.</span>
              </div>

              {/* ASPECT RATIO (WORKING FEATURE) */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-gray-400 font-semibold flex items-center justify-between">
                  <span>Ratio</span>
                  <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider bg-emerald-950/50 px-1 py-0.2 rounded border border-emerald-900/50">Active Feature</span>
                </label>
                <div className="relative">
                  <select
                    value={selectedRatio}
                    onChange={(e) => setSelectedRatio(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 text-xs text-white rounded-xl py-2 px-3 outline-none focus:border-purple-500 cursor-pointer appearance-none transition-all"
                  >
                    <option value="1:1">Square (1:1)</option>
                    <option value="3:4">Portrait Studio (3:4)</option>
                    <option value="4:3">Landscape Runway (4:3)</option>
                    <option value="9:16">Mobile Editorial (9:16)</option>
                    <option value="16:9">Widescreen Presentation (16:9)</option>
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500 text-[10px]">▼</div>
                </div>
                <span className="text-[10px] text-gray-500">Configures rendering aspect ratio.</span>
              </div>

              {/* IMAGE QUALITY (WORKING FEATURE) */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-gray-400 font-semibold flex items-center justify-between">
                  <span>Image Quality</span>
                  <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider bg-emerald-950/50 px-1 py-0.2 rounded border border-emerald-900/50">Active Feature</span>
                </label>
                <div className="relative">
                  <select
                    value={selectedQuality}
                    onChange={(e) => setSelectedQuality(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 text-xs text-white rounded-xl py-2 px-3 outline-none focus:border-purple-500 cursor-pointer appearance-none transition-all"
                  >
                    <option value="1K">1K (Standard Render HD)</option>
                    <option value="2K">2K (High Detail Professional)</option>
                    <option value="3K">3K (Hyper-realistic Masterclass)</option>
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500 text-[10px]">▼</div>
                </div>
                <span className="text-[10px] text-gray-500">Fine-tunes the thread rendering resolution.</span>
              </div>

            </div>
          </div>

          {/* GENERATE ACTION BUTTON */}
          <button
            type="button"
            disabled={isGenerating || !sketchImage}
            onClick={triggerFirstRender}
            className={`w-full py-4 px-6 rounded-2xl font-bold flex items-center justify-center gap-2.5 transition-all shadow-lg text-sm tracking-wider uppercase border ${
              isGenerating
                ? "bg-purple-900/30 text-purple-400 border-purple-800/60 cursor-not-allowed animate-shimmer"
                : sketchImage
                ? "bg-gradient-to-r from-purple-600 via-indigo-600 to-indigo-700 hover:from-purple-500 hover:to-indigo-500 text-white border-purple-500/50 shadow-purple-500/10 cursor-pointer animate-pulse-glow"
                : "bg-gray-900/60 text-gray-500 border-gray-800 cursor-not-allowed"
            }`}
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>Generating and Fusing Textures...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                <span>First Render Garment Layout</span>
              </>
            )}
          </button>

          {/* ERROR CALLOUT */}
          {errorMsg && (
            <div className="p-4 bg-rose-950/40 border border-rose-900/60 rounded-xl flex items-start gap-3 text-rose-300 text-xs animate-shimmer">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <div>
                <span className="font-bold text-rose-200 block mb-0.5">Fusing Interrupted</span>
                {errorMsg}
              </div>
            </div>
          )}

        </section>

        {/* Right Output Side (Columns 8-12) */}
        <section className="lg:col-span-5 flex flex-col bg-[#121420]/30 border border-gray-800/80 rounded-3xl overflow-hidden shadow-2xl items-stretch h-full min-h-[500px]">
          
          {/* Output Header */}
          <div className="border-b border-gray-800 bg-[#0f111a]/80 px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-bold text-white text-left">High-Fidelity Virtual Canvas</h3>
            </div>
            {generatedImageUrl && (
              <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-900/60">
                <CheckCircle className="w-3 h-3" />
                Rendered
              </span>
            )}
          </div>

          {/* Interactive Container Area */}
          <div className="flex-grow flex flex-col items-center justify-center p-6 min-h-[380px] relative bg-gray-950/40">
            
            {/* INITIAL BLANK PLACEHOLDER STATE */}
            {!isGenerating && !generatedImageUrl && (
              <div className="text-center max-w-sm flex flex-col items-center gap-4">
                <div className="w-16 h-16 bg-gray-900/80 border border-gray-800 rounded-2xl flex items-center justify-center text-gray-500 shadow-md">
                  <ImageIcon className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-300">Ready for first render</h4>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                    Upload a sketch and fabrics on the parameters panel, select your model, and click <strong className="text-gray-400">First Render Garment Layout</strong> to launch your design shoot.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center">
                  <span className="text-[9px] bg-gray-900 text-gray-400 border border-gray-800/80 px-2 py-0.5 rounded font-medium">Gemini 1.5 Synthesis</span>
                  <span className="text-[9px] bg-gray-900 text-gray-400 border border-gray-800/80 px-2 py-0.5 rounded font-medium">Google Imagen 3 Studio</span>
                </div>
              </div>
            )}

            {/* GENERATING ANIMATION STATE (SPECIFIED FEATURE) */}
            {isGenerating && (
              <div className="absolute inset-0 z-40 bg-[#0d0e12]/95 p-6 flex flex-col items-center justify-center text-center">
                
                {/* Advanced Multi-step Animation Loop */}
                <div className="relative mb-8">
                  {/* Outer spinning threads */}
                  <div className="w-32 h-32 rounded-full border border-dashed border-indigo-500/20 animate-thread-spin flex items-center justify-center">
                    <div className="w-24 h-24 rounded-full border border-purple-500/40 border-t-transparent animate-spin flex items-center justify-center">
                      <div className="w-16 h-16 rounded-full bg-gray-900/80 border border-purple-500/60 shadow-lg shadow-purple-500/10 flex items-center justify-center">
                        <Sparkles className="w-6 h-6 text-purple-400 animate-pulse" />
                      </div>
                    </div>
                  </div>

                  {/* Absolute elements floating */}
                  <div className="absolute top-0 right-0 p-1.5 bg-gray-900 border border-gray-800 text-[10px] rounded font-bold text-pink-400 animate-spark">
                    🎨 Fusing Textures
                  </div>
                  <div className="absolute bottom-1.5 -left-4 p-1.5 bg-gray-900 border border-gray-800 text-[10px] rounded font-bold text-cyan-400 animate-bounce">
                    ⚡ Studio Lights
                  </div>
                </div>

                {/* Status Messages */}
                <div className="max-w-md w-full flex flex-col gap-3.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-purple-400 tracking-wider uppercase">Stitching Progress</span>
                    <span className="font-mono text-gray-300 font-bold">{generationProgress}%</span>
                  </div>

                  {/* Custom progress loading bar */}
                  <div className="w-full h-2 bg-gray-900 rounded-full border border-gray-800/80 overflow-hidden p-0.5">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 via-indigo-500 to-indigo-600 rounded-full transition-all duration-700 ease-out"
                      style={{ width: `${generationProgress}%` }}
                    />
                  </div>

                  {/* Stage descriptive update */}
                  <div className="h-10 flex items-center justify-center">
                    <p className="text-xs text-gray-300 font-semibold flex items-center gap-2 animate-pulse">
                      <Cpu className="w-4 h-4 text-purple-400 animate-spin" />
                      {currentStageText}
                    </p>
                  </div>

                  <p className="text-[10px] text-gray-500 max-w-xs mx-auto leading-relaxed mt-1">
                    Please hold tight. Gemini is compiling materials, generating lighting angles, and stitching textures together.
                  </p>

                  {/* STOP GENERATION BUTTON */}
                  <button
                    type="button"
                    onClick={handleStopGeneration}
                    className="mt-3 py-2 px-4 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-900/40 text-rose-300 text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 mx-auto"
                  >
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping inline-block"></span>
                    Stop Generation
                  </button>
                </div>
              </div>
            )}

            {/* GENERATED FINAL IMAGE RENDER (SPECIFIED FEATURE) */}
            {generatedImageUrl && (
              <div className="w-full h-full flex flex-col gap-4">
                
                {/* Image display frame */}
                <div className="relative flex-grow rounded-2xl overflow-hidden border border-gray-800 shadow-inner bg-gray-950 flex items-center justify-center group h-[300px]">
                  <img
                    src={generatedImageUrl}
                    alt="AI Generated Garment Render"
                    className="max-h-full max-w-full object-contain p-2 hover:scale-105 transition-transform duration-500 cursor-pointer"
                    onClick={() => {
                      setShowFullscreen(true);
                      setZoomLevel(1);
                    }}
                  />
                  
                  {/* Floating Action Bars */}
                  <div className="absolute top-3 right-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <button
                      onClick={() => {
                        setShowFullscreen(true);
                        setZoomLevel(1);
                      }}
                      className="p-2 bg-gray-900/95 hover:bg-purple-600 text-white border border-gray-800 hover:border-purple-500 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-lg cursor-pointer"
                      title="View Fullscreen"
                    >
                      <Maximize2 className="w-4 h-4" />
                      Fullscreen
                    </button>
                    <a
                      href={generatedImageUrl}
                      download={`design-studio-${selectedModel}-${Date.now()}.jpg`}
                      className="p-2 bg-gray-900/90 hover:bg-purple-600 text-white border border-gray-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-lg"
                      title="Download Rendered Image"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </a>
                  </div>

                  <div className="absolute bottom-3 left-3 right-3 bg-black/75 border border-gray-800/80 px-3 py-2 rounded-xl text-[10px] text-gray-400 flex items-center justify-between">
                    <span>Styled model: <strong className="text-gray-200">{selectedModel}</strong></span>
                    <span>Format: <strong className="text-gray-200">{selectedRatio} Ratio</strong></span>
                  </div>
                </div>

                {/* Gemini synthesized prompt reveal */}
                {generatedPrompt && (
                  <div className="bg-[#121420]/80 border border-gray-800/80 rounded-xl p-3.5 flex flex-col gap-2 text-left">
                    <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5" />
                      Gemini Synthesized Prompt Formulation
                    </span>
                    <p className="text-[11px] text-gray-300 leading-relaxed max-h-[110px] overflow-y-auto italic font-normal bg-gray-950/60 p-2.5 rounded-lg border border-gray-800">
                      "{generatedPrompt}"
                    </p>
                  </div>
                )}

                {/* Action footer */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setGeneratedImageUrl("");
                      setGeneratedPrompt("");
                    }}
                    className="py-2.5 px-4 bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-xl text-xs font-semibold text-gray-300 transition-colors cursor-pointer"
                  >
                    Clear Canvas
                  </button>
                  <button
                    onClick={triggerFirstRender}
                    className="py-2.5 px-4 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Re-render Options
                  </button>
                </div>
              </div>
            )}

          </div>

          {/* Quick instructions bottom banner */}
          <div className="bg-[#0f111a]/80 border-t border-gray-800 p-4.5 text-xs text-gray-400 flex items-start gap-2.5 text-left">
            <Info className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5 animate-spark" />
            <div className="leading-relaxed">
              <span className="font-semibold text-gray-300 block mb-0.5">Fashion Design Fusing Workflow</span>
              First Render analyzes details of your sketched outerwear, dresses, or coordinates and stitches uploaded custom textures using a combined prompt flow designed automatically for the Imagen 3 generator.
            </div>
          </div>

        </section>

      </main>

      {/* FULLSCREEN LIGHTBOX PREVIEW MODAL */}
      {showFullscreen && generatedImageUrl && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-sm p-4 animate-fade-in">
          
          {/* Lightbox Header Controls */}
          <div className="flex justify-between items-center w-full max-w-7xl mx-auto py-2 border-b border-gray-800 text-gray-300 mb-4">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-purple-500" />
              <span className="text-sm font-bold text-white">Full-Screen Canvas View</span>
            </div>
            
            {/* Interactive Zoom and Close Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setZoomLevel(prev => Math.max(0.5, prev - 0.25))}
                className="px-3 py-1.5 bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 text-xs font-semibold rounded-lg transition-all cursor-pointer"
                title="Zoom Out"
              >
                Zoom Out (-)
              </button>
              <button
                onClick={() => setZoomLevel(1)}
                className="px-3 py-1.5 bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 text-xs font-semibold rounded-lg transition-all cursor-pointer"
                title="Reset Zoom"
              >
                Reset ({Math.round(zoomLevel * 100)}%)
              </button>
              <button
                onClick={() => setZoomLevel(prev => Math.min(3, prev + 0.25))}
                className="px-3 py-1.5 bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 text-xs font-semibold rounded-lg transition-all cursor-pointer"
                title="Zoom In"
              >
                Zoom In (+)
              </button>
              
              <div className="w-px h-6 bg-gray-800" />

              <a
                href={generatedImageUrl}
                download={`design-studio-${selectedModel}-${Date.now()}.jpg`}
                className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Download
              </a>

              <button
                onClick={() => {
                  setShowFullscreen(false);
                  setZoomLevel(1);
                }}
                className="px-4 py-1.5 bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-900/40 text-xs font-bold rounded-lg transition-all cursor-pointer"
              >
                Close (ESC)
              </button>
            </div>
          </div>

          {/* Large Image Viewport */}
          <div className="flex-grow flex items-center justify-center overflow-auto p-4 bg-gray-950/20 rounded-2xl border border-gray-800/40 w-full max-w-7xl mx-auto relative group">
            <div 
              className="transition-transform duration-300 ease-out max-h-full max-w-full flex items-center justify-center"
              style={{ transform: `scale(${zoomLevel})` }}
            >
              <img
                src={generatedImageUrl}
                alt="AI Generated Garment Render Fullscreen"
                className="max-h-[80vh] max-w-[85vw] object-contain shadow-2xl rounded-lg border border-gray-800 p-1"
              />
            </div>
          </div>

          {/* Quick Details overlay in Modal Footer */}
          <div className="w-full max-w-7xl mx-auto py-3 text-center text-xs text-gray-500">
            Render layout: <strong className="text-gray-300">{selectedModel}</strong> | Resolution preset: <strong className="text-gray-300">{selectedQuality}</strong> | Aspect Ratio: <strong className="text-gray-300">{selectedRatio}</strong>
          </div>
        </div>
      )}

      {/* Footer copyright */}
      <footer className="border-t border-gray-800/60 bg-[#090a0f] py-4 text-center text-[11px] text-gray-500">
        <p>© 2026 Design Studio Inc. Licensed powered by Google Gemini and Google Imagen. All Rights Reserved.</p>
      </footer>
    </div>
  );
}
