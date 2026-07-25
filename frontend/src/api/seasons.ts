import { request } from "./client";
import type { Season } from "../types";

export async function listSeasons(): Promise<Season[]> {
  return request<Season[]>("/seasons");
}

export async function getSeason(id: string): Promise<Season> {
  return request<Season>(`/seasons/${id}`);
}

export async function createSeason(name: string): Promise<Season> {
  return request<Season>("/seasons", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function updateSeason(
  id: string,
  data: { name?: string },
): Promise<Season> {
  return request<Season>(`/seasons/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteSeason(id: string): Promise<void> {
  return request<void>(`/seasons/${id}`, { method: "DELETE" });
}
