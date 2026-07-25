import { request } from "./client";
import type { Season } from "../types";

export async function listSeasons(): Promise<Season[]> {
  return request<Season[]>("/seasons");
}

export async function getSeason(id: string): Promise<Season> {
  return request<Season>(`/seasons/${id}`);
}

export async function createSeason(code: string): Promise<Season> {
  return request<Season>("/seasons", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

export async function updateSeason(
  id: string,
  data: { code?: string },
): Promise<Season> {
  return request<Season>(`/seasons/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteSeason(id: string): Promise<void> {
  return request<void>(`/seasons/${id}`, { method: "DELETE" });
}

export async function analyzeMoodboard(
  seasonId: string,
): Promise<{ moodboard: Season["moodboard"] }> {
  return request<{ moodboard: Season["moodboard"] }>(
    `/seasons/${seasonId}/moodboard/analyze`,
    { method: "POST" },
  );
}
