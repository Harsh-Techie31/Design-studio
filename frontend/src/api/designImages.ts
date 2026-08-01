import { API_BASE, request } from "./client";
import type { DesignImage } from "../types";

export async function listImagesForSeason(
  seasonId: string,
  params?: { image_type?: string; node_key?: string; liked?: boolean; garment_id?: string }
): Promise<DesignImage[]> {
  const searchParams = new URLSearchParams();
  if (params?.image_type) searchParams.set("image_type", params.image_type);
  if (params?.node_key) searchParams.set("node_key", params.node_key);
  if (params?.liked !== undefined) searchParams.set("liked", String(params.liked));
  if (params?.garment_id) searchParams.set("garment_id", params.garment_id);
  const qs = searchParams.toString();
  return request<DesignImage[]>(`/images/season/${seasonId}${qs ? `?${qs}` : ""}`);
}

export async function listImagesForGarment(
  garmentId: string,
  params?: { node_key?: string; image_type?: string; liked?: boolean }
): Promise<DesignImage[]> {
  const searchParams = new URLSearchParams();
  if (params?.node_key) searchParams.set("node_key", params.node_key);
  if (params?.image_type) searchParams.set("image_type", params.image_type);
  if (params?.liked !== undefined) searchParams.set("liked", String(params.liked));
  const qs = searchParams.toString();
  return request<DesignImage[]>(`/images/garment/${garmentId}${qs ? `?${qs}` : ""}`);
}

export async function listImagesForRun(runId: string): Promise<DesignImage[]> {
  return request<DesignImage[]>(`/images/run/${runId}`);
}

export async function getImage(imageId: string): Promise<DesignImage> {
  return request<DesignImage>(`/images/${imageId}`);
}

export async function toggleLike(imageId: string): Promise<DesignImage> {
  return request<DesignImage>(`/images/${imageId}/like`, { method: "PATCH" });
}

export async function toggleStar(imageId: string): Promise<DesignImage> {
  return request<DesignImage>(`/images/${imageId}/star`, { method: "PATCH" });
}

export async function updateNote(imageId: string, note: string): Promise<DesignImage> {
  return request<DesignImage>(`/images/${imageId}/note`, {
    method: "PATCH",
    body: JSON.stringify({ note }),
  });
}

export async function deleteImage(imageId: string): Promise<void> {
  await request(`/images/${imageId}`, { method: "DELETE" });
}

// ─── Upload endpoint ───────────────────────────────────────────────

export async function uploadImageToLibrary(params: {
  file: File;
  season_id: string;
  garment_id?: string;
  image_type: string;
  note?: string;
}): Promise<DesignImage> {
  const formData = new FormData();
  formData.append("file", params.file);
  formData.append("season_id", params.season_id);
  if (params.garment_id) formData.append("garment_id", params.garment_id);
  formData.append("image_type", params.image_type);
  if (params.note) formData.append("note", params.note);

  const res = await fetch(`${API_BASE}/api/images/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Upload failed" }));
    throw new Error(err.detail || "Image upload failed");
  }

  return res.json();
}

export async function getImageCountsForSeason(
  seasonId: string
): Promise<Record<string, { total: number; liked: number }>> {
  return request(`/images/season/${seasonId}/counts`);
}

// ─── Sketch generation ─────────────────────────────────────────────

export interface SketchGenerateParams {
  gender: string;
  silhouette: string;
  descriptors: string[];
  prompt_text: string;
  moodboard_refs: string[];
  mood_influence: number;
  view: string;
  num_outputs: number;
  note: string;
  previous_run_id?: string;
  input_image_ids?: string[];
}

export interface SketchGenerateResponse {
  success: boolean;
  run: {
    id: string;
    code: string;
    iteration: number;
    version: number;
    status: string;
    node_key: string;
  };
  images: {
    id: string;
    image_code: string;
    url: string;
    index: number;
    view: string;
    source: string;
    ai_model: string | null;
  }[];
  category: string;
  gender: string;
  silhouette: string;
  view: string;
  style_descriptors: string[];
  prompt: string;
}

export async function generateSketch(
  garmentId: string,
  params: SketchGenerateParams,
  geminiApiKey?: string
): Promise<SketchGenerateResponse> {
  const formData = new FormData();
  formData.append("gender", params.gender);
  formData.append("silhouette", params.silhouette);
  formData.append("descriptors_json", JSON.stringify(params.descriptors));
  formData.append("prompt_text", params.prompt_text);
  formData.append("moodboard_refs_json", JSON.stringify(params.moodboard_refs));
  formData.append("mood_influence", String(params.mood_influence));
  formData.append("view", params.view);
  formData.append("num_outputs", String(params.num_outputs));
  formData.append("note", params.note);
  if (params.previous_run_id) formData.append("previous_run_id", params.previous_run_id);
  formData.append("input_image_ids_json", JSON.stringify(params.input_image_ids || []));

  const headers: Record<string, string> = {};
  if (geminiApiKey) headers["X-Gemini-API-Key"] = geminiApiKey;

  const res = await fetch(`${API_BASE}/api/garments/${garmentId}/nodes/sketch/generate`, {
    method: "POST",
    headers,
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Generation failed" }));
    throw new Error(err.detail || "Sketch generation failed");
  }

  return res.json();
}

// ─── Tech Pack generation ───────────────────────────────────────────

export interface TechPackGenerateParams {
  render_image_url: string;
  gender: string;
  construction: Record<string, string>;
  stitch_type: string;
  seam_type: string;
  bom: Record<string, string>;
  measurements: Record<string, number>;
  construction_notes: string;
  num_outputs: number;
  note: string;
}

export interface TechPackGenerateResponse {
  success: boolean;
  run: {
    id: string;
    code: string;
    iteration: number;
    version: number;
    status: string;
    node_key: string;
  };
  image: {
    id: string;
    image_code: string;
    url: string;
    source: string;
    ai_model: string | null;
  };
  style_code: string;
}

export async function generateTechPack(
  garmentId: string,
  params: TechPackGenerateParams,
  geminiApiKey?: string
): Promise<TechPackGenerateResponse> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (geminiApiKey) headers["X-Gemini-API-Key"] = geminiApiKey;

  const res = await fetch(`${API_BASE}/api/garments/${garmentId}/nodes/techPack/generate`, {
    method: "POST",
    headers,
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Generation failed" }));
    throw new Error(err.detail || "Tech pack generation failed");
  }

  return res.json();
}

// ─── Pattern generation ─────────────────────────────────────────────

export interface PatternGenerateParams {
  tech_pack_image_url: string;
  gender: string;
  body_measurements: Record<string, number>;
  construction: Record<string, string>;
  fabric_type: string;
  seam_allowance: string;
  hem_allowance: string;
  grain_line: string;
  ease: string;
  pattern_markings: string[];
  additional_notes: string;
  num_outputs: number;
}

export interface PatternGenerateResponse {
  success: boolean;
  run: {
    id: string;
    code: string;
    iteration: number;
    version: number;
    status: string;
    node_key: string;
  };
  image: {
    id: string;
    image_code: string;
    url: string;
    source: string;
    ai_model: string | null;
  };
  style_code: string;
}

export async function generatePattern(
  garmentId: string,
  params: PatternGenerateParams,
  geminiApiKey?: string
): Promise<PatternGenerateResponse> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (geminiApiKey) headers["X-Gemini-API-Key"] = geminiApiKey;

  const res = await fetch(`${API_BASE}/api/garments/${garmentId}/nodes/pattern/generate`, {
    method: "POST",
    headers,
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Generation failed" }));
    throw new Error(err.detail || "Pattern generation failed");
  }

  return res.json();
}

// ─── 3D Visualization generation ────────────────────────────────────

export interface VisualizationGenerateParams {
  render_image_url: string;
  model_avatar: string;
  background: string;
  lighting: string;
  aspect_ratio: string;
  additional_notes: string;
  num_outputs: number;
}

export interface VisualizationGenerateResponse {
  success: boolean;
  run: {
    id: string;
    code: string;
    iteration: number;
    version: number;
    status: string;
    node_key: string;
  };
  images: {
    id: string;
    image_code: string;
    url: string;
    index: number;
    source: string;
    ai_model: string | null;
  }[];
  prompt: string;
  model_avatar: string;
}

export async function generateVisualization(
  garmentId: string,
  params: VisualizationGenerateParams,
  geminiApiKey?: string
): Promise<VisualizationGenerateResponse> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (geminiApiKey) headers["X-Gemini-API-Key"] = geminiApiKey;

  const url = `${API_BASE}/api/garments/${garmentId}/nodes/visualization/generate`;
  console.log("[API:VIZ] POST", url);
  console.log("[API:VIZ] headers:", { ...headers, "X-Gemini-API-Key": geminiApiKey ? "***present***" : "not set" });
  console.log("[API:VIZ] body:", JSON.stringify(params, null, 2));

  const t0 = performance.now();
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(params),
  });
  const elapsed = Math.round(performance.now() - t0);

  console.log("[API:VIZ] Response:", { status: res.status, ok: res.ok, elapsed: `${elapsed}ms` });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Generation failed" }));
    console.error("[API:VIZ] Error:", err);
    throw new Error(err.detail || "Visualization generation failed");
  }

  const data = await res.json();
  console.log("[API:VIZ] Success:", { runCode: data.run?.code, imageCount: data.images?.length, model_avatar: data.model_avatar });
  return data;
}

// ─── Photoshoot generation ───────────────────────────────────────────

export interface PhotoshootGenerateParams {
  visualization_image_url: string;
  moodboard_influence: boolean;
  shot_type: string;
  location: string;
  time_of_day: string;
  mood: string;
  pose: string;
  custom_pose: string;
  additional_notes: string;
  num_outputs: number;
}

export interface PhotoshootGenerateResponse {
  success: boolean;
  run: {
    id: string;
    code: string;
    iteration: number;
    version: number;
    status: string;
    node_key: string;
  };
  images: {
    id: string;
    image_code: string;
    url: string;
    index: number;
    source: string;
    ai_model: string | null;
  }[];
  prompt: string;
  model_avatar: string;
}

export async function generatePhotoshoot(
  garmentId: string,
  params: PhotoshootGenerateParams,
  geminiApiKey?: string
): Promise<PhotoshootGenerateResponse> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (geminiApiKey) headers["X-Gemini-API-Key"] = geminiApiKey;

  const url = `${API_BASE}/api/garments/${garmentId}/nodes/photoshoot/generate`;
  console.log("[API:SHOOT] POST", url);
  console.log("[API:SHOOT] headers:", { ...headers, "X-Gemini-API-Key": geminiApiKey ? "***present***" : "not set" });
  console.log("[API:SHOOT] body:", JSON.stringify(params, null, 2));

  const t0 = performance.now();
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(params),
  });
  const elapsed = Math.round(performance.now() - t0);

  console.log("[API:SHOOT] Response:", { status: res.status, ok: res.ok, elapsed: `${elapsed}ms` });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Generation failed" }));
    console.error("[API:SHOOT] Error:", err);
    throw new Error(err.detail || "Photoshoot generation failed");
  }

  const data = await res.json();
  console.log("[API:SHOOT] Success:", { runCode: data.run?.code, imageCount: data.images?.length, model_avatar: data.model_avatar });
  return data;
}
