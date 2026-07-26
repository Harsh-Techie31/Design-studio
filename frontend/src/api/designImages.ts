import { request } from "./client";
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

  const res = await fetch("/api/images/upload", {
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

  const res = await fetch(`/api/garments/${garmentId}/nodes/sketch/generate`, {
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
