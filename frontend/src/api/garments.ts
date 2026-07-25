import { request } from "./client";
import type { Garment, GarmentCategory } from "../types";

export async function listGarments(seasonId: string): Promise<Garment[]> {
  return request<Garment[]>(`/seasons/${seasonId}/garments`);
}

export async function getGarment(id: string): Promise<Garment> {
  return request<Garment>(`/garments/${id}`);
}

export async function createGarment(
  seasonId: string,
  name: string,
  category: GarmentCategory,
): Promise<Garment> {
  return request<Garment>(`/seasons/${seasonId}/garments`, {
    method: "POST",
    body: JSON.stringify({ name, category }),
  });
}

export async function updateGarment(
  id: string,
  data: { name?: string; category?: GarmentCategory },
): Promise<Garment> {
  return request<Garment>(`/garments/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteGarment(id: string): Promise<void> {
  return request<void>(`/garments/${id}`, { method: "DELETE" });
}
