import type { Garment, NodeDef, NodeKey, NodeStatus, Season } from "../types";

export const NODE_DEFS: NodeDef[] = [
  { key: "research", number: 1, label: "Research", hint: "Trend & inspiration brief" },
  { key: "sketch", number: 2, label: "Sketch & Concept", hint: "Concept line drawings" },
  { key: "fabric", number: 3, label: "Fabric", hint: "Material & texture selection" },
  { key: "colorTrim", number: 4, label: "Color & Trim", hint: "Palette & trim detailing" },
  { key: "pattern", number: 5, label: "Pattern", hint: "Technical flat pattern" },
  { key: "mockup", number: 6, label: "Mockup & Sample", hint: "Rendered garment mockup" },
  { key: "fitCheck", number: 7, label: "Fit Check", hint: "Fit review & notes" },
  { key: "modelShoot", number: 8, label: "Model Shoot", hint: "Final photoshoot render" },
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

const STATUS_CYCLE: NodeStatus[] = ["done", "done", "active", "empty", "empty", "empty", "empty", "empty"];

function nodeStatusForSeed(seed: number): Record<NodeKey, NodeStatus> {
  const rotated = STATUS_CYCLE.slice(seed % STATUS_CYCLE.length).concat(
    STATUS_CYCLE.slice(0, seed % STATUS_CYCLE.length),
  );
  const record = {} as Record<NodeKey, NodeStatus>;
  NODE_DEFS.forEach((def, i) => {
    record[def.key] = rotated[i];
  });
  return record;
}

export function emptyNodeStatus(): Record<NodeKey, NodeStatus> {
  const record = {} as Record<NodeKey, NodeStatus>;
  NODE_DEFS.forEach((def) => {
    record[def.key] = "empty";
  });
  return record;
}

export const MOCK_GARMENTS: Garment[] = [
  {
    id: "g1",
    seasonId: "s1",
    name: "Frayed Silk Trench",
    seed: 3,
    createdAt: "2026-06-02",
    nodeStatus: nodeStatusForSeed(3),
  },
  {
    id: "g2",
    seasonId: "s1",
    name: "Wide-Leg Ash Trouser",
    seed: 7,
    createdAt: "2026-06-04",
    nodeStatus: nodeStatusForSeed(7),
  },
  {
    id: "g3",
    seasonId: "s1",
    name: "Bonded Shell Jacket",
    seed: 1,
    createdAt: "2026-06-06",
    nodeStatus: nodeStatusForSeed(1),
  },
  {
    id: "g4",
    seasonId: "s2",
    name: "Draped Column Dress",
    seed: 9,
    createdAt: "2026-05-14",
    nodeStatus: nodeStatusForSeed(9),
  },
];

export const MOCK_SEASONS: Season[] = [
  {
    id: "s1",
    name: "Ash & Ember",
    createdAt: "2026-06-01",
    seed: 3,
    palette: paletteForSeed(3),
    keywords: keywordsForSeed(3),
    garmentIds: ["g1", "g2", "g3"],
  },
  {
    id: "s2",
    name: "Quiet Coastline",
    createdAt: "2026-05-10",
    seed: 9,
    palette: paletteForSeed(9),
    keywords: keywordsForSeed(9),
    garmentIds: ["g4"],
  },
];
