export type NodeStatus = "empty" | "active" | "done";

export type NodeKey =
  | "research"
  | "sketch"
  | "fabric"
  | "colorTrim"
  | "pattern"
  | "mockup"
  | "fitCheck"
  | "modelShoot";

export interface NodeDef {
  key: NodeKey;
  number: number;
  label: string;
  hint: string;
}

export interface Garment {
  id: string;
  seasonId: string;
  name: string;
  seed: number;
  createdAt: string;
  nodeStatus: Record<NodeKey, NodeStatus>;
}

export interface Season {
  id: string;
  name: string;
  createdAt: string;
  seed: number;
  palette: string[];
  keywords: string[];
  garmentIds: string[];
}
