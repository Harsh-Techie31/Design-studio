/**
 * Body measurement fields and pattern settings for all 10 garment categories.
 * Used by the Pattern stage (Stage 5).
 */

export interface BodyMeasurementField {
  field: string;
  menswearDefault: number;
  womenswearDefault: number;
}

/** Per-category body measurement fields for pattern drafting. */
export const BODY_MEASUREMENT_FIELDS: Record<string, BodyMeasurementField[]> = {
  PANT: [
    { field: "Crotch depth", menswearDefault: 29, womenswearDefault: 27 },
    { field: "Waist to hip", menswearDefault: 22, womenswearDefault: 20 },
    { field: "Waist to knee", menswearDefault: 62, womenswearDefault: 58 },
    { field: "Waist to ankle", menswearDefault: 107, womenswearDefault: 100 },
  ],
  SHORT: [
    { field: "Crotch depth", menswearDefault: 29, womenswearDefault: 27 },
    { field: "Waist to hip", menswearDefault: 22, womenswearDefault: 20 },
    { field: "Waist to knee", menswearDefault: 62, womenswearDefault: 58 },
  ],
  SHIRT: [
    { field: "Shoulder slope", menswearDefault: 5, womenswearDefault: 4 },
    { field: "Armhole depth", menswearDefault: 24, womenswearDefault: 21 },
    { field: "Nape to waist", menswearDefault: 44, womenswearDefault: 40 },
    { field: "Across back", menswearDefault: 40, womenswearDefault: 36 },
    { field: "Across front", menswearDefault: 38, womenswearDefault: 34 },
  ],
  TEE: [
    { field: "Shoulder slope", menswearDefault: 5, womenswearDefault: 4 },
    { field: "Armhole depth", menswearDefault: 24, womenswearDefault: 21 },
    { field: "Nape to waist", menswearDefault: 44, womenswearDefault: 40 },
    { field: "Across back", menswearDefault: 40, womenswearDefault: 36 },
    { field: "Across front", menswearDefault: 38, womenswearDefault: 34 },
  ],
  TOP: [
    { field: "Shoulder slope", menswearDefault: 5, womenswearDefault: 4 },
    { field: "Armhole depth", menswearDefault: 24, womenswearDefault: 21 },
    { field: "Nape to waist", menswearDefault: 44, womenswearDefault: 40 },
    { field: "Across back", menswearDefault: 40, womenswearDefault: 36 },
    { field: "Across front", menswearDefault: 38, womenswearDefault: 34 },
  ],
  SWTSHRT: [
    { field: "Shoulder slope", menswearDefault: 5, womenswearDefault: 4 },
    { field: "Armhole depth", menswearDefault: 24, womenswearDefault: 21 },
    { field: "Nape to waist", menswearDefault: 44, womenswearDefault: 40 },
    { field: "Across back", menswearDefault: 40, womenswearDefault: 36 },
    { field: "Across front", menswearDefault: 38, womenswearDefault: 34 },
  ],
  JACKET: [
    { field: "Shoulder slope", menswearDefault: 5, womenswearDefault: 4 },
    { field: "Armhole depth", menswearDefault: 24, womenswearDefault: 21 },
    { field: "Nape to waist", menswearDefault: 44, womenswearDefault: 40 },
    { field: "Across back", menswearDefault: 40, womenswearDefault: 36 },
    { field: "Across front", menswearDefault: 38, womenswearDefault: 34 },
  ],
  DRESS: [
    { field: "Shoulder slope", menswearDefault: 5, womenswearDefault: 4 },
    { field: "Armhole depth", menswearDefault: 24, womenswearDefault: 21 },
    { field: "Nape to waist", menswearDefault: 44, womenswearDefault: 40 },
    { field: "Across back", menswearDefault: 40, womenswearDefault: 36 },
    { field: "Across front", menswearDefault: 38, womenswearDefault: 34 },
    { field: "Waist to hip", menswearDefault: 22, womenswearDefault: 20 },
    { field: "Waist to knee", menswearDefault: 62, womenswearDefault: 58 },
    { field: "Waist to ankle", menswearDefault: 107, womenswearDefault: 100 },
  ],
  SKIRT: [
    { field: "Waist to hip", menswearDefault: 22, womenswearDefault: 20 },
    { field: "Waist to knee", menswearDefault: 62, womenswearDefault: 58 },
    { field: "Waist to ankle", menswearDefault: 107, womenswearDefault: 100 },
  ],
  JUMP: [
    { field: "Shoulder slope", menswearDefault: 5, womenswearDefault: 4 },
    { field: "Armhole depth", menswearDefault: 24, womenswearDefault: 21 },
    { field: "Nape to waist", menswearDefault: 44, womenswearDefault: 40 },
    { field: "Across back", menswearDefault: 40, womenswearDefault: 36 },
    { field: "Across front", menswearDefault: 38, womenswearDefault: 34 },
    { field: "Crotch depth", menswearDefault: 29, womenswearDefault: 27 },
    { field: "Waist to hip", menswearDefault: 22, womenswearDefault: 20 },
    { field: "Waist to knee", menswearDefault: 62, womenswearDefault: 58 },
    { field: "Waist to ankle", menswearDefault: 107, womenswearDefault: 100 },
  ],
};

export function getDefaultBodyMeasurements(category: string, gender: string): Record<string, number> {
  const fields = BODY_MEASUREMENT_FIELDS[category] || [];
  const isFemale = gender.toLowerCase().includes("female") || gender.toLowerCase().includes("women");
  const result: Record<string, number> = {};
  for (const f of fields) {
    result[f.field] = isFemale ? f.womenswearDefault : f.menswearDefault;
  }
  return result;
}

/** Pattern settings options (universal, all categories). */
export const PATTERN_SETTINGS = {
  fabricType: ["Woven", "Knit", "Stretch woven"],
  seamAllowance: ["0.5cm", "1cm", "1.5cm", "2cm"],
  hemAllowance: ["1cm", "2cm", "3cm", "4cm"],
  grainLine: ["Lengthwise", "Crosswise", "Bias"],
  ease: ["Close fit", "Standard", "Relaxed"],
  patternMarkings: ["Notches", "Drill holes", "Grain arrows", "Fold lines"],
} as const;

export const PATTERN_SETTINGS_DEFAULTS = {
  seamAllowance: "1cm",
  hemAllowance: "3cm",
  grainLine: "Lengthwise",
  ease: "Standard",
  patternMarkings: ["Notches", "Drill holes", "Grain arrows", "Fold lines"],
};
