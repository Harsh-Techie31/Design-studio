# Design Studio — Project Analysis

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
| AI | Google Gemini (`gemini-2.5-flash-image`) via REST API |
| Linting | oxlint (Rust-based) |

---

## Project Structure

```
designStudio/
├── frontend/                          # React SPA
│   ├── src/
│   │   ├── main.tsx                   # ReactDOM entry
│   │   ├── App.tsx                    # Router + StudioProvider wrapper
│   │   ├── index.css                  # Tailwind v4 @theme tokens (dark palette)
│   │   ├── types.ts                   # All TS interfaces + utility fns
│   │   ├── api/
│   │   │   ├── client.ts             # Base fetch wrapper (/api prefix)
│   │   │   ├── seasons.ts            # Seasons CRUD + analyzeMoodboard
│   │   │   ├── garments.ts           # Garments CRUD
│   │   │   ├── nodeRuns.ts           # Node runs CRUD + like toggle
│   │   │   └── uploads.ts            # Multipart image upload/delete
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
│   │   │   └── StartMoodboardModal.tsx  # Upload flow with async save
│   │   ├── pages/
│   │   │   ├── LandingPage.tsx       # Marketing hero page
│   │   │   ├── SeasonsListPage.tsx   # Season grid + create modal
│   │   │   ├── SeasonDetailPage.tsx  # Moodboard + analysis + garments
│   │   │   └── GarmentDetailPage.tsx # 8-node pipeline grid
│   │   ├── state/
│   │   │   └── StudioContext.tsx      # Global state (real API calls)
│   │   ├── data/
│   │   │   └── mockData.ts           # Legacy mock data (mostly unused)
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
│   │   ├── main.py                   # FastAPI entry, CORS, routers, logging
│   │   ├── config.py                 # pydantic-settings (reads .env)
│   │   ├── db.py                     # Motor + Beanie init
│   │   ├── models/
│   │   │   ├── enums.py              # NodeKey, RunStatus, MoodboardStatus, ImageSource
│   │   │   ├── season.py             # Season + MoodboardData + MoodboardAnalysis
│   │   │   ├── garment.py            # Garment + NodeSummary
│   │   │   └── node_run.py           # NodeRun (append-only versioning)
│   │   ├── routes/
│   │   │   ├── seasons.py            # CRUD + cascade delete
│   │   │   ├── garments.py           # CRUD + _update_node_summary()
│   │   │   ├── moodboard.py          # Upload/delete images + analyze endpoint
│   │   │   └── node_runs.py          # CRUD + like toggle + stub outputs
│   │   ├── schemas/
│   │   │   ├── season.py             # SeasonCreate/Update/Response
│   │   │   ├── garment.py            # GarmentCreate/Update/Response
│   │   │   ├── node_run.py           # NodeRunCreate/Response/LikeToggle
│   │   │   └── moodboard.py          # MoodboardImageResponse
│   │   └── services/
│   │       ├── imagekit.py           # ImageKit upload/delete (sync SDK)
│   │       └── gemini.py             # Gemini Vision API (URL-based, max 5 images)
│   ├── scripts/
│   │   ├── seed_db.py                # Seeds 2 seasons + 4 garments
│   │   └── verify_connections.py     # Tests MongoDB + ImageKit connections
│   ├── requirements.txt              # Pinned deps (beanie 1.28, motor 3.6)
│   ├── SCHEMA.md                     # Database schema documentation
│   ├── .env                          # Live credentials (not committed)
│   └── .env.example                  # Template
└── root.md                           # This file
```

---

## Frontend Details

### Routing

| Path | Page | Description |
|------|------|-------------|
| `/` | LandingPage | Marketing hero, feature cards, CTA |
| `/seasons` | SeasonsListPage | Grid of SeasonCards, "+ New Season" button |
| `/seasons/:seasonId` | SeasonDetailPage | Moodboard grid, analysis status, palette/keywords/brief, garments list |
| `/seasons/:seasonId/garments/:garmentId` | GarmentDetailPage | 4×2 grid of 8 NodeCards |

### Components (10)

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
| `StartMoodboardModal` | Full upload flow: drag-drop zone, Pinterest import (simulated), recommended/avoid examples, async save with spinner |

### State Management — `StudioContext.tsx`

React Context with real API calls. No external state library.

**State:** `seasons: Season[]`, `garments: Garment[]`, `loading: boolean`, `error: string | null`

**Exposed methods:**

| Method | Description |
|--------|-------------|
| `getSeason(id)` | Find season by ID from local state |
| `getGarmentsForSeason(seasonId)` | Filter garments by season_id |
| `getGarment(id)` | Find garment by ID |
| `createSeason(name)` | POST to API, prepend to state |
| `createGarment(seasonId, name)` | POST to API, prepend to state |
| `setMoodboardImages(seasonId, images)` | Converts data-URLs to Files, uploads via multipart POST, merges server response |
| `analyzeMoodboard(seasonId)` | POST to analyze endpoint, updates moodboard data |
| `refreshSeasons()` | Re-fetch all seasons |

**Initialization:** On mount, fetches all seasons, then iterates to fetch all garments.

### API Layer (`src/api/`)

| Module | Functions |
|--------|-----------|
| `client.ts` | `request<T>(path, options)` — generic fetcher with `/api` prefix, `ApiError` class |
| `seasons.ts` | `listSeasons`, `getSeason`, `createSeason`, `updateSeason`, `deleteSeason`, `analyzeMoodboard` |
| `garments.ts` | `listGarments`, `getGarment`, `createGarment`, `updateGarment`, `deleteGarment` |
| `nodeRuns.ts` | `listRuns`, `createRun`, `toggleLike` |
| `uploads.ts` | `uploadMoodboardImages` (multipart), `deleteMoodboardImage` |

### Design System

- **Theme:** Dark studio aesthetic — near-black `#0a0a0b` surfaces, brass `#c9a24d` accent, warm bone `#f3efe7` text
- **Fonts:** Cormorant Garamond (serif display) + Inter (sans body)
- **Tailwind v4:** CSS-native `@theme` block in `index.css`, no JS config file
- **Global:** `color-scheme: dark`, brass selection color, box-sizing border-box

### Type System (`types.ts`)

Frontend types match backend models 1:1 — no translation layer. API responses map directly to frontend state.

**Key types:** `Season`, `Garment`, `NodeRun`, `MoodboardImage`, `MoodboardAnalysis`, `MoodboardData`, `NodeSummary`, `NodeDef`

**Utility functions:**
- `nodeStatusFromSummary(summary)` → `"empty" | "active" | "done"`
- `seedFromId(id)` → deterministic hash for procedural placeholder generation

---

## Backend Details

### API Endpoints (16 total)

#### Health
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Returns `{"status": "ok"}` |

#### Seasons (`/api/seasons`)
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/seasons` | List all seasons (sorted by created_at desc) |
| `POST` | `/api/seasons` | Create season (body: `{name}`) |
| `GET` | `/api/seasons/{id}` | Get single season with full moodboard |
| `PATCH` | `/api/seasons/{id}` | Update season name |
| `DELETE` | `/api/seasons/{id}` | Hard-delete + cascade to garments + node_runs |

#### Garments
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/seasons/{id}/garments` | List garments for a season |
| `POST` | `/api/seasons/{id}/garments` | Create garment (body: `{name}`) |
| `GET` | `/api/garments/{id}` | Get single garment |
| `PATCH` | `/api/garments/{id}` | Update garment name |
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

### Database Schema

**MongoDB Atlas** with **Beanie ODM** (async, Pydantic v2).

```
seasons ──1:N── garments ──1:N── node_runs
```

#### `seasons` collection
| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | |
| `name` | str | |
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
| `status` | enum | `pending` → `processing` → `complete` / `failed` |
| `liked` | bool | "Keep this one" flag |
| `inputs[]` | list | `{run_id, node_key}` provenance links |
| `output.images` | list[str] | ImageKit URLs |
| `output.text` | str \| null | |
| `output.extra` | dict | Flexible per-tool payload |
| `ai` | obj | `model, prompt, started_at, completed_at, error, retry_count` |
| `created_at` / `updated_at` | datetime | |

**Indexes:** unique compound `(garment_id, node_key, iteration)`, compound `(garment_id, node_key, liked)`

### Enums

| Enum | Values |
|------|--------|
| `NodeKey` | `sketch`, `fabric`, `render`, `techPack`, `pattern`, `visualization`, `photoshoot` |
| `RunStatus` | `pending`, `processing`, `complete`, `failed` |
| `MoodboardStatus` | `empty`, `uploading`, `analyzing`, `ready`, `failed` |
| `ImageSource` | `upload`, `pinterest` |

### Services

#### ImageKit (`services/imagekit.py`)
- `upload_image(file_bytes, file_name)` → URL string
- `delete_image(file_id)` → None
- Uses synchronous `imagekitio` SDK (v5.8.0) — NOT async
- Configured via `IMAGEKIT_PUBLIC_KEY`, `IMAGEKIT_PRIVATE_KEY`, `IMAGEKIT_URL_ENDPOINT`

#### Gemini AI (`services/gemini.py`)
- `analyze_moodboard(image_urls)` → `{palette, keywords, brief, model}`
- Passes image URLs directly via `fileData.fileUri` (no base64 download)
- Max 5 images (capped server-side)
- Model: `gemini-2.5-flash` (text analysis only)
- API: `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}`
- Configured via `AI_KEY` env var

### Dependencies (requirements.txt)

```
fastapi, uvicorn[standard], beanie==1.28.0, motor==3.6.1, pymongo==4.9.2,
pydantic-settings, python-dotenv, imagekitio, python-jose[cryptography],
passlib[bcrypt], python-multipart, httpx, typing_extensions
```

**Critical pinning:** Beanie 1.28 + Motor 3.6 + PyMongo 4.9 (Beanie 2.x breaks with Motor 3.7+)

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

---

## Data Flow: Moodboard Creation

```
User clicks "Save Moodboard" in StartMoodboardModal
  │
  ├─ Modal button shows spinner + "Uploading N images…"
  │  (modal locked, can't close or edit)
  │
  ├─ handleMoodboardSave() in SeasonDetailPage
  │  ├─ setMoodboardImages(seasonId, images)
  │  │  ├─ Filters data-URL images → converts to File objects
  │  │  ├─ POST /api/seasons/{id}/moodboard/images (multipart)
  │  │  │  └─ Backend uploads each to ImageKit, saves URLs in MongoDB
  │  │  └─ Merges server response into local state
  │  │
  │  └─ analyzeMoodboard(seasonId)  [fire-and-forget]
  │     ├─ POST /api/seasons/{id}/moodboard/analyze
  │     │  ├─ Backend sets status → "analyzing"
  │     │  ├─ Calls Gemini API with up to 5 ImageKit URLs
  │     │  │  (via fileData.fileUri — no base64 download)
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

## Data Flow: Node Pipeline (Stub)

```
GarmentDetailPage → clicks NodeCard → shows modal (placeholder)
  │
  └─ POST /api/garments/{id}/nodes/{node_key}/runs
     ├─ Auto-increments iteration number
     ├─ Returns stub output (placehold.co URLs, hardcoded text)
     ├─ Updates node_summary on Garment (denormalized cache)
     └─ Frontend shows placeholder output
```

---

## Current State Summary

| Area | Status | Notes |
|------|--------|-------|
| Frontend UI/UX | ✅ Complete | 4 pages, 10 components, dark theme |
| Frontend ↔ Backend | ✅ Wired | Real API calls via StudioContext |
| Backend CRUD API | ✅ Complete | 16 endpoints, all tested |
| MongoDB + Beanie | ✅ Working | Atlas, seeded with mock data |
| ImageKit Uploads | ✅ Working | Real uploads to CDN |
| Gemini AI Analysis | ✅ Working | Extracts palette/keywords/brief |
| StartMoodboardModal | ✅ Complete | Async save with loading states |
| SeasonDetailPage | ✅ Complete | Analysis spinner, expandable brief |
| Node Pipeline | ⚠️ Stub only | Backend returns placeholder data, frontend shows "not wired" |
| Auth System | ⚠️ Configured | JWT + bcrypt in deps, no login endpoint or middleware |
| Pinterest Import | ⚠️ Simulated | Creates placeholder tiles, not real import |
| Node Tools | ⚠️ Not wired | 7 tools (sketch, fabric, render, etc.) need AI backends |

---

## Architecture Diagram

```
┌──────────────────────────────────────────────────┐
│              Frontend (React 19)                  │
│                                                  │
│  Pages (4)              Components (10)          │
│  ┌──────────────┐       ┌──────────────────┐     │
│  │ Landing      │       │ NavBar, Modal    │     │
│  │ SeasonsList  │───────│ SeasonCard       │     │
│  │ SeasonDetail │       │ GarmentCard      │     │
│  │ GarmentDetail│       │ NodeCard         │     │
│  └──────────────┘       │ PaletteSwatches  │     │
│         │               │ KeywordChips     │     │
│         │               │ MoodboardTile    │     │
│         │               │ PlaceholderTile  │     │
│         │               │ StartMoodboard   │     │
│         │               └──────────────────┘     │
│         │                                        │
│  ┌──────┴─────────────────────────────┐          │
│  │   StudioContext (React Context)     │          │
│  │   - Real API calls (no mock data)   │          │
│  │   - seasons[], garments[]           │          │
│  │   - setMoodboardImages()            │          │
│  │   - analyzeMoodboard()              │          │
│  └──────────────┬─────────────────────┘          │
│                 │ /api proxy (→ :8000)            │
└─────────────────┼────────────────────────────────┘
                  │
┌─────────────────┼────────────────────────────────┐
│            Backend (FastAPI)                      │
│                 │                                │
│  Routes (16)    │    Services                    │
│  ┌──────────────┴──────────────┐                 │
│  │ GET/POST/PATCH/DELETE       │                 │
│  │   /api/seasons              │    ┌──────────┐ │
│  │   /api/seasons/{id}/...     │────│ ImageKit │ │
│  │   /api/garments/{id}/...    │    │ (upload) │ │
│  │   /api/node-runs/{id}/...   │    └──────────┘ │
│  └──────────────┬──────────────┘                 │
│                 │                 ┌──────────┐   │
│  Models (3)     │                 │  Gemini  │   │
│  ┌──────────────┤                 │  (AI)    │   │
│  │ seasons      │                 └──────────┘   │
│  │ garments     │                                │
│  │ node_runs    │                                │
│  └──────────────┤                                │
│                 │                                │
│  ┌──────────────┴──────────────┐                 │
│  │     MongoDB Atlas            │                 │
│  │     (3 collections)          │                 │
│  └─────────────────────────────┘                 │
└──────────────────────────────────────────────────┘
```

---

## Key Decisions

1. **Types match 1:1** — Frontend TS interfaces mirror backend Pydantic models exactly. No translation layer.
2. **No `seed` field in DB** — Frontend derives placeholder seed from document ID via `seedFromId()`.
3. **Append-only versioning** — NodeRuns are never mutated; new documents per iteration.
4. **Denormalized caches** — `node_summary` on Garment is a read-only cache; source of truth is `node_runs`.
5. **ImageKit sync SDK** — `imagekitio` v5.8 is synchronous, not async. Upload/delete are blocking calls.
6. **Gemini via REST** — Raw `httpx` POST instead of `google-genai` SDK. URLs passed directly (no base64 download).
7. **Max 5 images for AI** — Capped server-side regardless of how many user uploaded.
8. **Auth not wired** — JWT/bcrypt in deps but no login endpoint or middleware. Single fixed user.
9. **Pinterest import simulated** — Creates `mood-placeholder:*` URIs, not real Pinterest API.
10. **Node tools are stubs** — Backend returns placeholder data; 8 AI tools need backends.

---

## The 7-Stage Pipeline

Each garment moves through these stages sequentially:

| # | NodeKey | Label | Hint | Status |
|---|---------|-------|------|--------|
| 1 | `sketch` | Sketch | Generate flat sketch of the garment silhouette | Stub |
| 2 | `fabric` | Fabric/Print | Pick or generate fabric and print options | Stub |
| 3 | `render` | Render | Combine sketch + fabric into a colored flat render | Stub |
| 4 | `techPack` | Tech Pack | Construction spec, measurements, BOM | Stub |
| 5 | `pattern` | Pattern | Technical flat pattern | Stub |
| 6 | `visualization` | 3D Visualization | 3D mockup of the garment | Stub |
| 7 | `photoshoot` | Photoshoot | Final photoshoot render on model | Stub |

---

## Things to Know

- **`mockData.ts` is legacy** — App fetches real data from backend. Constants like `MOCK_SEASONS` are unused.
- **`icons.svg` sprite is unused** — Leftover from Vite template.
- **Backend logging** — `logging.basicConfig()` in `main.py`, routes log with `logging.getLogger("moodboard")`, `logging.getLogger("gemini")`.
- **`imagekitio` init** — v5.8 takes only `private_key`, NOT `public_key` ( broke in earlier versions).
- **Beanie version pinning** — Must use `beanie==1.28.0`, `motor==3.6.1`, `pymongo==4.9.2`. Beanbie 2.x breaks.
- **The `ai_key` config field** — Added separately to `config.py`, not in `.env.example`.
- **Frontend build** — `npm run build` runs `tsc -b && vite build`. Must pass before deploying.
