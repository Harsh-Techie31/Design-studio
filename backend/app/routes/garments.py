from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from app.models.season import Season
from app.models.garment import Garment
from app.models.node_run import NodeRun
from app.models.design_image import DesignImage
from app.schemas.garment import GarmentCreate, GarmentUpdate, GarmentResponse
from app.services.imagekit import delete_image

router = APIRouter(tags=["garments"])


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _serialize_garment(g: Garment) -> dict:
    return {
        "id": str(g.id),
        "season_id": g.season_id,
        "name": g.name,
        "category": g.category.value,
        "style_number": g.style_number,
        "current_version": g.current_version,
        "node_summary": {
            k.value: {
                "run_count": v.run_count,
                "liked_count": v.liked_count,
                "has_processing": v.has_processing,
                "has_failed": v.has_failed,
                "last_run_at": v.last_run_at.isoformat() if v.last_run_at else None,
            }
            for k, v in g.node_summary.items()
        },
        "created_at": g.created_at.isoformat(),
        "updated_at": g.updated_at.isoformat(),
    }


async def _update_node_summary(garment_id: str) -> None:
    garment = await Garment.get(garment_id)
    if not garment:
        return

    from app.models.enums import NodeKey
    from app.models.garment import NodeSummary

    # Single query for all runs, then group in Python (avoids N+1)
    all_runs = await NodeRun.find(NodeRun.garment_id == garment_id).to_list()
    runs_by_key: dict[NodeKey, list] = {}
    for r in all_runs:
        runs_by_key.setdefault(r.node_key, []).append(r)

    for nk in NodeKey:
        runs = runs_by_key.get(nk, [])
        garment.node_summary[nk] = NodeSummary(
            run_count=len(runs),
            liked_count=sum(1 for r in runs if r.liked),
            has_processing=any(r.status.value == "processing" for r in runs),
            has_failed=any(r.status.value == "failed" for r in runs),
            last_run_at=max((r.created_at for r in runs), default=None),
        )

    garment.updated_at = _now()
    await garment.save()


@router.get("/api/seasons/{season_id}/garments", response_model=list[GarmentResponse])
async def list_garments(season_id: str):
    season = await Season.get(season_id)
    if not season:
        raise HTTPException(status_code=404, detail="Season not found")
    garments = await Garment.find(Garment.season_id == season_id).sort([("created_at", -1)]).to_list()
    return [_serialize_garment(g) for g in garments]


@router.post("/api/seasons/{season_id}/garments", response_model=GarmentResponse, status_code=201)
async def create_garment(season_id: str, body: GarmentCreate):
    season = await Season.get(season_id)
    if not season:
        raise HTTPException(status_code=404, detail="Season not found")
    existing_count = await Garment.find(Garment.season_id == season_id).count()
    now = _now()

    # Auto-generate name: SEASON_CODE_CATEGORY_001
    style_number = existing_count + 1
    auto_name = f"{season.code}_{body.category.value}_{style_number:03d}"

    garment = Garment(
        season_id=season_id,
        name=auto_name,
        category=body.category,
        style_number=style_number,
        created_at=now,
        updated_at=now,
    )
    await garment.insert()
    return _serialize_garment(garment)


@router.get("/api/garments/{garment_id}", response_model=GarmentResponse)
async def get_garment(garment_id: str):
    garment = await Garment.get(garment_id)
    if not garment:
        raise HTTPException(status_code=404, detail="Garment not found")
    return _serialize_garment(garment)


@router.patch("/api/garments/{garment_id}", response_model=GarmentResponse)
async def update_garment(garment_id: str, body: GarmentUpdate):
    garment = await Garment.get(garment_id)
    if not garment:
        raise HTTPException(status_code=404, detail="Garment not found")
    if body.name is not None:
        garment.name = body.name.strip() or garment.name
    if body.category is not None:
        garment.category = body.category
    garment.updated_at = _now()
    await garment.save()
    return _serialize_garment(garment)


@router.delete("/api/garments/{garment_id}", status_code=204)
async def delete_garment(garment_id: str):
    garment = await Garment.get(garment_id)
    if not garment:
        raise HTTPException(status_code=404, detail="Garment not found")

    # Clean up DesignImage ImageKit files for this garment
    design_images = await DesignImage.find(DesignImage.garment_id == garment_id).to_list()
    for di in design_images:
        if di.imagekit_file_id:
            try:
                await delete_image(di.imagekit_file_id)
            except Exception:
                pass
    if design_images:
        await DesignImage.find(DesignImage.garment_id == garment_id).delete_many()

    await NodeRun.find(NodeRun.garment_id == garment_id).delete_many()
    await garment.delete()
