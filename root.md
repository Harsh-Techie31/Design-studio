# Design Studio — Project Analysis - v2

An AI-assisted fashion design tool where designers build **Seasons** (12-image moodboards with AI-extracted style profiles) and create **Garments** inside them, each moving through a 7-stage fashion pipeline from sketch to photoshoot.

---

## Quick Start

### Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env               # fill in real credentials
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev                        # http://localhost:5173
```

Vite proxies `/api/*` → `http://localhost:8000`.

### Seed Database (optional)
```bash
cd backend
python scripts/seed_db.py
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript 6, Vite 8, Tailwind CSS v4 |
| Backend | Python 3.11+, FastAPI, Uvicorn |
| Database | MongoDB Atlas (Motor 3.6 + Beanie 1.28 ODM) |
| Image Storage | ImageKit CDN (`imagekitio` SDK) |
| AI | Google Gemini (`gemini-2.5-flash` text + `gemini-2.5-flash-image` generation) |
| Image Processing | Pillow (PIL) — procedural fallback engines |
| Linting | oxlint (Rust-based) |
| Deployment | Railway (Procfile + railway.toml) |

---

## Project Structure

```
designStudio/
├── frontend/                          # React SPA
│   ├── src/
│   │   ├── main.tsx                   # ReactDOM entry
│   │   ├── App.tsx                    # Router + StudioProvider wrapper (5 routes)
│   │   ├── index.css                  # Tailwind v4 @theme tokens (dark palette)
│   │   ├── types.ts                   # All TS interfaces + utility fns (216 lines)
│   │   ├── api/
│   │   │   ├── client.ts             # Base fetch wrapper (/api prefix, VITE_API_BASE_URL)
│   │   │   ├── seasons.ts            # Seasons CRUD + analyzeMoodboard
│   │   │   ├── garments.ts           # Garments CRUD
│   │   │   ├── nodeRuns.ts           # Node runs CRUD + like toggle
│   │   │   ├── uploads.ts            # Multipart image upload/delete
│   │   │   └── designImages.ts       # Image library CRUD + generation endpoints (400 lines)
│   │   ├── components/
│   │   │   ├── NavBar.tsx            # Sticky header with breadcrumbs
│   │   │   ├── Modal.tsx             # Generic overlay dialog
│   │   │   ├── SeasonCard.tsx        # Season card with palette dots
│   │   │   ├── GarmentCard.tsx       # Garment card with progress bar
│   │   │   ├── NodeCard.tsx          # Pipeline node button (3 states)
│   │   │   ├── PaletteSwatches.tsx   # Circular color swatch row
│   │   │   ├── KeywordChips.tsx      # Uppercase pill labels
│   │   │   ├── MoodboardTile.tsx     # Smart img/placeholder wrapper
│   │   │   ├── PlaceholderTile.tsx   # Seed-based procedural gradient art
│   │   │   ├── StartMoodboardModal.tsx  # Upload flow with async save + name input
│   │   │   ├── ImagePickerModal.tsx  # Library + upload tabs for picking images
│   │   │   ├── StageOutputPanel.tsx  # Output grid with filtering, lightbox, export (511 lines)
│   │   │   ├── StageProgressBar.tsx  # Horizontal progress bar with stage navigation
│   │   │   └── stages/
│   │   │       ├── SketchTool.tsx       # Stage 1: Sketch generation (414 lines)
│   │   │       ├── PrintTool.tsx        # Stage 2: Fabric/print pattern (505 lines)
│   │   │       ├── RenderTool.tsx       # Stage 3: First render (517 lines)
│   │   │       ├── TechPackTool.tsx     # Stage 4: Tech pack (553 lines)
│   │   │       ├── TechPackOutputPanel.tsx  # Custom output layout for tech packs
│   │   │       ├── PatternTool.tsx      # Stage 5: Pattern (334 lines)
│   │   │       ├── PatternOutputPanel.tsx   # Custom output layout for patterns
│   │   │       ├── VisualizationTool.tsx    # Stage 6: 3D visualization (272 lines)
│   │   │       └── PhotoshootTool.tsx       # Stage 7: Photoshoot (342 lines)
│   │   ├── pages/
│   │   │   ├── LandingPage.tsx       # Marketing hero page
│   │   │   ├── SeasonsListPage.tsx   # Season grid + create modal
│   │   │   ├── SeasonDetailPage.tsx  # Moodboard + analysis + 8-tab image browser + garments
│   │   │   ├── GarmentDetailPage.tsx # 4×2 grid of 8 NodeCards
│   │   │   └── StageWorkspacePage.tsx # Full-screen tool + output panel (402 lines)
│   │   ├── state/
│   │   │   └── StudioContext.tsx      # Global state (real API calls)
│   │   ├── data/
│   │   │   ├── mockData.ts           # Legacy mock data + NODE_DEFS (actively imported)
│   │   │   ├── techpackConfig.ts     # Construction options per category (135 lines)
│   │   │   └── patternConfig.ts      # Measurement fields per category (114 lines)
│   │   └── utils/
│   │       └── sampleImages.ts       # Sample moodboard image URLs
│   ├── public/
│   │   ├── favicon.svg
│   │   └── icons.svg
│   ├── vite.config.ts                # Proxy /api → localhost:8000
│   ├── package.json
│   └── tsconfig*.json
├── backend/
│   ├── app/
│   │   ├── main.py                   # FastAPI entry, CORS, 12 routers, lifespan DB init
│   │   ├── config.py                 # pydantic-settings (reads .env, vertex_base_url)
│   │   ├── db.py                     # Motor + Beanie init (4 document models)
│   │   ├── models/
│   │   │   ├── __init__.py           # Exports all models + DOCUMENT_MODELS list
│   │   │   ├── enums.py              # NodeKey, GarmentCategory, RunStatus, MoodboardStatus, ImageType, ImageSource
│   │   │   ├── season.py             # Season + MoodboardData + MoodboardAnalysis
│   │   │   ├── garment.py            # Garment + NodeSummary
│   │   │   ├── node_run.py           # NodeRun (append-only versioning)
│   │   │   └── design_image.py       # DesignImage — centralized image library (95 lines)
│   │   ├── routes/
│   │   │   ├── seasons.py            # CRUD + cascade delete
│   │   │   ├── garments.py           # CRUD + _update_node_summary()
│   │   │   ├── moodboard.py          # Upload/delete images + analyze endpoint
│   │   │   ├── node_runs.py          # CRUD + like toggle + stub outputs
│   │   │   ├── design_images.py      # Image library CRUD + query + upload + aggregation (303 lines)
│   │   │   ├── sketch.py             # Stage 1: AI sketch generation + PIL fallback (824 lines)
│   │   │   ├── print.py              # Stage 2: Fabric print generation (334 lines)
│   │   │   ├── render.py             # Stage 3: Two-step AI render (497 lines)
│   │   │   ├── techpack.py           # Stage 4: PIL tech pack assembly (476 lines)
│   │   │   ├── pattern.py            # Stage 5: Hybrid AI + PIL pattern (736 lines)
│   │   │   ├── visualization.py      # Stage 6: 3D visualization on model (363 lines)
│   │   │   └── photoshoot.py         # Stage 7: Final photoshoot render (419 lines)
│   │   ├── schemas/
│   │   │   ├── season.py             # SeasonCreate/Update/Response
│   │   │   ├── garment.py            # GarmentCreate/Update/Response
│   │   │   ├── node_run.py           # NodeRunCreate/Response/LikeToggle
│   │   │   └── moodboard.py          # MoodboardImageResponse
│   │   ├── services/
│   │   │   ├── imagekit.py           # ImageKit upload/delete (sync SDK)
│   │   │   ├── gemini.py             # Gemini Vision API (base64 inlineData, max 5 images)
│   │   │   ├── avatar_reference.py   # Model personas + framing logic for vis/photoshoot
│   │   │   └── generation_helpers.py # fetch_image_bytes + placeholder builder
│   │   └── data/
│   │       └── techpack_config.py    # Construction options, measurements, BOM per category (171 lines)
│   ├── scripts/
│   │   ├── seed_db.py                # Seeds 2 seasons + 4 garments
│   │   └── verify_connections.py     # Tests MongoDB + ImageKit connections
│   ├── requirements.txt              # Pinned deps (beanie 1.28, motor 3.6, Pillow)
│   ├── SCHEMA.md                     # Database schema documentation
│   ├── .env                          # Live credentials (not committed)
│   ├── .env.example                  # Template
│   ├── Procfile                      # Railway deployment
│   ├── railway.toml                  # Railway config
│   └── .python-version               # Python version pin
├── read_only/                        # Source of truth (gitignored)
│   ├── design_studio_flow.html       # HTML/CSS/JS prototype (1837 lines)
│   ├── handover_for_harsh.md         # Detailed handover spec (279 lines)
│   ├── sketch/                       # Standalone Stage 1 prototype
│   ├── print/                        # Standalone Stage 2 prototype
│   ├── Stage 3 - Render/            # Standalone Stage 3 prototype
│   ├── tech-pack/                    # Standalone Stage 4 prototype + spec
│   └── pattern/                      # Standalone Stage 5 prototype + spec
├── tool1/                            # Duplicate of Stage 3 (gitignored)
├── todo.md                           # Gap analysis: 25 items vs designed spec
├── README.md                         # Original project vision (partially outdated)
├── root.md                           # This file
└── .gitignore                        # Ignores tool1/ and read_only/
```

---

## Frontend Details

### Routing (5 pages)

| Path | Page | Description |
|------|------|-------------|
| `/` | LandingPage | Marketing hero, feature cards, CTA |
| `/seasons` | SeasonsListPage | Grid of SeasonCards, "+ New Season" button |
| `/seasons/:seasonId` | SeasonDetailPage | Moodboard grid, analysis status, 8-tab image browser, garments list |
| `/seasons/:seasonId/garments/:garmentId` | GarmentDetailPage | 4×2 grid of 8 NodeCards |
| `/seasons/:seasonId/garments/:garmentId/stage/:nodeKey` | StageWorkspacePage | Full-screen tool panel + output panel with filtering/lightbox/export |

### Components (13 core + 9 stage tools)

**Core Components:**

| Component | Purpose |
|-----------|---------|
| `NavBar` | Sticky header with breadcrumbs + optional right-side action slot |
| `Modal` | Generic overlay dialog — backdrop blur, close-on-outside-click, configurable max-width |
| `SeasonCard` | Card link to season: 2×2 placeholder grid, name, garment count, palette dots |
| `GarmentCard` | Card link to garment: placeholder tile, name, progress bar (done/8 nodes) |
| `NodeCard` | Pipeline node button: number label, status badge (Not started/In progress/Done), hint |
| `PaletteSwatches` | Row of circular color swatches with tooltips, `sm`/`md` sizes |
| `KeywordChips` | Flex-wrap row of uppercase pill-shaped keyword labels |
| `MoodboardTile` | Smart wrapper: `<img>` for real URLs, `PlaceholderTile` for `mood-placeholder:*` URIs |
| `PlaceholderTile` | Seed-based procedural gradient art (radial + linear gradient + hatched overlay) |
| `StartMoodboardModal` | Full upload flow: drag-drop zone, moodboard name input, async save with spinner |
| `ImagePickerModal` | Pick images from library or upload new ones (2 tabs) |
| `StageOutputPanel` | Output grid with filtering (all/liked/unliked/starred), lightbox viewer, download, proceed-to-next-stage bar, export for final stage (511 lines) |
| `StageProgressBar` | Horizontal progress bar with clickable stage navigation |

**Stage Tool Components (`components/stages/`):**

| Stage | Component | Lines | Features |
|-------|-----------|-------|----------|
| 1 | `SketchTool` | 414 | Gender, silhouette, descriptors, prompt, moodboard refs, mood influence, view, multi-output |
| 2 | `PrintTool` | 505 | Canvas preview, repeat controls (block/half-drop/brick/mirror), scale, rotation, 10 fabric types, 1K/2K export |
| 3 | `RenderTool` | 517 | Sketch picker, gender, up to 3 fabric slots with placement chips, scale sliders, per-fabric prompts |
| 4 | `TechPackTool` | 553 | Construction options per category, stitch/seam selection, BOM fields, measurements grid, construction notes |
| 4 | `TechPackOutputPanel` | 140 | Custom thumbnail strip + large preview layout |
| 5 | `PatternTool` | 334 | Body measurements grid, construction details, pattern settings (fabric, seam/hem, grain, ease, markings) |
| 5 | `PatternOutputPanel` | 111 | Custom thumbnail strip + large preview layout |
| 6 | `VisualizationTool` | 272 | Model avatar selection, background/lighting environment options |
| 7 | `PhotoshootTool` | 342 | Moodboard influence toggle, shot type, location, time of day, mood, pose |

### State Management — `StudioContext.tsx`

React Context with real API calls. No external state library.

**State:** `seasons: Season[]`, `garments: Garment[]`, `loading: boolean`, `error: string | null`

**Exposed methods:**

| Method | Description |
|--------|-------------|
| `getSeason(id)` | Find season by ID from local state |
| `getGarmentsForSeason(seasonId)` | Filter garments by season_id |
| `getGarment(id)` | Find garment by ID |
| `createSeason(code)` | POST to API, prepend to state |
| `createGarment(seasonId, name, category)` | POST to API, prepend to state |
| `setMoodboardImages(seasonId, images, name?)` | Converts data-URLs to Files, uploads via multipart POST, merges server response |
| `analyzeMoodboard(seasonId)` | POST to analyze endpoint, updates moodboard data (with error sanitization) |
| `refreshSeasons()` | Re-fetch all seasons |

**Initialization:** On mount, fetches all seasons, then iterates to fetch all garments.

### API Layer (`src/api/`)

| Module | Functions |
|--------|-----------|
| `client.ts` | `request<T>(path, options)` — generic fetcher with configurable base URL, `ApiError` class, 204 handling |
| `seasons.ts` | `listSeasons`, `getSeason`, `createSeason`, `updateSeason`, `deleteSeason`, `analyzeMoodboard` |
| `garments.ts` | `listGarments`, `getGarment`, `createGarment`, `updateGarment`, `deleteGarment` |
| `nodeRuns.ts` | `listRuns`, `createRun`, `toggleLike` |
| `uploads.ts` | `uploadMoodboardImages` (multipart), `deleteMoodboardImage` |
| `designImages.ts` | `listImagesForSeason`, `listImagesForGarment`, `listImagesForRun`, `getImage`, `toggleLike`, `toggleStar`, `updateNote`, `deleteImage`, `uploadImageToLibrary`, `getImageCountsForSeason`, `generateSketch`, `generateTechPack`, `generatePattern`, `generateVisualization`, `generatePhotoshoot` |

### Design System

- **Theme:** Dark studio aesthetic — near-black `#0a0a0b` surfaces, brass `#c9a24d` accent, warm bone `#f3efe7` text
- **Fonts:** Cormorant Garamond (serif display) + Inter (sans body)
- **Tailwind v4:** CSS-native `@theme` block in `index.css`, no JS config file
- **Global:** `color-scheme: dark`, brass selection color, box-sizing border-box

### Type System (`types.ts`)

Frontend types match backend models 1:1 — no translation layer. API responses map directly to frontend state.

**Key types:** `Season`, `Garment`, `NodeRun`, `DesignImage`, `MoodboardImage`, `MoodboardAnalysis`, `MoodboardData`, `NodeSummary`, `NodeDef`, `GarmentCategory`, `CategoryDef`, `ImageType`, `ImageView`, `InputImageRef`

**Utility functions:**
- `nodeStatusFromSummary(summary)` → `"empty" | "active" | "done"`
- `seedFromId(id)` → deterministic hash for procedural placeholder generation

---

## Backend Details

### API Endpoints (~30 total)

#### Health
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Returns `{"status": "ok"}` |

#### Seasons (`/api/seasons`)
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/seasons` | List all seasons (sorted by created_at desc) |
| `POST` | `/api/seasons` | Create season (body: `{code}`) |
| `GET` | `/api/seasons/{id}` | Get single season with full moodboard |
| `PATCH` | `/api/seasons/{id}` | Update season code |
| `DELETE` | `/api/seasons/{id}` | Hard-delete + cascade to garments + node_runs |

#### Garments
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/seasons/{id}/garments` | List garments for a season |
| `POST` | `/api/seasons/{id}/garments` | Create garment (body: `{name, category}`, auto-increments style_number) |
| `GET` | `/api/garments/{id}` | Get single garment |
| `PATCH` | `/api/garments/{id}` | Update garment name/category |
| `DELETE` | `/api/garments/{id}` | Hard-delete + cascade to node_runs |

#### Moodboard (nested under seasons)
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/seasons/{id}/moodboard/images` | Upload images (multipart, max 12 total) |
| `DELETE` | `/api/seasons/{id}/moodboard/images/{index}` | Delete image by index |
| `POST` | `/api/seasons/{id}/moodboard/analyze` | Trigger Gemini AI analysis |

#### Node Runs
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/garments/{id}/nodes/{node_key}/runs` | List runs for garment+node |
| `POST` | `/api/garments/{id}/nodes/{node_key}/runs` | Create run (auto-increments iteration) |
| `PATCH` | `/api/node-runs/{run_id}/like` | Toggle liked flag |

#### Design Images (Centralized Image Library)
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/images/season/{season_id}` | Query images by season (filters: image_type, node_key, liked, garment_id) |
| `GET` | `/api/images/garment/{garment_id}` | Query images by garment |
| `GET` | `/api/images/run/{run_id}` | Get images for a specific run |
| `GET` | `/api/images/{image_id}` | Get single image |
| `PATCH` | `/api/images/{image_id}/like` | Toggle liked status |
| `PATCH` | `/api/images/{image_id}/star` | Toggle starred status |
| `PATCH` | `/api/images/{image_id}/note` | Update user note |
| `DELETE` | `/api/images/{image_id}` | Delete image (+ ImageKit cleanup) |
| `GET` | `/api/images/season/{season_id}/counts` | Aggregation pipeline for tab badge counts |
| `POST` | `/api/images/upload` | Upload image to library (ImageKit + DesignImage record) |

#### Stage Generation (7 endpoints)
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/garments/{id}/nodes/sketch/generate` | Generate sketch (Form data: gender, silhouette, descriptors, prompt, refs) |
| `POST` | `/api/garments/{id}/nodes/print/generate` | Generate fabric print (JSON: canvas_image, fabric_type, repeat_type, scale) |
| `POST` | `/api/garments/{id}/nodes/render/generate` | Generate render (JSON: sketch_image, gender, fabrics, placements) |
| `POST` | `/api/garments/{id}/nodes/techPack/generate` | Generate tech pack (JSON: construction, stitch, seam, bom, measurements) |
| `POST` | `/api/garments/{id}/nodes/pattern/generate` | Generate pattern (JSON: measurements, construction, pattern settings) |
| `POST` | `/api/garments/{id}/nodes/visualization/generate` | Generate 3D visualization (JSON: model_avatar, environment) |
| `POST` | `/api/garments/{id}/nodes/photoshoot/generate` | Generate photoshoot (JSON: moodboard_influence, shot_type, location, mood, pose) |

### Database Schema

**MongoDB Atlas** with **Beanie ODM** (async, Pydantic v2).

```
seasons ──1:N── garments ──1:N── node_runs
                                         │
seasons ──1:N── design_images ──────────┘
garments ──1:N── design_images ──────────┘
```

#### `seasons` collection
| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | |
| `code` | str | 1-12 alphanumeric, uppercase (e.g., "SS27") |
| `moodboard.name` | str \| null | Optional moodboard name |
| `moodboard.status` | enum | `empty` → `uploading` → `analyzing` → `ready` / `failed` |
| `moodboard.images[]` | array | `{url, imagekit_file_id, source, order}` |
| `moodboard.analysis.palette` | list[str] | 5 hex colors from Gemini |
| `moodboard.analysis.keywords` | list[str] | 10 lowercase mood keywords |
| `moodboard.analysis.brief` | str \| null | 30-40 word creative direction |
| `moodboard.analysis.model` | str \| null | AI model used |
| `moodboard.analysis.analyzed_at` | datetime \| null | |
| `moodboard.analysis.error` | str \| null | |
| `created_at` / `updated_at` | datetime | |

#### `garments` collection
| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | |
| `season_id` | str | Indexed FK |
| `name` | str | |
| `category` | enum | GarmentCategory (10 values) |
| `style_number` | int | Auto-incremented per season |
| `current_version` | int | Bumped when earlier stages are re-edited |
| `node_summary` | dict | Denormalized cache per NodeKey |
| `created_at` / `updated_at` | datetime | |

**NodeSummary:** `{run_count, liked_count, has_processing, has_failed, last_run_at}`

#### `node_runs` collection
| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | |
| `season_id` | str | Denormalized for query efficiency |
| `garment_id` | str | Indexed FK |
| `node_key` | enum | Indexed |
| `iteration` | int | Per (garment_id, node_key) |
| `version` | int | Per garment — bumped on downstream re-edit |
| `code` | str | e.g., "SS27_PANT_001_v1_SKTCH_R04" |
| `status` | enum | `pending` → `processing` → `complete` / `failed` |
| `liked` | bool | "Keep this one" flag |
| `inputs[]` | list | `{run_id, node_key}` provenance links |
| `output.images` | list[str] | ImageKit URLs |
| `output.text` | str \| null | |
| `output.extra` | dict | Flexible per-tool payload |
| `output_image_ids` | list[str] | Links to DesignImage documents |
| `ai` | obj | `model, prompt, started_at, completed_at, error, retry_count` |
| `created_at` / `updated_at` | datetime | |

**Indexes:** unique compound `(garment_id, node_key, iteration)`, compound `(garment_id, node_key, liked)`

#### `design_images` collection (NEW)
| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | |
| `image_code` | str | e.g., "SS27_PANT_001_v1_SKTCH_R04" |
| `index` | int | Sequential within context |
| `season_id` | str | Indexed FK |
| `garment_id` | str | Indexed FK |
| `node_key` | enum | Indexed — which stage produced this |
| `run_id` | str | Indexed FK — which run produced this |
| `version` | int | Garment version at time of creation |
| `image_type` | enum | Indexed — sketch, fabric, render, print, tech_pack, pattern, 3d, photo, moodboard, reference |
| `view` | enum | front, back, front_and_back, flat, 3d, model |
| `liked` | bool | |
| `starred` | bool | Wishlist/star system |
| `input_images` | list | `{image_id, stage, role}` — lineage chain |
| `source` | enum | upload, ai |
| `ai_model` | str \| null | |
| `ai_prompt` | str \| null | |
| `params` | dict | Generation parameters |
| `url` | str | ImageKit URL |
| `imagekit_file_id` | str | |
| `file_size_bytes` | int \| null | |
| `width` / `height` | int \| null | |
| `file_format` | str \| null | |
| `note` | str \| null | User annotation |
| `tags` | list[str] | |
| `created_at` / `updated_at` | datetime | |

**Indexes:** 7 compound indexes for efficient querying by season/garment/run/type.

### Enums

| Enum | Values |
|------|--------|
| `NodeKey` | `sketch`, `print`, `render`, `techPack`, `pattern`, `visualization`, `photoshoot` |
| `GarmentCategory` | `SHIRT`, `TEE`, `TOP`, `DRESS`, `SKIRT`, `PANT`, `SHORT`, `JACKET`, `SWTSHRT`, `JUMP` |
| `RunStatus` | `pending`, `processing`, `complete`, `failed` |
| `MoodboardStatus` | `empty`, `uploading`, `analyzing`, `ready`, `failed` |
| `ImageType` | `sketch`, `fabric`, `render`, `print`, `tech_pack`, `pattern`, `3d`, `photo`, `moodboard`, `reference` |
| `ImageSource` | `upload`, `pinterest` |

### Services

#### ImageKit (`services/imagekit.py`)
- `upload_image(file_bytes, file_name)` → `{file_id, url}`
- `delete_image(file_id)` → None
- Uses synchronous `imagekitio` SDK (v5.8.0) — NOT async
- Configured via `IMAGEKIT_PUBLIC_KEY`, `IMAGEKIT_PRIVATE_KEY`, `IMAGEKIT_URL_ENDPOINT`

#### Gemini AI (`services/gemini.py`)
- `analyze_moodboard(image_urls)` → `{palette, keywords, brief, model}`
- Downloads images as base64 `inlineData` parts (not URL-based)
- Max 5 images (capped server-side)
- Model: `gemini-2.5-flash` (text analysis) + `gemini-2.5-flash-image` (image generation)
- Configured via `AI_KEY` env var

#### Avatar Reference (`services/avatar_reference.py`)
- `MODEL_DESCRIPTIONS`: Two fixed personas (Model A = male, Model B = female)
- `framing_logic()`: Category-driven crop/framing rules (upper body = medium shot, lower body = lower focus, full body = wide)
- Used by visualization and photoshoot stages

#### Generation Helpers (`services/generation_helpers.py`)
- `fetch_image_bytes()`: Resolves URL or data URL to bytes
- `build_placeholder_image()`: Creates lightweight PIL placeholder when AI unavailable

---

## Environment Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `MONGODB_URI` | MongoDB Atlas connection string | `mongodb+srv://...` |
| `MONGODB_DB_NAME` | Database name | `design_studio` |
| `IMAGEKIT_PUBLIC_KEY` | ImageKit public API key | |
| `IMAGEKIT_PRIVATE_KEY` | ImageKit private API key | |
| `IMAGEKIT_URL_ENDPOINT` | ImageKit CDN URL | `https://ik.imagekit.io/...` |
| `AUTH_EMAIL` | Fixed auth email | |
| `AUTH_PASSWORD` | Fixed auth password | |
| `JWT_SECRET` | JWT signing secret | |
| `AI_KEY` | Google Gemini API key | `AIzaSy...` |
| `VERTEX_BASE_URL` | Vertex AI API base URL | |
| `CORS_ORIGINS` | Allowed CORS origins | |

---

## Data Flow: Moodboard Creation

```
User clicks "Save Moodboard" in StartMoodboardModal
  │
  ├─ Modal button shows spinner + "Uploading N images…"
  │  (modal locked, can't close or edit)
  │
  ├─ handleMoodboardSave() in SeasonDetailPage
  │  ├─ setMoodboardImages(seasonId, images, name)
  │  │  ├─ Filters data-URL images → converts to File objects
  │  │  ├─ POST /api/seasons/{id}/moodboard/images (multipart)
  │  │  │  └─ Backend uploads each to ImageKit, saves URLs in MongoDB
  │  │  └─ Merges server response into local state
  │  │
  │  └─ analyzeMoodboard(seasonId)  [fire-and-forget]
  │     ├─ POST /api/seasons/{id}/moodboard/analyze
  │     │  ├─ Backend sets status → "analyzing"
  │     │  ├─ Downloads images as base64 inlineData
  │     │  ├─ Calls Gemini API (up to 5 images)
  │     │  ├─ Parses JSON response → palette, keywords, brief
  │     │  └─ Saves to MongoDB, sets status → "ready"
  │     │
  │     └─ Frontend polls/updates → shows results
  │
  ├─ Modal closes (upload done)
  │
  └─ "Analyzing your mood…" spinner shows below images
     └─ When analysis completes → palette/keywords/brief appear
```

---

## Data Flow: Stage Pipeline (Complete)

```
GarmentDetailPage → clicks NodeCard → navigates to StageWorkspacePage
  │
  ├─ Left Panel: Stage-specific tool form (SketchTool, PrintTool, etc.)
  │  ├─ Fetches upstream images via ImagePickerModal (from DesignImage library)
  │  ├─ User configures parameters
  │  └─ Clicks "Generate" → POST /api/garments/{id}/nodes/{node_key}/generate
  │
  ├─ Backend Pipeline:
  │  ├─ Creates NodeRun document (pending → processing)
  │  ├─ Resolves input images (lineage chain via input_images)
  │  ├─ Calls Gemini AI (gemini-2.5-flash for text, gemini-2.5-flash-image for images)
  │  ├─ Uploads generated images to ImageKit
  │  ├─ Creates DesignImage documents with full lineage
  │  ├─ Updates NodeRun (complete, output_image_ids)
  │  ├─ Updates node_summary on Garment (denormalized cache)
  │  └─ If earlier stage re-edited → bumps garment current_version
  │
  ├─ Right Panel: StageOutputPanel
  │  ├─ Fetches images via listImagesForGarment(garmentId, {node_key})
  │  ├─ Filtering: All / Liked / Unliked / Starred with counts
  │  ├─ Lightbox viewer for full-screen preview
  │  ├─ Like/Star/Note/Download per image
  │  └─ "Proceed to Next Stage" bar (or "Export" for final stage)
  │
  └─ StageProgressBar: Click any stage to navigate directly
```

---

## Current State Summary

| Area | Status | Notes |
|------|--------|-------|
| Frontend UI/UX | ✅ Complete | 5 pages, 13+ components, dark theme |
| Frontend ↔ Backend | ✅ Wired | Real API calls via StudioContext |
| Backend CRUD API | ✅ Complete | ~30 endpoints, all tested |
| MongoDB + Beanie | ✅ Working | Atlas, 4 collections |
| ImageKit Uploads | ✅ Working | Real uploads to CDN |
| Gemini AI Analysis | ✅ Working | Extracts palette/keywords/brief |
| StartMoodboardModal | ✅ Complete | Async save with loading states + name input |
| SeasonDetailPage | ✅ Complete | 8-tab image browser, analysis spinner, expandable brief |
| Image Library (DesignImage) | ✅ Complete | Centralized CRUD + query + upload + aggregation |
| Sketch Generation (Stage 1) | ✅ Complete | Gemini AI + full PIL procedural fallback |
| Print Pattern (Stage 2) | ✅ Complete | Gemini AI + canvas passthrough fallback |
| First Render (Stage 3) | ✅ Complete | Two-step Gemini AI (text + image) + sketch passthrough |
| Tech Pack (Stage 4) | ✅ Complete | PIL assembly with full document layout |
| Pattern (Stage 5) | ✅ Complete | Hybrid AI (pattern pieces) + PIL (info panel) |
| 3D Visualization (Stage 6) | ✅ Complete | Gemini AI + placeholder fallback |
| Photoshoot (Stage 7) | ✅ Complete | Gemini AI + moodboard influence + placeholder fallback |
| Versioning System | ✅ Complete | Auto-bumps version when earlier stages re-edited |
| Image Lineage Tracking | ✅ Complete | InputImageRef chain across stages |
| Category-Specific Configs | ✅ Complete | Construction, measurements, BOM per garment category |
| Stage Workspace UI | ✅ Complete | Full-screen tool + output panel with filtering/lightbox/export |
| Auth System | ⚠️ Configured | JWT + bcrypt in deps, no login endpoint or middleware |
| Pinterest Import | ⚠️ Simulated | Creates placeholder tiles, not real import |
| Delete Season/Garment UI | ⚠️ API only | Backend supports it, no frontend buttons |

---

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────┐
│                Frontend (React 19)                        │
│                                                          │
│  Pages (5)                   Components (13+9)           │
│  ┌──────────────┐           ┌──────────────────────┐     │
│  │ Landing      │           │ NavBar, Modal        │     │
│  │ SeasonsList  │───────────│ SeasonCard           │     │
│  │ SeasonDetail │           │ GarmentCard          │     │
│  │ GarmentDetail│           │ NodeCard             │     │
│  │ StageWorkspc │           │ PaletteSwatches      │     │
│  └──────────────┘           │ KeywordChips         │     │
│         │                   │ MoodboardTile        │     │
│         │                   │ PlaceholderTile      │     │
│         │                   │ StartMoodboard       │     │
│         │                   │ ImagePickerModal     │     │
│         │                   │ StageOutputPanel     │     │
│         │                   │ StageProgressBar     │     │
│         │                   │ ─────────────────── │     │
│         │                   │ stages/              │     │
│         │                   │  SketchTool          │     │
│         │                   │  PrintTool           │     │
│         │                   │  RenderTool          │     │
│         │                   │  TechPackTool        │     │
│         │                   │  PatternTool         │     │
│         │                   │  VisualizationTool   │     │
│         │                   │  PhotoshootTool      │     │
│         │                   └──────────────────────┘     │
│  ┌──────┴────────────────────────────────────┐           │
│  │   StudioContext (React Context)            │           │
│  │   - Real API calls (no mock data)         │           │
│  │   - seasons[], garments[]                 │           │
│  │   - setMoodboardImages(), analyzeMoodboard│           │
│  └──────────────┬────────────────────────────┘           │
│                 │ /api proxy (→ :8000)                    │
└─────────────────┼────────────────────────────────────────┘
                  │
┌─────────────────┼────────────────────────────────────────┐
│            Backend (FastAPI)                              │
│                 │                                        │
│  Routes (30+)   │    Services                            │
│  ┌──────────────┴──────────────────┐                    │
│  │ CRUD: seasons, garments,        │  ┌──────────┐     │
│  │       moodboard, node_runs      │──│ ImageKit │     │
│  │ Images: design_images (9 CRUD)  │  │ (upload) │     │
│  │ Stages: sketch, print, render,  │  └──────────┘     │
│  │   techpack, pattern, vis, shoot │                    │
│  └──────────────┬──────────────────┘  ┌──────────┐     │
│                 │                     │  Gemini  │     │
│  Models (4)     │                     │  (AI)    │     │
│  ┌──────────────┤                     └──────────┘     │
│  │ seasons      │                     ┌──────────┐     │
│  │ garments     │─────────────────────│  Avatar  │     │
│  │ node_runs    │                     │ Reference│     │
│  │ design_images│                     └──────────┘     │
│  └──────────────┤                                      │
│                 │                                      │
│  ┌──────────────┴──────────────────┐                   │
│  │     MongoDB Atlas                │                   │
│  │     (4 collections)              │                   │
│  └──────────────────────────────────┘                   │
└──────────────────────────────────────────────────────────┘
```

---

## Key Decisions

1. **Types match 1:1** — Frontend TS interfaces mirror backend Pydantic models exactly. No translation layer.
2. **No `seed` field in DB** — Frontend derives placeholder seed from document ID via `seedFromId()`.
3. **Append-only versioning** — NodeRuns are never mutated; new documents per iteration.
4. **Version bumping** — Editing an earlier stage after moving forward creates a new version on the garment.
5. **Denormalized caches** — `node_summary` on Garment is a read-only cache; source of truth is `node_runs`.
6. **ImageKit sync SDK** — `imagekitio` v5.8 is synchronous, not async. Upload/delete are blocking calls.
7. **Gemini via REST** — Raw `httpx` POST, downloads images as base64 inlineData (not URL-based).
8. **Max 5 images for AI** — Capped server-side regardless of how many user uploaded.
9. **AI-first with local fallback** — Every stage tries Gemini AI first, falls back to PIL/placeholder if unavailable.
10. **Image lineage tracking** — `InputImageRef` on DesignImage tracks which upstream images feed into each generation.
11. **Centralized image library** — DesignImage is the single source of truth for all generated/uploaded images.
12. **Category-driven configuration** — Construction options, measurements, framing logic all vary by garment category.
13. **Auth not wired** — JWT/bcrypt in deps but no login endpoint or middleware. Single fixed user.
14. **Pinterest import simulated** — Creates `mood-placeholder:*` URIs, not real Pinterest API.

---

## The 7-Stage Pipeline

Each garment moves through these stages sequentially:

| # | NodeKey | Label | Hint | AI Model | PIL Fallback |
|---|---------|-------|------|----------|--------------|
| 1 | `sketch` | Sketch | Generate flat sketch of the garment silhouette | gemini-2.5-flash-image | Full procedural sketch engine (10 categories, multiple views) |
| 2 | `print` | Print | Upload motif and create seamless fabric print pattern | gemini-2.5-flash-image | Canvas passthrough |
| 3 | `render` | Render | Combine sketch + fabric into a colored flat render | gemini-2.5-flash + gemini-2.5-flash-image | Sketch passthrough |
| 4 | `techPack` | Tech Pack | Construction spec, measurements, BOM | (PIL only) | Full 1200×900 document assembly |
| 5 | `pattern` | Pattern | Technical flat pattern | gemini-2.5-flash-image | PIL info panel (40% of canvas) |
| 6 | `visualization` | 3D Visualization | 3D mockup of the garment on model | gemini-2.5-flash-image | Placeholder image |
| 7 | `photoshoot` | Photoshoot | Final photoshoot render on model | gemini-2.5-flash-image | Placeholder image |

---

## Things to Know

- **`mockData.ts` is legacy** — App fetches real data from backend. `MOCK_SEASONS` and `MOCK_GARMENTS` are unused, but `NODE_DEFS` is actively imported by multiple components.
- **`icons.svg` sprite is unused** — Leftover from Vite template.
- **Backend logging** — `logging.basicConfig()` in `main.py`, routes log with `logging.getLogger("moodboard")`, `logging.getLogger("gemini")`.
- **`imagekitio` init** — v5.8 takes only `private_key`, NOT `public_key` (broke in earlier versions).
- **Beanie version pinning** — Must use `beanie==1.28.0`, `motor==3.6.1`, `pymongo==4.9.2`. Beanie 2.x breaks with Motor 3.7+.
- **The `ai_key` config field** — Added separately to `config.py`, not in `.env.example`.
- **Frontend build** — `npm run build` runs `tsc -b && vite build`. Must pass before deploying.
- **Season model uses `code`** — Not `name`. The seed script still uses `name` (mismatch).
- **Node key `print` replaces `fabric`** — The original "fabric" node was renamed to "print" to better describe the task (upload motif + create seamless pattern).
- **`todo.md` is the active task list** — 25 gap items (6 critical, 7 high, 7 medium, 3 low) comparing current code to the designed prototype in `read_only/`.
- **`read_only/` is the source of truth** — Contains the HTML prototype (`design_studio_flow.html`), handover spec (`handover_for_harsh.md`), and standalone tool prototypes for stages 1-5.
- **Deployment** — Railway-ready with `Procfile` and `railway.toml`.
- **Code duplication** — Versioning logic and NodeRun creation pattern is duplicated across all 7 stage routes.
