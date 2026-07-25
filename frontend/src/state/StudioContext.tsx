import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { Garment, Season } from "../types";
import {
  MOCK_GARMENTS,
  MOCK_SEASONS,
  emptyNodeStatus,
  keywordsForSeed,
  paletteForSeed,
} from "../data/mockData";

interface StudioContextValue {
  seasons: Season[];
  garments: Garment[];
  getSeason: (id: string) => Season | undefined;
  getGarmentsForSeason: (seasonId: string) => Garment[];
  getGarment: (id: string) => Garment | undefined;
  createSeason: (name: string) => Season;
  createGarment: (seasonId: string, name: string) => Garment;
  setMoodboardImages: (seasonId: string, images: string[]) => void;
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
        garments.filter((g) => g.seasonId === seasonId),
      getGarment: (id) => garments.find((g) => g.id === id),
      createSeason: (name) => {
        const seed = Math.floor(seasons.length * 5 + name.length + 11);
        const season: Season = {
          id: newId("s"),
          name: name.trim() || "Untitled Season",
          createdAt: new Date().toISOString().slice(0, 10),
          seed,
          palette: paletteForSeed(seed),
          keywords: keywordsForSeed(seed),
          garmentIds: [],
          moodboardImages: [],
        };
        setSeasons((prev) => [season, ...prev]);
        return season;
      },
      setMoodboardImages: (seasonId, images) => {
        setSeasons((prev) =>
          prev.map((s) => (s.id === seasonId ? { ...s, moodboardImages: images } : s)),
        );
      },
      createGarment: (seasonId, name) => {
        const seed = Math.floor(garments.length * 4 + name.length + 3);
        const garment: Garment = {
          id: newId("g"),
          seasonId,
          name: name.trim() || "Untitled Garment",
          seed,
          createdAt: new Date().toISOString().slice(0, 10),
          nodeStatus: emptyNodeStatus(),
        };
        setGarments((prev) => [garment, ...prev]);
        setSeasons((prev) =>
          prev.map((s) =>
            s.id === seasonId
              ? { ...s, garmentIds: [garment.id, ...s.garmentIds] }
              : s,
          ),
        );
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
