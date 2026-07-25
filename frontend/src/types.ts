export type NodeKey =
  | "sketch"
  | "fabric"
  | "render"
  | "techPack"
  | "pattern"
  | "visualization"
  | "photoshoot";

export type RunStatus = "pending" | "processing" | "complete" | "failed";

export type MoodboardStatus = "empty" | "uploading" | "analyzing" | "ready" | "failed";

export type ImageSource = "upload" | "pinterest";

export type GarmentCategory =
  | "SHIRT"
  | "TEE"
  | "TOP"
  | "DRESS"
  | "SKIRT"
  | "PANT"
  | "SHORT"
  | "JACKET"
  | "SWTSHRT"
  | "JUMP";

export interface CategoryDef {
  code: GarmentCategory;
  label: string;
}

export const CATEGORY_DEFS: CategoryDef[] = [
  { code: "SHIRT", label: "Shirt" },
  { code: "TEE", label: "Tee" },
  { code: "TOP", label: "Top" },
  { code: "DRESS", label: "Dress" },
  { code: "SKIRT", label: "Skirt" },
  { code: "PANT", label: "Pant" },
  { code: "SHORT", label: "Short" },
  { code: "JACKET", label: "Jacket" },
  { code: "SWTSHRT", label: "Sweatshirt" },
  { code: "JUMP", label: "Jumpsuit" },
];

// ─── Sub-models (mirror backend/app/models/) ─────────────────────────────────

export interface MoodboardImage {
  url: string;
  imagekit_file_id: string | null;
  source: ImageSource;
  order: number;
}

export interface MoodboardAnalysis {
  palette: string[];
  keywords: string[];
  brief: string | null;
  model: string | null;
  analyzed_at: string | null;
  error: string | null;
}

export interface MoodboardData {
  name: string | null;
  status: MoodboardStatus;
  images: MoodboardImage[];
  analysis: MoodboardAnalysis;
}

export interface NodeSummary {
  run_count: number;
  liked_count: number;
  has_processing: boolean;
  has_failed: boolean;
  last_run_at: string | null;
}

export interface RunInputRef {
  run_id: string;
  node_key: NodeKey;
}

export interface AIMeta {
  model: string | null;
  prompt: string | null;
  started_at: string | null;
  completed_at: string | null;
  error: string | null;
  retry_count: number;
}

export interface NodeOutput {
  images: string[];
  text: string | null;
  extra: Record<string, unknown>;
}

// ─── Document types (mirror backend/app/models/{season,garment,node_run}.py) ─

export interface Season {
  id: string;
  code: string | null;
  moodboard: MoodboardData;
  created_at: string;
  updated_at: string;
}

export interface Garment {
  id: string;
  season_id: string;
  name: string;
  category: GarmentCategory | null;
  style_number: number;
  current_version: number;
  node_summary: Partial<Record<NodeKey, NodeSummary>>;
  created_at: string;
  updated_at: string;
}

export interface NodeRun {
  id: string;
  season_id: string;
  garment_id: string;
  node_key: NodeKey;
  iteration: number;
  version: number;
  code: string;
  status: RunStatus;
  liked: boolean;
  inputs: RunInputRef[];
  output: NodeOutput;
  ai: AIMeta;
  created_at: string;
  updated_at: string;
}

// ─── Frontend-only UI metadata ───────────────────────────────────────────────

export interface NodeDef {
  key: NodeKey;
  number: number;
  label: string;
  hint: string;
}

// ─── Derived status from NodeSummary (replaces old NodeStatus) ───────────────

export function nodeStatusFromSummary(summary: NodeSummary | undefined): "empty" | "active" | "done" {
  if (!summary || summary.run_count === 0) return "empty";
  if (summary.has_processing) return "active";
  return "done";
}

// ─── Seed derivation from ID (for placeholder tile generation) ───────────────

export function seedFromId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}
