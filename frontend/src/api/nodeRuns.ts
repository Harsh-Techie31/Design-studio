import { request } from "./client";
import type { NodeRun, NodeKey } from "../types";

export async function listRuns(
  garmentId: string,
  nodeKey: NodeKey,
): Promise<NodeRun[]> {
  return request<NodeRun[]>(`/garments/${garmentId}/nodes/${nodeKey}/runs`);
}

export async function createRun(
  garmentId: string,
  nodeKey: NodeKey,
): Promise<NodeRun> {
  return request<NodeRun>(`/garments/${garmentId}/nodes/${nodeKey}/runs`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function toggleLike(
  runId: string,
  liked: boolean,
): Promise<NodeRun> {
  return request<NodeRun>(`/node-runs/${runId}/like`, {
    method: "PATCH",
    body: JSON.stringify({ liked }),
  });
}
