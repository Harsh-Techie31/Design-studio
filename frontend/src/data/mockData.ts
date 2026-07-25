import type { Garment, MoodboardImage, NodeDef, NodeKey, NodeSummary, Season } from "../types";

export const NODE_DEFS: NodeDef[] = [
  { key: "sketch", number: 1, label: "Sketch", hint: "Generate flat sketch of the garment silhouette" },
  { key: "fabric", number: 2, label: "Fabric/Print", hint: "Pick or generate fabric and print options" },
  { key: "render", number: 3, label: "Render", hint: "Combine sketch + fabric into a colored flat render" },
  { key: "techPack", number: 4, label: "Tech Pack", hint: "Construction spec, measurements, BOM" },
  { key: "pattern", number: 5, label: "Pattern", hint: "Technical flat pattern" },
  { key: "visualization", number: 6, label: "3D Visualization", hint: "3D mockup of the garment" },
  { key: "photoshoot", number: 7, label: "Photoshoot", hint: "Final photoshoot render on model" },
];

const KEYWORD_POOL = [
  "raw silk",
  "brutalist",
  "sun-bleached",
  "nocturne",
  "archive",
  "soft tailoring",
  "industrial",
  "botanical",
  "monastic",
  "coastal fog",
  "patina",
  "translucent",
  "deconstructed",
  "quiet luxury",
  "terracotta",
  "static",
];

function pick<T>(arr: T[], n: number, offset: number): T[] {
  const out: T[] = [];
  for (let i = 0; i < n; i++) out.push(arr[(offset + i * 3) % arr.length]);
  return out;
}

export function paletteForSeed(seed: number): string[] {
  const base = (seed * 47) % 360;
  const s = [58, 32, 74, 20, 45];
  const l = [22, 68, 45, 12, 82];
  return s.map((sat, i) => {
    const hue = (base + i * 27) % 360;
    return hslToHex(hue, sat, l[i]);
  });
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (n: number) =>
    Math.round(255 * f(n)).toString(16).padStart(2, "0");
  return `#${toHex(0)}${toHex(8)}${toHex(4)}`;
}

export function keywordsForSeed(seed: number): string[] {
  return pick(KEYWORD_POOL, 4, seed);
}

function nodeSummaryForSeed(seed: number): Partial<Record<NodeKey, NodeSummary>> {
  const summary = {} as Partial<Record<NodeKey, NodeSummary>>;
  const rotated = seed % 8;
  NODE_DEFS.forEach((def, i) => {
    const idx = (i + rotated) % 8;
    if (idx < 2) {
      summary[def.key] = { run_count: 2, liked_count: 1, has_processing: false, has_failed: false, last_run_at: "2026-06-01T00:00:00Z" };
    } else if (idx === 2) {
      summary[def.key] = { run_count: 1, liked_count: 0, has_processing: true, has_failed: false, last_run_at: "2026-06-01T00:00:00Z" };
    }
  });
  return summary;
}

export function placeholderMoodboard(): MoodboardImage[] {
  return Array.from({ length: 12 }, (_, i) => ({
    url: `mood-placeholder:${i}`,
    imagekit_file_id: null,
    source: "upload" as const,
    order: i,
  }));
}

const now = "2026-06-01T00:00:00Z";

export const MOCK_SEASONS: Season[] = [
  {
    id: "s1",
    code: "SS27",
    moodboard: {
      name: "Ash & Ember",
      status: "ready",
      images: placeholderMoodboard(),
      analysis: {
        palette: paletteForSeed(3),
        keywords: keywordsForSeed(3),
        brief: null,
        model: null,
        analyzed_at: now,
        error: null,
      },
    },
    created_at: now,
    updated_at: now,
  },
  {
    id: "s2",
    code: "AW26",
    moodboard: {
      name: "Quiet Coastline",
      status: "ready",
      images: placeholderMoodboard(),
      analysis: {
        palette: paletteForSeed(9),
        keywords: keywordsForSeed(9),
        brief: null,
        model: null,
        analyzed_at: now,
        error: null,
      },
    },
    created_at: now,
    updated_at: now,
  },
];

export const MOCK_GARMENTS: Garment[] = [
  {
    id: "g1",
    season_id: "s1",
    name: "Frayed Silk Trench",
    category: "JACKET",
    current_version: 1,
    node_summary: nodeSummaryForSeed(3),
    created_at: "2026-06-02T00:00:00Z",
    updated_at: "2026-06-02T00:00:00Z",
  },
  {
    id: "g2",
    season_id: "s1",
    name: "Wide-Leg Ash Trouser",
    category: "PANT",
    current_version: 1,
    node_summary: nodeSummaryForSeed(7),
    created_at: "2026-06-04T00:00:00Z",
    updated_at: "2026-06-04T00:00:00Z",
  },
  {
    id: "g3",
    season_id: "s1",
    name: "Bonded Shell Jacket",
    category: "JACKET",
    current_version: 1,
    node_summary: nodeSummaryForSeed(1),
    created_at: "2026-06-06T00:00:00Z",
    updated_at: "2026-06-06T00:00:00Z",
  },
  {
    id: "g4",
    season_id: "s2",
    name: "Draped Column Dress",
    category: "DRESS",
    current_version: 1,
    node_summary: nodeSummaryForSeed(9),
    created_at: "2026-05-14T00:00:00Z",
    updated_at: "2026-05-14T00:00:00Z",
  },
];
