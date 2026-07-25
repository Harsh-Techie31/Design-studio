from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.db import client
from app.models.season import Season
from app.models.garment import Garment
from app.models.node_run import NodeRun
from app.schemas.season import SeasonCreate, SeasonUpdate, SeasonResponse

router = APIRouter(prefix="/api/seasons", tags=["seasons"])


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _serialize_season(s: Season) -> dict:
    return {
        "id": str(s.id),
        "name": s.name,
        "moodboard": {
            "status": s.moodboard.status.value,
            "images": [
                {
                    "url": img.url,
                    "imagekit_file_id": img.imagekit_file_id,
                    "source": img.source.value,
                    "order": img.order,
                }
                for img in s.moodboard.images
            ],
            "analysis": {
                "palette": s.moodboard.analysis.palette,
                "keywords": s.moodboard.analysis.keywords,
                "brief": s.moodboard.analysis.brief,
                "model": s.moodboard.analysis.model,
                "analyzed_at": s.moodboard.analysis.analyzed_at.isoformat() if s.moodboard.analysis.analyzed_at else None,
                "error": s.moodboard.analysis.error,
            },
        },
        "created_at": s.created_at.isoformat(),
        "updated_at": s.updated_at.isoformat(),
    }


@router.get("", response_model=list[SeasonResponse])
async def list_seasons():
    seasons = await Season.find_all().sort([("created_at", -1)]).to_list()
    return [_serialize_season(s) for s in seasons]


@router.post("", response_model=SeasonResponse, status_code=201)
async def create_season(body: SeasonCreate):
    now = _now()
    season = Season(
        name=body.name.strip() or "Untitled Season",
        created_at=now,
        updated_at=now,
    )
    await season.insert()
    return _serialize_season(season)


@router.get("/{season_id}", response_model=SeasonResponse)
async def get_season(season_id: str):
    season = await Season.get(season_id)
    if not season:
        raise HTTPException(status_code=404, detail="Season not found")
    return _serialize_season(season)


@router.patch("/{season_id}", response_model=SeasonResponse)
async def update_season(season_id: str, body: SeasonUpdate):
    season = await Season.get(season_id)
    if not season:
        raise HTTPException(status_code=404, detail="Season not found")
    if body.name is not None:
        season.name = body.name.strip() or season.name
    season.updated_at = _now()
    await season.save()
    return _serialize_season(season)


@router.delete("/{season_id}", status_code=204)
async def delete_season(season_id: str):
    season = await Season.get(season_id)
    if not season:
        raise HTTPException(status_code=404, detail="Season not found")

    garments = await Garment.find(Garment.season_id == season_id).to_list()

    for g in garments:
        await NodeRun.find(NodeRun.garment_id == str(g.id)).delete_many()

    if garments:
        await Garment.find(Garment.season_id == season_id).delete_many()

    await season.delete()
