# Design Studio — AI Fashion Design Tool

A hackathon project: an AI-assisted studio where a designer builds a **Season**
(a 12-image moodboard) and, inside it, creates one or more **Garments** — each
garment moving through the real-world fashion design pipeline via **8 nodes**,
from research to final model shoot, with every generation drawing visual/
stylistic inspiration from the season's moodboard.

Built solo, target: **24–48 hour hackathon build.**

---

## 1. Core concept

```
Season (moodboard)
 ├─ 12 mood images
 ├─ AI-extracted color palette + mood keywords/themes
 └─ Garments[]
     └─ Garment
         ├─ name
         └─ 8 nodes (usable independently OR in sequence)
             1. Research
             2. Sketch / Concept
             3. Fabric
             4. Color / Trim
             5. Pattern
             6. Mockup / Sample
             7. Fit Check
             8. Model Shoot
```

- **Season** = a moodboard. The designer imports 12 images that set the mood/
  direction for a collection. The app runs AI analysis on these to extract a
  **color palette** and **mood keywords/theme description**, which become the
  shared creative context for everything built inside that season.
- **Garment** = one design living inside a season. Each garment has its own
  workspace containing the 8 nodes below.
- **Node** = one step of the industry garment-development pipeline. Nodes can
  be run **independently** (jump straight to "Model Shoot" for a quick visual)
  or **in sequence** (each node's output feeds the next, for a full pipeline).
  Every node's generation is grounded in the season's moodboard (palette +
  mood + reference images), not just a blank prompt.

---

## 2. The 8 nodes (draft — confirm/refine before building)

Each node has a **distinct interaction type**, not a single generic
"prompt → image" box. Current draft:

| # | Node | Interaction type (draft) | Output |
|---|------|---------------------------|--------|
| 1 | **Research** | AI reads the moodboard + optional designer notes, produces a short inspiration/trend brief (text + tagged references) | Research brief |
| 2 | **Sketch / Concept** | AI generates rough concept sketches/line drawings from the brief + moodboard mood | Concept sketch image(s) |
| 3 | **Fabric** | AI suggests/generates fabric textures & materials matching the season's palette; designer can pick from options | Fabric swatch image(s) + label |
| 4 | **Color / Trim** | Color palette (pulled from moodboard) + trim details; designer picks/adjusts, AI can suggest combos | Palette + trim selections |
| 5 | **Pattern** | AI generates a technical flat/pattern schematic (front + back) based on the sketch | Pattern flat image(s) |
| 6 | **Mockup / Sample** | AI combines sketch + fabric + pattern into a rendered garment mockup | Mockup render |
| 7 | **Fit Check** | Designer/AI reviews the mockup for fit notes/adjustments (annotations or AI-generated fit commentary) | Fit notes / revised mockup |
| 8 | **Model Shoot** | AI generates a final photoshoot-style image: garment on a model, styled to match the season's mood | Final shoot image(s) |

> **Hackathon scope decision:** build all 8 nodes at a basic, uniform level of
> polish rather than fully polishing a few and stubbing the rest. No node
> should be skipped, but none needs to be production-quality.

---

## 3. Frontend design direction

**Aesthetic: Dark studio / atelier.** Dark backgrounds, moody and
high-contrast — should feel like stepping into a designer's private studio at
night, not a generic SaaS dashboard.

**Navigation structure:**

```
Season list  →  Season detail (moodboard + garments)  →  Garment detail (8 nodes)
```

- **Season list (home):** all seasons shown as cards (cover derived from
  moodboard images), "+ New Season" to start one by importing 12 images.
- **Season detail:** the 12-image moodboard displayed prominently (gallery/
  grid), extracted palette + mood keywords shown alongside, and the list of
  garments created inside this season (+ "New Garment").
- **Garment detail:** dashboard of 8 cards, one per node. Each card can be
  opened independently; nodes can also be chained in sequence. The season's
  moodboard/palette context is visible or referenced throughout so the
  designer always sees what's driving the AI's generations.

**Status:** exact layout, components, and visual details (typography, spacing,
card design, etc.) are still to be specified — this section will be expanded
once wireframes/mocks are agreed on.

---

## 4. Tech stack

- **Frontend:** React + Vite + TypeScript + Tailwind CSS
  - Chosen for fast dev/hot-reload, easy debugging (browser devtools), and
    moldability as scope changes during the hackathon.
- **Backend:** Python
  - AI orchestration (moodboard analysis, per-node prompt construction, calls
    to image generation).
- **Image generation:** Google **Gemini** image generation models.
- **AI features by area:**
  - Moodboard → AI-extracted palette + mood keywords/theme.
  - Moodboard → AI-generated garment concepts (Research, Sketch nodes).
  - Node-level image generation/editing (Fabric, Pattern, Mockup, Model Shoot
    nodes), all conditioned on the season's moodboard context.

---

## 5. Rough data model (draft)

```jsonc
Season {
  id, name,
  images: [12 image refs],
  palette: [hex colors],        // AI-extracted
  mood_keywords: [strings],     // AI-extracted
  garments: [Garment.id]
}

Garment {
  id, season_id, name,
  nodes: {
    research:   { brief, references },
    sketch:     { images },
    fabric:     { images, labels },
    color_trim: { palette, trims },
    pattern:    { images },
    mockup:     { image },
    fit_check:  { notes, revised_image },
    model_shoot:{ images }
  }
}
```

This will evolve as the frontend/backend contract firms up.

---

## 6. Open questions / next steps

- [ ] Confirm exact node names/interactions in the table above (especially
      Fabric, Fit Check — these are the least defined).
- [ ] Design wireframes for: Season list, Season detail, Garment detail (8
      node cards), and one node's expanded view.
- [ ] Decide whether nodes, once "run", are re-runnable/versioned or
      overwrite in place.
- [ ] Define the season → node context payload sent to Gemini for each node
      type (what exactly gets passed: raw images? extracted palette/keywords
      only? prior node outputs?).
- [ ] Backend framework choice within Python (e.g. FastAPI) and storage
      (local files/SQLite vs a proper DB) — not yet decided, fine for a
      24–48h hackathon to keep this minimal.
