# Design Studio — Changes Needed Based on read_only Source of Truth

These two files are the absolute source of truth for the project:
- `read_only/design_studio_flow.html` — Full HTML/CSS/JS prototype with 5 views, 3 modals, all interactions
- `read_only/handover_for_harsh.md` — Detailed handover document covering naming logic, business rules, structural decisions, and behavior across stages

This document lists every difference between the source of truth and the current codebase, organized by severity. Every point is backed by specific references to the source files.

---

## CRITICAL — Wrong Data Model / Architecture

These changes fundamentally alter the data model, enums, and core architecture. Everything else flows from these. Getting these wrong means the entire pipeline won't work as designed.

### 1. Stage Count and Names Are Wrong

**Source of truth (handover_for_harsh.md, Section 2):**

There are exactly 7 stages. There is NO stage 0 for forecasting or research. Work starts at Sketch.

| # | Name | Abbreviation | What happens |
|---|------|--------------|--------------|
| 1 | Sketch | SKTCH | Generate flat sketch of the garment silhouette |
| 2 | Fabric/Print | FBRC | Pick or generate fabric and print options |
| 3 | Render | RNDR | Combine sketch + fabric/print into a colored flat render |
| 4 | Tech Pack | TECH | Construction spec, measurements, BOM |
| 5 | Pattern | PTRN | Technical flat pattern |
| 6 | 3D Visualization | 3D | 3D mockup of the garment |
| 7 | Photoshoot | SHOOT | Final photoshoot render on model |

The handover explicitly states: "Original stage names were 'Color and Trim', 'Fit Check', 'Mockup and Sample', 'Model Shoot'. These have been renamed to the industry-standard names above."

**Current codebase:**

8 stages defined in `backend/app/models/enums.py`:

```python
class NodeKey(str, Enum):
    RESEARCH = "research"        # DOES NOT EXIST IN SOURCE
    SKETCH = "sketch"            # ✓ exists but wrong abbreviation
    FABRIC = "fabric"            # Should be "Fabric/Print" / FBRC
    COLOR_TRIM = "colorTrim"     # RENAMED to "Render" / RNDR in source
    PATTERN = "pattern"          # ✓ exists, abbreviation should be PTRN
    MOCKUP = "mockup"            # RENAMED to "3D Visualization" / 3D in source
    FIT_CHECK = "fitCheck"       # DOES NOT EXIST IN SOURCE (removed)
    MODEL_SHOOT = "modelShoot"   # RENAMED to "Photoshoot" / SHOOT in source
```

**What's wrong:**
- `research` stage does not exist in source — explicitly removed ("There is NO stage 0")
- `colorTrim` was renamed to `Render` with abbreviation `RNDR`
- `fitCheck` does not exist in source — removed entirely
- `mockup` was renamed to `3D Visualization` with abbreviation `3D`
- `modelShoot` was renamed to `Photoshoot` with abbreviation `SHOOT`
- `Tech Pack` (TECH) is completely missing from current codebase
- `Render` (RNDR) is missing from current codebase (was replaced by `colorTrim`)
- `3D Visualization` (3D) is missing (was `mockup`)

**Impact:** The entire `NodeKey` enum, the `GarmentDetailPage` showing 8 nodes in a 4x2 grid, the `NodeCard` component, the `node_runs` collection, the `_stub_node_output()` function, the `NODE_DEFS` constant in `types.ts`, and the backend stub outputs are all based on the wrong stages. All of these need to change.

**Files affected:**
- `backend/app/models/enums.py` — NodeKey enum
- `backend/app/routes/node_runs.py` — _stub_node_output() references all NodeKey values
- `frontend/src/types.ts` — NODE_DEFS constant, NodeKey type
- `frontend/src/pages/GarmentDetailPage.tsx` — 4x2 grid of NodeCards
- `frontend/src/components/NodeCard.tsx` — status badge logic
- `root.md` — 8-node pipeline table

---

### 2. Garment Model Missing `category` Field

**Source of truth (handover_for_harsh.md, Section 3):**

Every garment has a category. There are exactly 10 categories, each with a display name and a code:

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

The category is selected in the "+ New Garment" modal via a grid of 10 clickable options. The HTML prototype shows this as a visual grid with "Pant" pre-selected as an example.

**Current codebase:**

The `Garment` model in `backend/app/models/garment.py` only has:
```python
class Garment(Document):
    season_id: Annotated[str, Indexed()]
    name: str
    node_summary: dict[NodeKey, NodeSummary] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)
```

There is no `category` field. The `GarmentCreate` schema only accepts `name`. The "+ New Garment" modal in `SeasonDetailPage.tsx` only has a name input field — no category selection grid.

**Impact:** The naming convention `SS27_PANT_001_v1_SKTCH_R04` requires the category code (`PANT`). Without a category field on Garment, the naming convention cannot be implemented. The new garment modal also needs a category selection grid.

**Files affected:**
- `backend/app/models/garment.py` — needs `category` field
- `backend/app/schemas/garment.py` — GarmentCreate needs category
- `backend/app/routes/garments.py` — create/update need category
- `frontend/src/types.ts` — Garment interface needs category
- `frontend/src/pages/SeasonDetailPage.tsx` — New Garment modal needs category grid
- `frontend/src/components/GarmentCard.tsx` — may need to display category

---

### 3. Season Model Missing `moodboard_name` Field

**Source of truth (handover_for_harsh.md, Section 1):**

Season and Moodboard are distinct concepts:

- **Season** is a fashion cycle identifier. Short, code-like. Examples: `SS27`, `AW27`, `W27`, `RESORT27`, `PF27`. Max 12 characters, alphanumeric, no spaces, auto-uppercased.
- **Moodboard** is a named creative direction that lives inside a season. Examples: "Ash and Ember", "Quiet Coastline". Descriptive, free text.
- One moodboard per season for MVP.

The HTML prototype shows this clearly:
- Season card title: "SS27" (season code)
- Season card subtitle: "Moodboard - Ash and Ember" (moodboard name)
- Season detail H1: "SS27"
- Season detail section heading: "Moodboard - Ash and Ember"

**Current codebase:**

The `Season` model has a single `name` field:
```python
class Season(Document):
    name: str
    moodboard: MoodboardData = Field(default_factory=MoodboardData)
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)
```

The `SeasonCreate` schema only accepts `name`. The new season modal only has a name input. There is no separate moodboard name.

**Impact:** The UI display rules, breadcrumbs, "Inspired by" references, and season card layout all depend on having two separate identifiers. The season code is used in the naming convention for outputs. The moodboard name is used for display and navigation.

**Files affected:**
- `backend/app/models/season.py` — needs `code` field (season code) separate from moodboard name
- `backend/app/schemas/season.py` — SeasonCreate needs code
- `backend/app/routes/seasons.py` — create needs code validation (uppercase, alphanumeric, max 12)
- `frontend/src/types.ts` — Season interface needs code + moodboard_name
- `frontend/src/pages/SeasonsListPage.tsx` — new season modal needs code field with validation
- `frontend/src/pages/SeasonDetailPage.tsx` — display rules depend on code vs name
- `frontend/src/components/SeasonCard.tsx` — card layout needs code as title, moodboard name as subtitle

---

### 4. Selection States Are Binary, Should Be 4-State Traffic Light System

**Source of truth (handover_for_harsh.md, Section 8):**

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

The HTML prototype shows this as colored dots on sketch tiles: green dot, yellow dot, grey dot, and unrated (no dot). Clicking cycles through states.

**Current codebase:**

The `NodeRun` model has:
```python
liked: bool = False
```

Binary true/false. The `toggle_like` endpoint sets `liked` to true or false. The `node_summary` on Garment tracks `liked_count` but not the 4-state breakdown.

**Impact:** The entire filtering system (All, Selected, Wishlist, Non-selected), the branching logic (only Green outputs feed next stage), and the UI state indicators all depend on 4 states. Binary liked/unliked cannot support the designed workflow.

**Files affected:**
- `backend/app/models/enums.py` — needs `OutputState` enum (unrated, selected, wishlist, rejected)
- `backend/app/models/node_run.py` — `liked: bool` → `state: OutputState`
- `backend/app/routes/node_runs.py` — toggle_like → set_state
- `backend/app/models/garment.py` — NodeSummary needs to track state counts
- `frontend/src/types.ts` — NodeRun interface, nodeStatusFromSummary
- `frontend/src/components/NodeCard.tsx` — status badge logic
- `frontend/src/pages/GarmentDetailPage.tsx` — filter bar states

---

### 5. No Versioning System

**Source of truth (handover_for_harsh.md, Section 10):**

When a user goes back and edits an earlier stage after moving forward, the system creates a new version:
- Original setup preserved as v1
- New setup becomes v2
- All downstream outputs stay attached to their original version
- User sees a version switcher on each stage to move between versions
- MVP: no version cap, no version deletion

The naming convention includes version: `SS27_PANT_001_v1_SKTCH_R04` — the `v1` is the version number.

**Current codebase:**

The `NodeRun` model has `iteration: int` which auto-increments per (garment_id, node_key). But this is not the same as versioning:
- `iteration` increments when a new run is created for the same node
- Versioning is about preserving the entire state when going back to edit earlier stages
- There's no version switcher UI
- There's no concept of "all downstream outputs stay attached to their original version"

**Impact:** Without versioning, going back to edit Stage 1 would destroy the context for Stages 2-7. The branching logic (Section 6 of handover) depends on versions to track which outputs came from which version of which stage.

**Files affected:**
- `backend/app/models/node_run.py` — needs `version: int` field
- `backend/app/models/garment.py` — may need version tracking per stage
- `frontend/src/components/NodeCard.tsx` — needs version switcher
- `frontend/src/pages/GarmentDetailPage.tsx` — version context

---

### 6. No Branching Logic

**Source of truth (handover_for_harsh.md, Section 9):**

The workflow is NOT strictly linear. It branches like a tree:

Example scenario:
1. At Stage 1 (Sketch), user marks 3 sketches Green: Sketch A, Sketch B, Sketch C
2. At Stage 2 (Fabric/Print), user picks Sketch A first, does the work, marks some fabrics Green
3. User can then come back and pick Sketch B, do a fresh Stage 2 pass, mark Green outputs
4. At Stage 3 (Render), all Green fabrics from both Sketch A and Sketch B sub-threads are available

Rules:
- Each Green output from a previous stage can spawn its own sub-thread of work in the next stage
- The last stage's Green outputs are the recommended inputs for the next stage
- Stages can be worked on non-linearly (jump from Stage 1 to Stage 4 if needed, though not recommended)

**Current codebase:**

The `NodeRun` model has `inputs: list[RunInputRef]` where `RunInputRef = {run_id, node_key}`. This provides provenance tracking but:
- There's no concept of sub-threads or branching
- There's no UI to select which Green outputs to use as inputs
- There's no mechanism to work on the same stage multiple times with different inputs
- The flow is implicitly linear (create run → get output → move to next node)

**Impact:** The core workflow design assumes branching. Without it, users can only have one linear path through the pipeline, which contradicts the designed creative workflow where designers explore multiple directions simultaneously.

**Files affected:**
- Backend model design (inputs field exists but branching logic doesn't)
- Frontend needs sub-thread selection UI
- Frontend needs input selection when starting a new run
- Filtering by parent thread

---

## HIGH — Missing Features That Affect UX

These features are explicitly described in the handover and shown in the HTML prototype. They significantly affect the user experience.

### 7. No Global Repositories (Season-Level Libraries)

**Source of truth (handover_for_harsh.md, Section 11):**

Every season has its own libraries. These are NOT shared across seasons in MVP:
- **Fabrics library**: fabrics used across all garments in this season
- **Prints library**: prints used across all garments in this season
- **Sketches library**: ONLY manually uploaded reference sketches (hand drawings, external inspiration). AI-generated sketches from Garment Stage 1 stay local to that garment.

Critical rule: Do NOT let fabrics or prints created inside Garment A be usable in Garment B for MVP. Season-level libraries are the only cross-garment sharing.

The HTML prototype shows season-level tabs: Overview, Fabrics, Prints, Sketches, Garments. Each tab has its own view.

**Current codebase:**

No season-level libraries exist. Everything is garment-local. The season detail page has no tabs — just a single scrollable page with moodboard and garments.

**Impact:** There's no way to share fabrics or prints across garments within a season. The designed workflow where fabrics created for one garment can be reused in another (through the season-level library) is not possible.

**Files affected:**
- `backend/app/models/season.py` — needs fabrics[], prints[], sketches[] collections
- `backend/app/routes/seasons.py` — CRUD for season-level libraries
- `frontend/src/pages/SeasonDetailPage.tsx` — needs tabbed interface
- New components for fabric/print/sketch library views

---

### 8. No Stage Workspace UI

**Source of truth (design_studio_flow.html, View 5: Sketch Stage):**

The stage workspace has a detailed left panel + right panel layout:

**Left panel (inputs):**
- Category badge (read-only, inherited from garment)
- Gender chips (Menswear, Womenswear, Unisex)
- Silhouette chips (Fitted, Straight, Wide-leg, Relaxed, Oversized)
- Style descriptors (preset chips + free text prompt box, 200 char limit)
- Moodboard reference (pick up to 3 images from the season's moodboard)
- View chips (Front only, Front and back)
- Output quantity (stepper, min 1, max 4, default 1)
- Manual upload option
- Generate button

**Right panel (outputs):**
- Filter bar (All, Selected, Wishlist, Non-selected)
- Batch header
- Output grid (4 tiles with state dots)
- State dot buttons (cycle through unrated/green/yellow/grey)
- Proceed bar ("1 selected sketch ready to move forward" + "Proceed to Fabric/Print" button)

**Current codebase:**

The `GarmentDetailPage` shows a 4x2 grid of `NodeCard` components. Clicking a node opens a modal that says "This node's tool isn't wired up yet." No left panel, no right panel, no input controls, no output grid.

**Impact:** The entire stage interaction model is missing. Users can't configure inputs, generate outputs, or manage results.

**Files affected:**
- Entire new page/component for stage workspace
- Left panel component with all input controls
- Right panel component with output grid and state management
- Filter bar component
- Batch header component
- Proceed bar component

---

### 9. No Output Naming Convention

**Source of truth (handover_for_harsh.md, Section 4):**

Every AI output gets a unique code:

Format: `[SEASON_CODE]_[CATEGORY]_[STYLE#]_[VERSION]_[STAGE]_[OUTPUT#]`

Example: `SS27_PANT_001_v1_SKTCH_R04`

Breakdown:
- `SS27` = Season Code, entered by user when creating the season. Uppercase, alphanumeric, no spaces, max 12 chars.
- `PANT` = Category code (see category table)
- `001` = Style number (increments for each new garment created in the season)
- `v1` = Version number (increments when user goes back and edits earlier stages)
- `SKTCH` = Stage abbreviation (see stage table)
- `R04` = Output number within that stage batch (R01, R02, R03, R04)

Note: The Moodboard name does NOT appear in the code. Only the Season Code is used.

**Current codebase:**

No naming system exists. `NodeRun` has `iteration: int` which auto-increments, but there's no formatted code. The HTML prototype shows this code displayed on the stage topbar: `SS27_PANT_001_v1_SKTCH`.

**Impact:** Without the naming convention, outputs can't be referenced by name. The stage topbar in the prototype displays this code prominently. Filters and sorting may rely on it.

**Files affected:**
- `backend/app/models/node_run.py` — needs generated `code` field
- `backend/app/routes/node_runs.py` — generate code on creation
- `frontend/src/types.ts` — NodeRun interface
- Frontend stage workspace topbar — display the code

---

### 10. No Note Field on Outputs

**Source of truth (handover_for_harsh.md, Section 14):**

"Every render tile has a Note field (250 char) accessible via note icon."

The HTML prototype shows a small note icon on each sketch tile. Clicking it presumably opens a text input.

**Current codebase:**

The `NodeRun` model has `output.text` and `output.extra` but no dedicated note field. There's no note icon or note UI on any output tile.

**Impact:** Can't annotate AI outputs with designer notes. This is a minor but explicitly specified feature.

**Files affected:**
- `backend/app/models/node_run.py` — output needs `note: str | None` field
- Frontend output tiles — note icon + text input

---

### 11. No Auto-Save

**Source of truth (handover_for_harsh.md, Section 14):**

"Auto-save on every state change (no manual save button). Small 'Saved' indicator in top bar."

**Current codebase:**

State changes require explicit save actions (e.g., clicking "Save Moodboard", clicking "Create Garment"). No auto-save mechanism.

**Impact:** UX feels less fluid. Users might lose work if they navigate away without saving.

**Files affected:**
- Frontend state management — debounce + auto-save on changes
- Top bar — "Saved" indicator

---

### 12. No Output Quantity Control

**Source of truth (handover_for_harsh.md, Section 12 and design_studio_flow.html):**

Stage 1 Sketch workspace has output quantity control:
- Stepper with min 1, max 4, default 1
- User can choose how many sketch variants to generate

The HTML prototype shows this as a stepper with minus/plus buttons and a number display.

**Current codebase:**

No output quantity control. The stub always returns a fixed number of placeholder outputs.

**Impact:** Can't control how many variants AI generates per batch.

**Files affected:**
- Stage workspace left panel — quantity stepper
- Backend node run creation — quantity parameter

---

### 13. Season Page Missing Tabs

**Source of truth (design_studio_flow.html, View 3: Season Detail):**

The season detail page has 5 tabs:
1. Overview (moodboard + garments)
2. Fabrics (season-level fabric library)
3. Prints (season-level print library)
4. Sketches (season-level sketch library — manual uploads only)
5. Garments (same as overview garment list, or dedicated view)

The HTML prototype shows tab buttons with active/inactive states.

**Current codebase:**

Single scrollable page with moodboard section and garments section. No tabs.

**Impact:** Season-level libraries have no UI home. The page layout doesn't match the designed structure.

**Files affected:**
- `frontend/src/pages/SeasonDetailPage.tsx` — needs tabbed interface
- New tab content components for Fabrics, Prints, Sketches

---

### 14. Garment Page Missing "Inspired by" Reference

**Source of truth (handover_for_harsh.md, Section 7):**

"Garment page: 'Inspired by' line references the Moodboard Name (not the season code), because the moodboard is what visually inspires the garment. Example: 'Inspired by Ash and Ember'. Clicking this link takes you back to the season."

**Current codebase:**

The `GarmentDetailPage` shows the garment name, season name (via breadcrumb), and a 4x2 grid of nodes. No "Inspired by" reference.

**Impact:** Can't navigate back to the inspiration source. The connection between garment and moodboard is not visually established.

**Files affected:**
- `frontend/src/pages/GarmentDetailPage.tsx` — needs "Inspired by [moodboard name]" line

---

## MEDIUM — UI/UX Mismatches

These are specific UI behaviors that don't match the designed prototype. They affect the visual and interaction fidelity.

### 15. New Season Modal Wrong Fields

**Source of truth (handover_for_harsh.md, Section 5 and design_studio_flow.html):**

New Season modal has a single field:
- Season Code input
- Placeholder text: "e.g. SS27, AW27, RESORT27"
- Input is auto-uppercased and stripped of spaces
- Max 12 characters, alphanumeric only

**Current codebase:**

New Season modal in `SeasonsListPage.tsx` has:
- Name input (free text, no validation)
- No auto-uppercasing
- No character limit
- No alphanumeric validation

**Impact:** Season codes won't follow the convention. Users could enter "My Summer Collection" instead of "SS27".

**Files affected:**
- `frontend/src/pages/SeasonsListPage.tsx` — new season modal needs code field with validation
- `backend/app/routes/seasons.py` — validate code format on creation

---

### 16. Start Moodboard Modal Missing Name Field

**Source of truth (handover_for_harsh.md, Section 6 and design_studio_flow.html):**

Start Moodboard modal has:
- Moodboard Name field (e.g., "Ash and Ember")
- Two upload options: Upload images OR Import from Pinterest
- Recommended vs Avoid guidance images
- 12/12 slots info

**Current codebase:**

StartMoodboardModal has:
- Upload zone (drag-drop + Pinterest import)
- Recommended vs Avoid guidance
- No moodboard name field

**Impact:** Moodboard has no descriptive name. The subtitle "Moodboard - Ash and Ember" can't be displayed.

**Files affected:**
- `frontend/src/components/StartMoodboardModal.tsx` — needs name field
- `backend/app/models/season.py` — moodboard needs name field

---

### 17. Season Card Display Wrong

**Source of truth (design_studio_flow.html, View 2: Seasons Dashboard):**

Season card layout:
- Main title: Season Code (e.g., "SS27")
- Subtitle: "Moodboard - Ash and Ember"
- Meta: garment count + created date
- Palette dots below

**Current codebase:**

SeasonCard shows:
- Title: season name
- Subtitle: garment count + date
- Palette dots

**Impact:** Cards don't match designed layout. Season code and moodboard name are conflated.

**Files affected:**
- `frontend/src/components/SeasonCard.tsx` — layout needs code as title, moodboard name as subtitle

---

### 18. Breadcrumbs Use Wrong Identifier

**Source of truth (handover_for_harsh.md, Section 7):**

Breadcrumbs:
- Season level: `Design Studio / Seasons / SS27`
- Garment level: `Design Studio / Seasons / SS27 / Wide-Leg Ash Trouser`

**Current codebase:**

Breadcrumbs use season name:
- `Design Studio / Seasons / [season name]`
- `Design Studio / Seasons / [season name] / [garment name]`

**Impact:** Navigation doesn't match spec. Season code should be the breadcrumb identifier.

**Files affected:**
- `frontend/src/pages/SeasonDetailPage.tsx` — breadcrumbs
- `frontend/src/pages/GarmentDetailPage.tsx` — breadcrumbs
- `frontend/src/components/NavBar.tsx` — breadcrumb rendering

---

### 19. No Manual Upload Option Per Stage

**Source of truth (handover_for_harsh.md, Section 12):**

"Manual upload option (sketch can also be uploaded directly instead of generated)."

The handover states this is available on every stage as an alternative to AI generation.

**Current codebase:**

No manual upload on stages. The only upload is for moodboard images.

**Impact:** Can't use hand-drawn sketches or external references as stage inputs.

**Files affected:**
- Stage workspace left panel — manual upload option per stage
- Backend — accept uploaded files as stage inputs

---

### 20. No "Regenerate This" on Failed Outputs

**Source of truth (handover_for_harsh.md, Section 14):**

"Failed generations show a 'Regenerate this' button on the failed tile only, other outputs preserved."

**Current codebase:**

No regeneration mechanism. If a node run fails, the user would need to create a new run (which would be a new iteration, not a retry of the same output).

**Impact:** Can't retry a failed generation without creating a new iteration. Other successful outputs in the same batch are not preserved.

**Files affected:**
- Frontend output tiles — "Regenerate this" button on failed tiles
- Backend — retry endpoint that re-runs the same configuration

---

### 21. No Batch Collapse for Older Generations

**Source of truth (handover_for_harsh.md, Section 14):**

"Older generation batches collapse by default to reduce clutter."

**Current codebase:**

No batch concept. All runs for a node are listed equally.

**Impact:** UI could get cluttered with many generation runs.

**Files affected:**
- Frontend node run display — batch grouping + collapse

---

## LOW — Cosmetic / Minor

These are visual differences that don't affect functionality but reduce fidelity to the designed prototype.

### 22. CSS Color Values Slightly Off

**Source of truth (design_studio_flow.html, :root CSS variables):**

```css
--bg-page: #0A0908;
--gold: #B8964A;
--gold-dim: #8A6F35;
```

**Current codebase (frontend/src/index.css):**

```css
--ink: #0a0a0b;
--brass: #c9a24d;
--brass-dim: #a88940;
```

**Impact:** Near-identical visually. The page background is `#0A0908` (warmer black) vs `#0a0a0b` (cooler black). Gold is `#B8964A` (muted) vs `#c9a24d` (brighter). Most users won't notice.

---

### 23. Missing JetBrains Mono Font

**Source of truth (design_studio_flow.html, line 6):**

```html
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400&display=swap" rel="stylesheet">
```

Three fonts: Cormorant Garamond, Inter, JetBrains Mono.

**Current codebase:**

Two fonts: Cormorant Garamond + Inter. No JetBrains Mono.

**Impact:** No monospace font for technical codes like `SS27_PANT_001_v1_SKTCH_R04`. Minor but noticeable if naming convention is implemented.

---

### 24. Tabler Icons Not Used

**Source of truth (design_studio_flow.html, line 7):**

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.11.0/dist/tabler-icons.min.css">
```

Uses Tabler Icons webfont for all UI icons.

**Current codebase:**

SVG icons inline (e.g., upload icon, pin icon in StartMoodboardModal). No icon library.

**Impact:** Inconsistent icon style. SVG icons are fine but don't match the designed icon set.

---

### 25. Season Tabs in HTML Prototype Have Different Content

The HTML prototype's Overview tab shows:
- Moodboard section with 12 gradient tiles
- Palette dots
- Mood tags (Nocturne, Industrial, Coastal Fog, Deconstructed)
- Garments grid with 3 garment cards

Other tabs (Fabrics, Prints, Sketches) are placeholder text in the prototype. But their existence is defined.

**Current codebase:**

Single scrollable page. No tab structure at all.

---

## Already OK — No Changes Needed

These aspects of the current codebase match the source of truth:

### 26. Moodboard Image Count Matches
- **Truth:** 12 images max
- **Current:** 12 images max
- **Status:** ✓ No change needed

### 27. AI Palette (5 colors) Matches
- **Truth:** 5 hex colors from AI
- **Current:** 5 hex colors from Gemini
- **Status:** ✓ No change needed

### 28. AI Mood Tags Match
- **Truth:** AI-generated mood tags/keywords
- **Current:** AI-generated keywords from Gemini
- **Status:** ✓ No change needed

---

## Summary Table

| Priority | # | Items |
|----------|---|-------|
| CRITICAL | 6 | Stages (7 not 8), Garment category field, Season code + moodboard name, 4-state selection, Versioning, Branching logic |
| HIGH | 7 | Global repos, Stage workspace UI, Output naming convention, Note field, Auto-save, Output quantity, Season tabs, "Inspired by" reference |
| MEDIUM | 7 | Season modal validation, Moodboard name field, Card display, Breadcrumbs, Manual upload per stage, Regenerate failed, Batch collapse |
| LOW | 3 | CSS colors, JetBrains Mono font, Tabler Icons |
| Already OK | 3 | Image count (12), Palette (5 colors), Mood keywords |

---

## Recommended Approach

The 6 CRITICAL items change the data model and core architecture. They should be tackled first, in this order:

1. **Stages + Categories** — Fix the NodeKey enum and add Garment category. This is the foundation.
2. **Season Code + Moodboard Name** — Separate the two concepts in the Season model.
3. **4-State Selection** — Replace binary liked with traffic light system.
4. **Versioning** — Add version tracking to NodeRun.
5. **Branching Logic** — Depends on versioning and 4-state selection.

Items 7-14 (HIGH) can be tackled after the critical items are stable.

Items 15-21 (MEDIUM) are polish and can be done as time permits.

Items 22-24 (LOW) are cosmetic and lowest priority.
