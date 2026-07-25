# Design Studio — Project Analysis

An AI-assisted fashion design tool where designers build **Seasons** (12-image moodboards) and create **Garments** inside them, each moving through an 8-node fashion pipeline from research to final model shoot.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript 6, Vite 8, Tailwind CSS v4 |
| Backend | Python, FastAPI, Uvicorn |
| Database | MongoDB Atlas (via Motor + Beanie ODM) |
| Image Storage | ImageKit CDN |
| AI | Google Gemini (planned, not wired) |
| Linting | oxlint (Rust-based) |

---

## Project Structure

```
designStudio/
├── frontend/          # React SPA (Vite + Tailwind v4)
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx            # Router + StudioProvider
│   │   ├── index.css          # Tailwind @theme tokens
│   │   ├── types.ts           # Core TS interfaces
│   │   ├── components/        # 10 reusable components
│   │   ├── pages/             # 4 route pages
│   │   ├── state/             # StudioContext (React Context)
│   │   ├── data/              # Mock data + generators
│   │   └── utils/             # Sample image URLs
│   ├── public/                # favicon.svg, icons.svg
│   ├── package.json
│   └── vite.config.ts
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI entry + /health
│   │   ├── config.py          # pydantic-settings config
│   │   ├── db.py              # Motor/Beanie init
│   │   └── models/
│   │       ├── enums.py       # NodeKey, RunStatus, etc.
│   │       ├── season.py      # Season document model
│   │       ├── garment.py     # Garment document model
│   │       └── node_run.py    # NodeRun document model
│   ├── scripts/
│   │   └── verify_connections.py
│   ├── requirements.txt
│   ├── SCHEMA.md
│   └── .env / .env.example
└── root.md                    # This file
```

---

## Frontend Analysis

### Routing

| Path | Page | Description |
|------|------|-------------|
| `/` | LandingPage | Marketing hero page |
| `/seasons` | SeasonsListPage | Grid of all seasons |
| `/seasons/:seasonId` | SeasonDetailPage | Moodboard + garments |
| `/seasons/:seasonId/garments/:garmentId` | GarmentDetailPage | 8-node pipeline grid |

### Components (10 total)

| Component | Purpose |
|-----------|---------|
| `NavBar` | Sticky header with breadcrumbs + optional action |
| `Modal` | Generic overlay dialog with backdrop blur |
| `SeasonCard` | Season thumbnail card with palette dots |
| `GarmentCard` | Garment card with progress bar |
| `NodeCard` | Single pipeline node button (empty/active/done states) |
| `PaletteSwatches` | Row of circular color swatches |
| `KeywordChips` | Uppercase pill-shaped keyword labels |
| `MoodboardTile` | Smart image/placeholder wrapper |
| `PlaceholderTile` | Seed-based procedural gradient art |
| `StartMoodboardModal` | Drag-drop upload + Pinterest import flow |

### State Management

- **React Context** (`StudioContext`) — no external state library
- All data is **client-side mock data** (2 seasons, 4 garments)
- Seed-based deterministic generators for palettes, keywords, placeholder art
- ID generation: `crypto.randomUUID().slice(0,8)` with `s_`/`g_` prefixes
- Context memoized with `useMemo`

### Design System

- **Theme:** Dark studio aesthetic (near-black `#0a0a0b` surfaces, brass `#c9a24d` accent, warm bone `#f3efe7` text)
- **Fonts:** Cormorant Garamond (serif display) + Inter (sans body)
- **Tailwind v4:** CSS-native `@theme` config in `index.css`, no JS config file
- **Global:** `color-scheme: dark`, brass selection color, box-sizing border-box

### What's Not Implemented

- No backend API calls — everything is mocked
- Node tools are all stubs (modal shows placeholder message)
- Pinterest import is simulated (generates placeholder tiles)
- Image uploads stored as data URLs, not sent to server
- `icons.svg` sprite is unused (leftover from Vite template)

---

## Backend Analysis

### API Endpoints

| Method | Path | Status |
|--------|------|--------|
| `GET` | `/health` | Implemented — returns `{"status": "ok"}` |

**No CRUD routes, no service layer, no auth middleware exist yet.**

### Database Models (3 collections)

#### `seasons` — Root entity (one per moodboard)
- `name`, `created_at`, `updated_at`
- `moodboard.status` — tracks AI analysis lifecycle (`empty` → `uploading` → `analyzing` → `ready` / `failed`)
- `moodboard.images[]` — each has `url`, `imagekit_file_id`, `source` (upload/pinterest), `order`
- `moodboard.analysis` — `palette[]`, `keywords[]`, `brief`, `model`, `analyzed_at`, `error`

#### `garments` — One per design within a season
- `season_id` (indexed FK), `name`, `created_at`, `updated_at`
- `node_summary` — denormalized read cache per node (run_count, liked_count, has_processing, has_failed, last_run_at)

#### `node_runs` — Versioning core (append-only)
- `season_id`, `garment_id` (indexed), `node_key` (indexed), `iteration`
- `status` — `pending` → `processing` → `complete` / `failed`
- `liked` — "keep this one" flag
- `inputs[]` — provenance links to upstream runs
- `output` — `images[]`, `text`, `extra` (flexible dict)
- `ai` — `model`, `prompt`, `started_at`, `completed_at`, `error`, `retry_count`
- **Indexes:** unique compound `(garment_id, node_key, iteration)`, compound `(garment_id, node_key, liked)`

### Enums (4)

| Enum | Values |
|------|--------|
| `NodeKey` | research, sketch, fabric, colorTrim, pattern, mockup, fitCheck, modelShoot |
| `RunStatus` | pending, processing, complete, failed |
| `MoodboardStatus` | empty, uploading, analyzing, ready, failed |
| `ImageSource` | upload, pinterest |

### Dependencies (requirements.txt)

```
fastapi, uvicorn[standard], motor, beanie, pymongo, pydantic-settings, python-dotenv, python-jose[cryptography], passlib[bcrypt], imagekitio, typing_extensions
```

### What's Not Implemented

- No API routes beyond `/health`
- No service/business logic layer
- No AI integration code (Gemini calls)
- No image upload handlers
- No moodboard analysis pipeline
- No node execution engine
- Auth system configured (JWT, bcrypt) but not wired — no login endpoint, no middleware

---

## Data Model Design Decisions

1. **Reference, not embed** — Collections linked by string `_id`, not embedded documents
2. **No `users` collection** — Single fixed auth gate, no multi-tenancy
3. **Hard delete** — Deletions cascade immediately, no soft-delete
4. **Append-only versioning** — NodeRuns never mutated; new documents per iteration
5. **Denormalized caches** — `node_summary` on Garment is a read-only cache; source of truth is `node_runs`
6. **Polymorphic collection** — `node_runs` uses `node_key` discriminator + flexible `output.extra`

---

## Current State Summary

| Area | Status |
|------|--------|
| Frontend UI/UX | Complete — all 4 pages, 10 components, dark theme |
| Frontend data | Mock only — no backend integration |
| Backend schema | Complete — 3 models, 4 enums, indexes defined |
| Backend API | Scaffold only — health check only |
| AI integration | Not started — models designed for it, no code |
| Auth | Configured, not implemented |
| Image upload | Frontend: data URLs. Backend: ImageKit SDK configured |

---

## Architecture Diagram

```
┌─────────────────────────────────────┐
│           Frontend (React)          │
│  ┌──────────┐  ┌────────────────┐   │
│  │  Pages    │  │  Components    │   │
│  │  (4)     │──│  (10)          │   │
│  └──────────┘  └────────────────┘   │
│       │              │              │
│  ┌────┴──────────────┴────┐        │
│  │   StudioContext         │        │
│  │   (React Context +     │        │
│  │    Mock Data)           │        │
│  └────────────────────────┘        │
└──────────────┬──────────────────────┘
               │ (not connected)
┌──────────────┴──────────────────────┐
│           Backend (FastAPI)          │
│  ┌──────────┐  ┌────────────────┐   │
│  │  /health │  │  Models (3)    │   │
│  └──────────┘  └────────────────┘   │
│                     │              │
│  ┌──────────────────┴────┐         │
│  │   MongoDB Atlas        │         │
│  │   + ImageKit CDN       │         │
│  └───────────────────────┘         │
└─────────────────────────────────────┘
```
