from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from app.models.season import Season
from app.models.garment import Garment
from app.models.node_run import NodeRun, NodeOutput, AIMeta, RunInputRef
from app.models.enums import NodeKey, RunStatus, STAGE_ORDER
from app.schemas.node_run import NodeRunCreate, NodeRunResponse, NodeRunLikeToggle
from app.routes.garments import _update_node_summary

router = APIRouter(tags=["node-runs"])


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _serialize_run(r: NodeRun) -> dict:
    return {
        "id": str(r.id),
        "season_id": r.season_id,
        "garment_id": r.garment_id,
        "node_key": r.node_key.value,
        "iteration": r.iteration,
        "version": r.version,
        "status": r.status.value,
        "liked": r.liked,
        "inputs": [{"run_id": inp.run_id, "node_key": inp.node_key.value} for inp in r.inputs],
        "output": {
            "images": r.output.images,
            "text": r.output.text,
            "extra": r.output.extra,
        },
        "ai": {
            "model": r.ai.model,
            "prompt": r.ai.prompt,
            "started_at": r.ai.started_at.isoformat() if r.ai.started_at else None,
            "completed_at": r.ai.completed_at.isoformat() if r.ai.completed_at else None,
            "error": r.ai.error,
            "retry_count": r.ai.retry_count,
        },
        "created_at": r.created_at.isoformat(),
        "updated_at": r.updated_at.isoformat(),
    }


@router.get("/api/garments/{garment_id}/nodes/{node_key}/runs", response_model=list[NodeRunResponse])
async def list_runs(garment_id: str, node_key: NodeKey, version: int | None = None):
    garment = await Garment.get(garment_id)
    if not garment:
        raise HTTPException(status_code=404, detail="Garment not found")

    query = [NodeRun.garment_id == garment_id, NodeRun.node_key == node_key]
    if version is not None:
        query.append(NodeRun.version == version)

    runs = await NodeRun.find(*query).sort([("iteration", -1)]).to_list()

    return [_serialize_run(r) for r in runs]


@router.post("/api/garments/{garment_id}/nodes/{node_key}/runs", response_model=NodeRunResponse, status_code=201)
async def create_run(garment_id: str, node_key: NodeKey, body: NodeRunCreate | None = None):
    garment = await Garment.get(garment_id)
    if not garment:
        raise HTTPException(status_code=404, detail="Garment not found")

    season = await Season.get(garment.season_id)
    if not season:
        raise HTTPException(status_code=404, detail="Season not found")

    existing = await NodeRun.find(
        NodeRun.garment_id == garment_id,
        NodeRun.node_key == node_key,
    ).to_list()
    iteration = len(existing) + 1

    # Versioning: if downstream stages already have runs in the current version,
    # creating a new run at this (earlier) stage means the user is going back and
    # editing after having moved forward — that starts a new version. Runs already
    # made stay attached to their original version.
    stage_index = STAGE_ORDER.index(node_key)
    downstream_keys = STAGE_ORDER[stage_index + 1 :]
    version = garment.current_version
    if downstream_keys:
        has_downstream = await NodeRun.find(
            NodeRun.garment_id == garment_id,
            NodeRun.version == garment.current_version,
            {"node_key": {"$in": [k.value for k in downstream_keys]}},
        ).exists()
        if has_downstream:
            version = garment.current_version + 1
            garment.current_version = version
            garment.updated_at = _now()
            await garment.save()

    inputs = []
    if body and body.inputs:
        inputs = [RunInputRef(run_id=inp["run_id"], node_key=NodeKey(inp["node_key"])) for inp in body.inputs]

    now = _now()
    run = NodeRun(
        season_id=garment.season_id,
        garment_id=garment_id,
        node_key=node_key,
        iteration=iteration,
        version=version,
        status=RunStatus.PENDING,
        inputs=inputs,
        output=NodeOutput(),
        ai=AIMeta(),
        created_at=now,
        updated_at=now,
    )
    await run.insert()

    run.status = RunStatus.PROCESSING
    run.ai.started_at = _now()
    await run.save()

    output = _stub_node_output(node_key, season.moodboard.analysis.palette)
    run.output = output
    run.status = RunStatus.COMPLETE
    run.ai.completed_at = _now()
    run.ai.model = "stub-v1"
    await run.save()

    await _update_node_summary(garment_id)

    return _serialize_run(run)


@router.patch("/api/node-runs/{run_id}/like", response_model=NodeRunResponse)
async def toggle_like(run_id: str, body: NodeRunLikeToggle):
    run = await NodeRun.get(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Node run not found")

    run.liked = body.liked
    run.updated_at = _now()
    await run.save()

    await _update_node_summary(run.garment_id)

    return _serialize_run(run)


def _stub_node_output(node_key: NodeKey, palette: list[str]) -> NodeOutput:
    if node_key == NodeKey.SKETCH:
        return NodeOutput(
            images=[
                "https://placehold.co/800x1000/1a1a1a/c9a24d?text=Concept+Sketch+1",
                "https://placehold.co/800x1000/1a1a1a/c9a24d?text=Concept+Sketch+2",
            ],
        )

    if node_key == NodeKey.FABRIC:
        return NodeOutput(
            images=[
                "https://placehold.co/600x600/1a1a1a/c9a24d?text=Fabric+Swatch+1",
                "https://placehold.co/600x600/1a1a1a/c9a24d?text=Fabric+Swatch+2",
            ],
            extra={"labels": ["Raw Silk", "Bonded Nylon"]},
        )

    if node_key == NodeKey.RENDER:
        return NodeOutput(
            images=[
                "https://placehold.co/800x1000/1a1a1a/c9a24d?text=Render+Front",
                "https://placehold.co/800x1000/1a1a1a/c9a24d?text=Render+Back",
            ],
        )

    if node_key == NodeKey.TECH_PACK:
        return NodeOutput(
            text="Tech Pack: Relaxed-fit wide-leg trouser. 100% organic cotton twill. "
                 "Front zip fly, elasticated back waistband. Two side pockets, "
                 "two back welt pockets. Hem width 22cm. Inseam 82cm.",
            extra={
                "measurements": {"waist": "76cm", "inseam": "82cm", "hem": "22cm"},
                "materials": ["Organic cotton twill", "YKK zipper"],
            },
        )

    if node_key == NodeKey.PATTERN:
        return NodeOutput(
            images=[
                "https://placehold.co/800x1000/1a1a1a/c9a24d?text=Pattern+Front",
                "https://placehold.co/800x1000/1a1a1a/c9a24d?text=Pattern+Back",
            ],
        )

    if node_key == NodeKey.VISUALIZATION:
        return NodeOutput(
            images=["https://placehold.co/800x1000/1a1a1a/c9a24d?text=3D+Mockup"],
        )

    if node_key == NodeKey.PHOTOSHOOT:
        return NodeOutput(
            images=[
                "https://placehold.co/800x1200/1a1a1a/c9a24d?text=Model+Shoot+1",
                "https://placehold.co/800x1200/1a1a1a/c9a24d?text=Model+Shoot+2",
            ],
        )

    return NodeOutput()
