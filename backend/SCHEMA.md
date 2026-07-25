# Database Schema — Design Studio

MongoDB Atlas · Python + FastAPI + Beanie (async ODM on Motor + Pydantic v2)

## Collections

Three collections, referenced (not embedded) by string `_id`:

```
seasons  ──1:N──  garments  ──1:N──  node_runs
```

- **No `users` collection.** Auth is a single fixed email/password gate (env vars), not
  multi-tenant — so no `ownerId` anywhere. If real multi-user auth is added later, that's
  additive (one `ownerId` field + a `users` collection), not a schema rewrite.
- **No `garmentIds` array on `Season`, no `nodeRunIds` array on `Garment`.** Children are
  looked up by querying `garment_id`/`season_id` on the child, sorted by `created_at`. Storing
  the reverse array too would be a second source of truth that can drift out of sync — the
  single query pattern (`Garment.find(season_id=...)`) is one extra round-trip, not a real cost.
- **Hard delete.** Deleting a season/garment removes it and cascades to children immediately —
  per your call, no soft-delete/recovery layer for now.
- **No activity log yet.** Skipped for this pass; can be added later as its own collection
  without touching these models.

## `seasons`

One document per moodboard/collection.

| Field | Type | Notes |
|---|---|---|
| `name` | str | |
| `moodboard.status` | enum | `empty → uploading → analyzing → ready` (or `failed`) — the AI palette/keyword extraction is async, this tracks it |
| `moodboard.images[]` | `{url, imagekit_file_id, source, order}` | `source` is `upload` or `pinterest`; `imagekit_file_id` lets the backend delete the file from ImageKit when an image is removed, not just unlink it |
| `moodboard.analysis` | `{palette[], keywords[], brief, model, analyzed_at, error}` | output of the Gemini vision call over the 12 images |
| `created_at` / `updated_at` | datetime | |

Images are **URLs only** (ImageKit-hosted) — no base64/binary in MongoDB.

## `garments`

One document per garment, inside a season.

| Field | Type | Notes |
|---|---|---|
| `season_id` | indexed str | |
| `name` | str | |
| `node_summary` | `dict[NodeKey, NodeSummary]` | **denormalized read cache** — `{run_count, liked_count, has_processing, has_failed, last_run_at}` per node, updated whenever a `node_runs` write happens. Exists purely so the garment list/detail views (7 node-card statuses, "x/7 done" badges) don't need an aggregation query against `node_runs` on every page load. Source of truth is still `node_runs`; this is a cache, never edited directly. |
| `created_at` / `updated_at` | datetime | |

## `node_runs` — the versioning core

This is the collection that matters most, and the pattern to reuse when we model the actual
7 tools: **every time any node/tool executes, it creates a new `NodeRun` document.** Nothing is
overwritten. This directly implements what you described: run tool 4 six times, `liked` marks
the 3 you want to keep, and tool 7 can later pull in a *specific* liked (or manually-selected
non-liked) run from tool 4 as one of its inputs.

| Field | Type | Notes |
|---|---|---|
| `season_id`, `garment_id` | indexed str | `season_id` is denormalized here too (skips a join for "show all liked outputs across this season" style queries later) |
| `node_key` | enum | `sketch \| fabric \| render \| techPack \| pattern \| visualization \| photoshoot` |
| `iteration` | int | 1, 2, 3… per `(garment_id, node_key)` — enforced unique via a compound index, so two concurrent runs can't collide on the same number |
| `status` | enum | `pending → processing → complete` (or `failed`) — full lifecycle per your answer |
| `liked` | bool | the "keep this one" flag from your example |
| `inputs[]` | `{run_id, node_key}` | **provenance** — which upstream run(s) this generation was conditioned on. This is what makes "tool 8 uses tool 4's 3rd run" queryable/auditable instead of implicit |
| `output` | `{images[], text, extra}` | `images` = ImageKit URLs; `text` for text-output nodes (e.g. a Research brief); `extra` is a flexible bag for whatever a specific tool needs that doesn't fit the common shape |
| `ai` | `{model, prompt, started_at, completed_at, error, retry_count}` | full generation metadata — which model, what prompt, timing, failure reason. This is the "full status lifecycle" tracking from your answer, and it's the same shape every future tool will use |
| `created_at` / `updated_at` | datetime | |

Indexes: unique compound `(garment_id, node_key, iteration)`, plus `(garment_id, node_key, liked)`
for the "show me the liked ones first" read pattern.

## Why this shape carries forward to "tools"

`node_runs` is intentionally generic/polymorphic (`node_key` discriminator + a flexible `output.extra`
bag) rather than one collection per tool. When each of the 8 tools gets built out, they're not new
collections — they're new *shapes inside `output.extra`* for a given `node_key`, still going through
the same run → status → liked → inputs lifecycle. That's the pattern to reuse.
