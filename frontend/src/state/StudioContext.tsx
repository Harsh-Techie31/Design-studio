import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Garment, GarmentCategory, MoodboardImage, Season } from "../types";
import * as seasonsApi from "../api/seasons";
import * as garmentsApi from "../api/garments";
import * as uploadsApi from "../api/uploads";

interface StudioContextValue {
  seasons: Season[];
  garments: Garment[];
  loading: boolean;
  error: string | null;
  getSeason: (id: string) => Season | undefined;
  getGarmentsForSeason: (seasonId: string) => Garment[];
  getGarment: (id: string) => Garment | undefined;
  createSeason: (code: string) => Promise<Season>;
  createGarment: (seasonId: string, category: GarmentCategory) => Promise<Garment>;
  setMoodboardImages: (seasonId: string, images: MoodboardImage[], name?: string) => Promise<void>;
  analyzeMoodboard: (seasonId: string) => Promise<void>;
  deleteSeason: (seasonId: string) => Promise<void>;
  refreshSeasons: () => Promise<void>;
}

const StudioContext = createContext<StudioContextValue | null>(null);

export function StudioProvider({ children }: { children: ReactNode }) {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [garments, setGarments] = useState<Garment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshSeasons = useCallback(async () => {
    try {
      setError(null);
      const data = await seasonsApi.listSeasons();
      setSeasons(data);
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setError(null);
        const s = await seasonsApi.listSeasons();
        setSeasons(s);
        const ids = s.map((x) => x.id);
        if (ids.length > 0) {
          const results = await Promise.all(ids.map((sid) => garmentsApi.listGarments(sid)));
          setGarments(results.flat());
        }
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const getSeason = useCallback(
    (id: string) => seasons.find((s) => s.id === id),
    [seasons],
  );

  const getGarmentsForSeason = useCallback(
    (seasonId: string) => garments.filter((g) => g.season_id === seasonId),
    [garments],
  );

  const getGarment = useCallback(
    (id: string) => garments.find((g) => g.id === id),
    [garments],
  );

  const createSeason = useCallback(
    async (code: string) => {
      const season = await seasonsApi.createSeason(code);
      setSeasons((prev) => [season, ...prev]);
      return season;
    },
    [],
  );

  const createGarment = useCallback(
    async (seasonId: string, category: GarmentCategory) => {
      const garment = await garmentsApi.createGarment(seasonId, category);
      setGarments((prev) => [garment, ...prev]);
      return garment;
    },
    [],
  );

  const setMoodboardImages = useCallback(
    async (seasonId: string, images: MoodboardImage[], name?: string) => {
      setSeasons((prev) =>
        prev.map((s) =>
          s.id === seasonId
            ? { ...s, moodboard: { ...s.moodboard, images, name: name ?? s.moodboard.name } }
            : s,
        ),
      );

      const filesToUpload = images
        .filter((img) => img.url.startsWith("data:"))
        .map((img) => dataUrlToFile(img.url, `moodboard_${Date.now()}.png`));

      if (filesToUpload.length === 0) {
        console.log("[StudioContext] No data-url files to upload, skipping API call");
        return;
      }

      console.log(`[StudioContext] Uploading ${filesToUpload.length} files to backend`);
      try {
        const res = await uploadsApi.uploadMoodboardImages(seasonId, filesToUpload, name);
        console.log("[StudioContext] Upload response:", res);
        if (res.moodboard) {
          setSeasons((prev) =>
            prev.map((s) =>
              s.id === seasonId ? { ...s, moodboard: res.moodboard as any } : s,
            ),
          );
        }
      } catch (e) {
        console.error("[StudioContext] Upload failed:", e);
        throw e;
      }
    },
    [],
  );

  const analyzeMoodboard = useCallback(
    async (seasonId: string) => {
      console.log(`[StudioContext] Starting analysis for season ${seasonId}`);
      setSeasons((prev) =>
        prev.map((s) =>
          s.id === seasonId
            ? { ...s, moodboard: { ...s.moodboard, status: "analyzing" as const } }
            : s,
        ),
      );

      try {
        const res = await seasonsApi.analyzeMoodboard(seasonId);
        console.log("[StudioContext] Analysis complete:", res);
        setSeasons((prev) =>
          prev.map((s) =>
            s.id === seasonId ? { ...s, moodboard: res.moodboard } : s,
          ),
        );
      } catch (e: any) {
        console.error("[StudioContext] Analysis failed:", e);
        const rawMsg = e?.message ?? "Unknown error";
        const safeMsg = rawMsg.includes("key=")
          ? "Analysis service error. Please try again."
          : rawMsg.length > 200
            ? rawMsg.slice(0, 200)
            : rawMsg;
        setSeasons((prev) =>
          prev.map((s) =>
            s.id === seasonId
              ? {
                  ...s,
                  moodboard: {
                    ...s.moodboard,
                    status: "failed" as const,
                    analysis: { ...s.moodboard.analysis, error: safeMsg },
                  },
                }
              : s,
          ),
        );
      }
    },
    [],
  );

  const deleteSeason = useCallback(
    async (seasonId: string) => {
      await seasonsApi.deleteSeason(seasonId);
      setSeasons((prev) => prev.filter((s) => s.id !== seasonId));
      setGarments((prev) => prev.filter((g) => g.season_id !== seasonId));
    },
    [],
  );

  const value = useMemo<StudioContextValue>(
    () => ({
      seasons,
      garments,
      loading,
      error,
      getSeason,
      getGarmentsForSeason,
      getGarment,
      createSeason,
      createGarment,
      setMoodboardImages,
      analyzeMoodboard,
      deleteSeason,
      refreshSeasons,
    }),
    [seasons, garments, loading, error, getSeason, getGarmentsForSeason, getGarment, createSeason, createGarment, setMoodboardImages, analyzeMoodboard, deleteSeason, refreshSeasons],
  );

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}

export function useStudio(): StudioContextValue {
  const ctx = useContext(StudioContext);
  if (!ctx) throw new Error("useStudio must be used within StudioProvider");
  return ctx;
}

function dataUrlToFile(dataUrl: string, filename: string): File {
  const [header, data] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] ?? "image/png";
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], filename, { type: mime });
}
