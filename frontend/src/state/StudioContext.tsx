import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { Garment, MoodboardImage, Season } from "../types";
import { MOCK_GARMENTS, MOCK_SEASONS, paletteForSeed, keywordsForSeed } from "../data/mockData";

interface StudioContextValue {
  seasons: Season[];
  garments: Garment[];
  getSeason: (id: string) => Season | undefined;
  getGarmentsForSeason: (seasonId: string) => Garment[];
  getGarment: (id: string) => Garment | undefined;
  createSeason: (name: string) => Season;
  createGarment: (seasonId: string, name: string) => Garment;
  setMoodboardImages: (seasonId: string, images: MoodboardImage[]) => void;
}

const StudioContext = createContext<StudioContextValue | null>(null);

function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

export function StudioProvider({ children }: { children: ReactNode }) {
  const [seasons, setSeasons] = useState<Season[]>(MOCK_SEASONS);
  const [garments, setGarments] = useState<Garment[]>(MOCK_GARMENTS);

  const value = useMemo<StudioContextValue>(
    () => ({
      seasons,
      garments,
      getSeason: (id) => seasons.find((s) => s.id === id),
      getGarmentsForSeason: (seasonId) =>
        garments.filter((g) => g.season_id === seasonId),
      getGarment: (id) => garments.find((g) => g.id === id),
      createSeason: (name) => {
        const seed = Math.floor(seasons.length * 5 + name.length + 11);
        const now = new Date().toISOString();
        const season: Season = {
          id: newId("s"),
          name: name.trim() || "Untitled Season",
          moodboard: {
            status: "empty",
            images: [],
            analysis: {
              palette: paletteForSeed(seed),
              keywords: keywordsForSeed(seed),
              brief: null,
              model: null,
              analyzed_at: null,
              error: null,
            },
          },
          created_at: now,
          updated_at: now,
        };
        setSeasons((prev) => [season, ...prev]);
        return season;
      },
      setMoodboardImages: (seasonId, images) => {
        setSeasons((prev) =>
          prev.map((s) =>
            s.id === seasonId
              ? { ...s, moodboard: { ...s.moodboard, images } }
              : s,
          ),
        );
      },
      createGarment: (seasonId, name) => {
        const now = new Date().toISOString();
        const garment: Garment = {
          id: newId("g"),
          season_id: seasonId,
          name: name.trim() || "Untitled Garment",
          node_summary: {},
          created_at: now,
          updated_at: now,
        };
        setGarments((prev) => [garment, ...prev]);
        return garment;
      },
    }),
    [seasons, garments],
  );

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}

export function useStudio(): StudioContextValue {
  const ctx = useContext(StudioContext);
  if (!ctx) throw new Error("useStudio must be used within StudioProvider");
  return ctx;
}
