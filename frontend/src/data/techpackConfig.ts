/**
 * Construction details options and measurement templates for all 10 garment categories.
 * Used by the Tech Pack stage (Stage 4).
 */

export interface ConstructionField {
  field: string;
  options: string[];
}

export const CONSTRUCTION_OPTIONS: Record<string, ConstructionField[]> = {
  PANT: [
    { field: "Waistband", options: ["Curtain", "Faced", "Elasticated", "Drawstring", "No waistband"] },
    { field: "Fly", options: ["Zip fly", "Button fly", "No fly (pull-on)"] },
    { field: "Pocket", options: ["Side seam", "Slant", "Patch", "Welt", "No pocket"] },
    { field: "Leg opening", options: ["Straight hem", "Cuffed", "Elasticated", "Raw edge"] },
  ],
  SHIRT: [
    { field: "Collar", options: ["Spread", "Button-down", "Mandarin", "Band", "Camp", "No collar"] },
    { field: "Cuff", options: ["Barrel", "French", "Roll-up tab", "Open/no cuff"] },
    { field: "Placket", options: ["Standard", "Concealed", "Half-placket"] },
    { field: "Yoke", options: ["Single yoke", "Split yoke", "No yoke"] },
  ],
  TEE: [
    { field: "Neckline", options: ["Crew", "V-neck", "Scoop", "Henley", "Mock neck"] },
    { field: "Sleeve", options: ["Set-in", "Raglan", "Drop shoulder", "Sleeveless"] },
    { field: "Hem", options: ["Straight", "Curved", "Raw", "Split side"] },
  ],
  TOP: [
    { field: "Neckline", options: ["Round", "V-neck", "Square", "Off-shoulder", "Halter", "Boat neck"] },
    { field: "Sleeve", options: ["Set-in", "Cap", "Flutter", "Sleeveless", "Bell"] },
    { field: "Closure", options: ["None (pullover)", "Back zip", "Side zip", "Button front", "Tie back"] },
    { field: "Hem", options: ["Straight", "Curved", "Peplum", "Asymmetric"] },
  ],
  DRESS: [
    { field: "Neckline", options: ["Round", "V-neck", "Square", "Sweetheart", "Halter", "Boat neck"] },
    { field: "Sleeve", options: ["Set-in", "Cap", "Flutter", "Long", "Sleeveless", "Puff"] },
    { field: "Closure", options: ["Back zip", "Side zip", "Button front", "Wrap tie", "None (pullover)"] },
    { field: "Waist", options: ["Fitted seam", "Elastic", "Drawstring", "Drop waist", "No waist seam"] },
    { field: "Skirt", options: ["A-line", "Gathered", "Pleated", "Tiered", "Straight"] },
  ],
  SKIRT: [
    { field: "Waist", options: ["Faced waistband", "Elasticated", "Yoke", "Drawstring"] },
    { field: "Closure", options: ["Side zip", "Back zip", "Button", "Wrap", "No closure (pull-on)"] },
    { field: "Panel", options: ["Single panel", "Two panel (front/back)", "Multi-gore", "Circle cut"] },
    { field: "Hem", options: ["Straight", "Curved", "Handkerchief", "Tiered", "Slit"] },
  ],
  SHORT: [
    { field: "Waistband", options: ["Curtain", "Faced", "Elasticated", "Drawstring"] },
    { field: "Fly", options: ["Zip fly", "Button fly", "No fly"] },
    { field: "Pocket", options: ["Side seam", "Slant", "Patch", "Cargo", "No pocket"] },
    { field: "Hem", options: ["Straight", "Cuffed", "Raw", "Scalloped"] },
  ],
  JACKET: [
    { field: "Collar", options: ["Notched lapel", "Shawl", "Stand", "Hood", "No collar"] },
    { field: "Closure", options: ["Zip", "Button", "Snap", "Toggle", "Open front"] },
    { field: "Pocket", options: ["Welt", "Patch", "Flap", "No pocket"] },
    { field: "Lining", options: ["Fully lined", "Half lined", "Unlined"] },
  ],
  SWTSHRT: [
    { field: "Neckline", options: ["Crew", "Hoodie", "Half-zip", "Quarter-zip", "Mock neck"] },
    { field: "Cuff", options: ["Ribbed", "Open", "Elasticated", "Thumbhole"] },
    { field: "Hem", options: ["Ribbed", "Straight", "Drawstring", "Raw"] },
    { field: "Pocket", options: ["Kangaroo", "Side seam", "No pocket"] },
  ],
  JUMP: [
    { field: "Neckline", options: ["Round", "V-neck", "Square", "Strapless", "Halter", "Collared"] },
    { field: "Sleeve", options: ["Set-in", "Cap", "Sleeveless", "Long", "Short"] },
    { field: "Waist", options: ["Fitted seam", "Elastic", "Belted", "Drawstring"] },
    { field: "Closure", options: ["Front zip", "Back zip", "Button", "Wrap"] },
    { field: "Leg opening", options: ["Straight", "Wide", "Tapered", "Cuffed"] },
  ],
};

export const STITCH_OPTIONS = ["Lockstitch", "Overlock", "Flatlock", "Coverstitch", "Chain stitch"];
export const SEAM_OPTIONS = ["Plain seam", "French seam", "Flat-felled", "Bound seam"];

export const MEASUREMENT_FIELDS: Record<string, string[]> = {
  PANT: ["Waist", "Hip", "Inseam", "Outseam", "Thigh", "Knee", "Leg opening", "Front rise", "Back rise"],
  SHIRT: ["Chest", "Shoulder width", "Sleeve length", "Bicep", "Wrist/Cuff", "Back length", "Front length", "Neck", "Armhole"],
  TEE: ["Chest", "Shoulder width", "Sleeve length", "Bicep", "Body length (front)", "Body length (back)", "Hem width", "Neck opening"],
  TOP: ["Bust", "Shoulder width", "Sleeve length", "Bicep", "Body length (front)", "Body length (back)", "Hem width", "Neck drop (front)", "Neck drop (back)", "Armhole"],
  DRESS: ["Bust", "Waist", "Hip", "Shoulder width", "Sleeve length", "Bicep", "Total length (front)", "Total length (back)", "Hem sweep", "Neck drop (front)", "Armhole", "Skirt length"],
  SKIRT: ["Waist", "Hip", "Total length", "Hem sweep", "Slit length"],
  SHORT: ["Waist", "Hip", "Outseam", "Inseam", "Thigh", "Leg opening", "Front rise", "Back rise"],
  JACKET: ["Chest", "Shoulder width", "Sleeve length", "Bicep", "Wrist", "Body length (front)", "Body length (back)", "Hem width", "Neck", "Armhole", "Lapel width"],
  SWTSHRT: ["Chest", "Shoulder width", "Sleeve length", "Bicep", "Wrist/Cuff", "Body length", "Hem width", "Neck opening", "Hood depth"],
  JUMP: ["Bust", "Waist", "Hip", "Shoulder width", "Sleeve length", "Bicep", "Total length", "Inseam", "Thigh", "Leg opening", "Front rise", "Back rise", "Hem sweep"],
};

const BASE_MENSWEAR: Record<string, number> = {
  Chest: 110, Waist: 94, Hip: 110, Inseam: 81, "Shoulder width": 47,
  "Back length": 76, "Arm length": 66, Neck: 42, Thigh: 64, Outseam: 105,
  Knee: 46, "Leg opening": 40, "Front rise": 28, "Back rise": 38,
  "Sleeve length": 66, Bicep: 38, Wrist: 17, "Wrist/Cuff": 17,
  "Hem width": 52, "Body length (front)": 72, "Body length (back)": 76,
  "Neck opening": 42, "Hood depth": 0, Bust: 110,
  "Total length (front)": 76, "Total length (back)": 76, "Total length": 105,
  "Hem sweep": 52, "Neck drop (front)": 0, "Skirt length": 0, "Slit length": 0, "Lapel width": 0,
};

const BASE_WOMENSWEAR: Record<string, number> = {
  Chest: 100, Bust: 100, Waist: 80, Hip: 108, Inseam: 76, "Shoulder width": 41,
  "Back length": 70, "Arm length": 60, Neck: 37, Thigh: 60, Outseam: 100,
  Knee: 42, "Leg opening": 36, "Front rise": 26, "Back rise": 36,
  "Sleeve length": 60, Bicep: 34, Wrist: 15, "Wrist/Cuff": 15,
  "Hem width": 48, "Body length (front)": 60, "Body length (back)": 64,
  "Neck opening": 37, "Hood depth": 0,
  "Total length (front)": 90, "Total length (back)": 94, "Total length": 100,
  "Hem sweep": 90, "Neck drop (front)": 8, "Skirt length": 50, "Slit length": 0, "Lapel width": 0,
};

export function getDefaultMeasurements(category: string, gender: string): Record<string, number> {
  const fields = MEASUREMENT_FIELDS[category] || [];
  const base = gender.toLowerCase().includes("female") || gender.toLowerCase().includes("women")
    ? BASE_WOMENSWEAR : BASE_MENSWEAR;
  const result: Record<string, number> = {};
  for (const field of fields) {
    result[field] = base[field] ?? 0;
  }
  return result;
}

export const BOM_FIELDS = [
  { key: "Main fabric", autoFilled: true, placeholder: "e.g. Olive floral cotton twill, 240gsm, 58in" },
  { key: "Secondary fabric", autoFilled: false, placeholder: "Lining, contrast panels, etc." },
  { key: "Interlining / Fusing", autoFilled: false, placeholder: "Waistband fusing, weight, type" },
  { key: "Thread", autoFilled: false, placeholder: "Type, color, tex count" },
  { key: "Zipper", autoFilled: false, placeholder: "Type (metal/coil), size, color, brand" },
  { key: "Buttons", autoFilled: false, placeholder: "Material, size mm, qty, style (shank/flat)" },
  { key: "Elastic", autoFilled: false, placeholder: "Width, type, placement" },
  { key: "Labels", autoFilled: false, placeholder: "Main label, care label, size label, placement" },
  { key: "Hang tags and packaging", autoFilled: false, placeholder: "Tag type, polybag, hanger, tissue" },
  { key: "Additional trims", autoFilled: false, placeholder: "Rivets, eyelets, drawcords, D-rings, etc." },
];
