# Design Studio, Handover Notes

Prototype HTML has all the visual layout and interactions. This doc covers what the HTML cannot express: naming logic, business rules, structural decisions, and behavior across stages.

---

## 1. App Structure (Hierarchy)

```
Design Studio (single user, no multi-team for MVP)
  └── Seasons (list view, all seasons ever created)
        └── Season (identified by a short Season Code, e.g. SS27, AW27)
              ├── Moodboard (has its own descriptive name, e.g. "Ash and Ember")
              │     ├── 12 images (upload or Pinterest import)
              │     ├── AI-generated palette (5 colors)
              │     └── AI-generated mood tags
              ├── Fabrics library
              ├── Prints library
              ├── Sketches library (manual reference sketches only)
              └── Garments (list of garments in this season)
                    └── Garment (single item, e.g. "Wide-Leg Ash Trouser")
                          └── 7 Stages
```

Key distinction:
- **Season** is a fashion cycle identifier. Short, code-like. Examples: `SS27`, `AW27`, `W27`, `RESORT27`, `PF27`.
- **Moodboard** is a named creative direction that lives inside a season. Examples: "Ash and Ember", "Quiet Coastline". Descriptive, free text.
- One moodboard per season for MVP.

---

## 2. The 7 Stages (Locked)

There is NO stage 0 for forecasting or research. Work starts at Sketch.

| # | Name | Abbreviation | What happens |
|---|------|--------------|--------------|
| 1 | Sketch | SKTCH | Generate flat sketch of the garment silhouette |
| 2 | Fabric/Print | FBRC | Pick or generate fabric and print options |
| 3 | Render | RNDR | Combine sketch + fabric/print into a colored flat render |
| 4 | Tech Pack | TECH | Construction spec, measurements, BOM |
| 5 | Pattern | PTRN | Technical flat pattern |
| 6 | 3D Visualization | 3D | 3D mockup of the garment |
| 7 | Photoshoot | SHOOT | Final photoshoot render on model |

Note on rename: Original stage names were "Color and Trim", "Fit Check", "Mockup and Sample", "Model Shoot". These have been renamed to the industry-standard names above.

---

## 3. Category List (Locked, 10 options)

Used in the "+ New Garment" modal.

| # | Display Name | Code |
|---|--------------|------|
| 1 | Shirt | SHIRT |
| 2 | Tee | TEE |
| 3 | Top | TOP |
| 4 | Dress | DRESS |
| 5 | Skirt | SKIRT |
| 6 | Pant | PANT |
| 7 | Short | SHORT |
| 8 | Jacket | JACKET |
| 9 | Sweatshirt | SWTSHRT |
| 10 | Jumpsuit | JUMP |

---

## 4. Naming Convention (Auto-generated ID)

Every AI output gets a unique code.

Format:
```
[SEASON_CODE]_[CATEGORY]_[STYLE#]_[VERSION]_[STAGE]_[OUTPUT#]
```

Example:
```
SS27_PANT_001_v1_SKTCH_R04
```

Breakdown:
- `SS27` = Season Code, entered by user when creating the season. Uppercase, alphanumeric, no spaces, max 12 chars.
- `PANT` = Category code (see category table above)
- `001` = Style number (increments for each new garment created in the season)
- `v1` = Version number (increments when user goes back and edits earlier stages)
- `SKTCH` = Stage abbreviation (see stage table above)
- `R04` = Output number within that stage batch (R01, R02, R03, R04)

Note: The Moodboard name (e.g. "Ash and Ember") does NOT appear in the code. Only the Season Code is used.

---

## 5. New Season Flow

When user clicks "+ New Season":
1. Modal opens asking for Season Code only (single field)
2. Placeholder text: "e.g. SS27, AW27, RESORT27"
3. Input is auto-uppercased and stripped of spaces
4. Max 12 characters, alphanumeric only
5. On Create, user lands on empty Season page (no moodboard, no garments yet)
6. The moodboard is created next, via the "Start Moodboard" flow

---

## 6. Start Moodboard Flow

When user clicks "Start Moodboard" on an empty season:
1. Modal opens with:
   - Moodboard Name field (e.g. "Ash and Ember")
   - Two upload options: Upload images OR Import from Pinterest
   - Recommended vs Avoid guidance images
2. User picks images (up to 12)
3. AI auto-generates palette (5 colors) and mood tags (e.g. Nocturne, Industrial, Coastal Fog, Deconstructed)
4. Moodboard is saved to the season

---

## 7. UI Display Rules for Season and Moodboard

**Seasons dashboard cards:**
- Main title: Season Code (e.g. "SS27")
- Subtitle: "Moodboard - Ash and Ember"
- Meta: garment count + created date
- Palette dots below

**Season detail page:**
- H1: Season Code (e.g. "SS27")
- Subtitle: Created date
- Moodboard section heading: "Moodboard - Ash and Ember"

**Breadcrumbs:**
- Season level: `Design Studio / Seasons / SS27`
- Garment level: `Design Studio / Seasons / SS27 / Wide-Leg Ash Trouser`

**Garment page:**
- "Inspired by" line references the Moodboard Name (not the season code), because the moodboard is what visually inspires the garment. Example: "Inspired by Ash and Ember". Clicking this link takes you back to the season.

---

## 8. Selection States (Traffic Light System)

Every AI-generated output can be in one of 4 states:

| State | Color | Meaning |
|-------|-------|---------|
| Unrated | No border, transparent | Default state after generation. User has not decided yet |
| Green | Green border and tint | Selected. Moves forward to next stage. Saved to global repo |
| Yellow | Yellow border and tint | Wishlist / considering. Saved but does not move forward |
| Grey | No border, no tint | Non-selected. Stays visible in the batch but not saved anywhere else |

Rules:
- All state transitions are allowed (Green to Yellow, Yellow to Grey, etc.)
- User can change states anytime
- Only Green outputs feed into the next stage as input options

---

## 9. Branching Logic (Critical)

The workflow is NOT strictly linear. It branches like a tree.

Example scenario:
- At Stage 1 (Sketch), user marks 3 sketches Green: Sketch A, Sketch B, Sketch C
- At Stage 2 (Fabric/Print), user picks Sketch A first, does the work, marks some fabrics Green
- User can then come back and pick Sketch B, do a fresh Stage 2 pass, mark Green outputs
- At Stage 3 (Render), all Green fabrics from both Sketch A and Sketch B sub-threads are available

Rule:
- Each Green output from a previous stage can spawn its own sub-thread of work in the next stage
- The last stage's Green outputs are the recommended inputs for the next stage
- Stages can be worked on non-linearly (jump from Stage 1 to Stage 4 if needed, though not recommended)

---

## 10. Versioning

When a user goes back and edits an earlier stage after moving forward, the system creates a new version.

- Original setup preserved as v1
- New setup becomes v2
- All downstream outputs stay attached to their original version
- User sees a version switcher on each stage to move between versions
- MVP: no version cap, no version deletion

---

## 11. Global Repositories (Season Level)

Every season has its own libraries. These are NOT shared across seasons in MVP.

- **Fabrics library**: fabrics used across all garments in this season
- **Prints library**: prints used across all garments in this season
- **Sketches library**: ONLY manually uploaded reference sketches (hand drawings, external inspiration). AI-generated sketches from Garment Stage 1 stay local to that garment.

Do NOT let fabrics or prints created inside Garment A be usable in Garment B for MVP. Season-level libraries are the only cross-garment sharing.

---

## 12. Stage 1: Sketch Workspace Inputs

- Category (read-only, inherited from garment)
- Gender (chips: Menswear, Womenswear, Unisex)
- Silhouette (chips: Fitted, Straight, Wide-leg, Relaxed, Oversized)
- Style descriptors (preset chips + free text prompt box, 200 char limit)
- Moodboard reference (pick up to 3 images from the season's moodboard)
- View (chips: Front only, Front and back)
- Output quantity (stepper, min 1, max 4, default 1)
- Manual upload option (sketch can also be uploaded directly instead of generated)

---

## 13. Stage 3: Render Workspace Inputs (For Later)

Detailed spec already worked out. Key points:

- Sketch selector (from Stage 1 Greens or manually uploaded)
- Gender (chips)
- 3 Fabric slots (each with fabric picker, prompt box with preset chips, scale slider 50 to 200 percent)
- 3 Trim slots (DISABLED for MVP, show "Coming in v2" label)
- Output quantity (1 to 4)
- Generate button

Trims are v2 scope. Do not implement.

---

## 14. UI Behavior Rules

- Auto-save on every state change (no manual save button)
- Small "Saved" indicator in top bar
- Manual upload is available as an input source on every stage (not a bypass, just an alternative to AI generation for that stage input)
- Older generation batches collapse by default to reduce clutter
- Empty state on any stage shows a message and CTA back to the correct prior stage or upload option
- Failed generations show a "Regenerate this" button on the failed tile only, other outputs preserved
- Every render tile has a Note field (250 char) accessible via note icon

---

## 15. MVP Scope Boundaries

Things we are NOT building in MVP (do not implement these):

- Multiple users or team collaboration
- Season duplication or moving garments between seasons
- Season archiving
- Cross-garment fabric or print sharing within a season
- Multiple moodboards per season (one moodboard per season only)
- Trim slots on Stage 3 Render (show as disabled v2 placeholder)
- Side-by-side comparison of outputs
- PDF lookbook export
- Regenerate variations of a single output
- Sketch quality validation before generation
- Cost or credit indicators
- Keyboard shortcuts (except Enter to generate)
- Mobile or tablet support (desktop only)
- Session finalization or locking
- Bulk export

---

## 16. What to Extract from the HTML Prototype

- Overall visual language (dark theme, gold accent, serif headings)
- Screen layouts and component placement
- Tab structure on Season page
- Stage card design on Garment page
- Left panel and right panel layout on stage workspace
- Filter chip styles, state dot styles, batch header design
- Modal design (New Season, Start Moodboard, New Garment)
- Navigation patterns (breadcrumbs, close button, stage arrows)
- How Season Code and Moodboard Name are displayed together (cards, headers, breadcrumbs)

---

## Questions

If anything is unclear, flag it and we will clarify.
