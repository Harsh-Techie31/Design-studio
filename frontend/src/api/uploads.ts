import type { MoodboardImage } from "../types";

interface UploadResponse {
  images: MoodboardImage[];
  moodboard: {
    name: string | null;
    status: string;
    images: MoodboardImage[];
    analysis: {
      palette: string[];
      keywords: string[];
      brief: string | null;
      model: string | null;
      analyzed_at: string | null;
      error: string | null;
    };
  };
}

export async function uploadMoodboardImages(
  seasonId: string,
  files: File[],
  name?: string,
): Promise<UploadResponse> {
  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }
  if (name) {
    formData.append("name", name);
  }

  const res = await fetch(`/api/seasons/${seasonId}/moodboard/images`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Upload failed: ${res.status}`);
  }

  return res.json();
}

export async function deleteMoodboardImage(
  seasonId: string,
  imageIndex: number,
): Promise<void> {
  const res = await fetch(
    `/api/seasons/${seasonId}/moodboard/images/${imageIndex}`,
    { method: "DELETE" },
  );

  if (!res.ok && res.status !== 204) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Delete failed: ${res.status}`);
  }
}
