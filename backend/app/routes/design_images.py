from datetime import datetime, timezone
from typing import Optional
import logging
import base64
import random
import string

from pymongo.errors import DuplicateKeyError

from fastapi import APIRouter, HTTPException, Query, UploadFile, File, Form

from app.models.design_image import DesignImage, InputImageRef
from app.models.enums import NodeKey, ImageType
from app.models.garment import Garment
from app.models.season import Season
from app.services.imagekit import upload_image, delete_image as imagekit_delete

router = APIRouter(prefix="/api/images", tags=["design-images"])

logger = logging.getLogger("design-images")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _serialize_image(img: DesignImage) -> dict:
    return {
        "id": str(img.id),
        "image_code": img.image_code,
        "index": img.index,
        "season_id": img.season_id,
        "garment_id": img.garment_id,
        "node_key": img.node_key.value,
        "run_id": img.run_id,
        "version": img.version,
        "image_type": img.image_type,
        "view": img.view,
        "liked": img.liked,
        "starred": img.starred,
        "input_images": [
            {"image_id": inp.image_id, "stage": inp.stage.value, "role": inp.role}
            for inp in img.input_images
        ],
        "source": img.source,
        "ai_model": img.ai_model,
        "ai_prompt": img.ai_prompt,
        "params": img.params,
        "url": img.url,
        "imagekit_file_id": img.imagekit_file_id,
        "file_size_bytes": img.file_size_bytes,
        "width": img.width,
        "height": img.height,
        "file_format": img.file_format,
        "note": img.note,
        "tags": img.tags,
        "created_at": img.created_at.isoformat(),
        "updated_at": img.updated_at.isoformat(),
    }


# ─── Query endpoints ───────────────────────────────────────────────


@router.get("/season/{season_id}")
async def list_images_for_season(
    season_id: str,
    image_type: Optional[str] = Query(None),
    node_key: Optional[NodeKey] = Query(None),
    liked: Optional[bool] = Query(None),
    garment_id: Optional[str] = Query(None),
):
    """Query images by season with filters. Powers the season detail tabs."""
    season = await Season.get(season_id)
    if not season:
        raise HTTPException(status_code=404, detail="Season not found")

    query = [DesignImage.season_id == season_id]
    if image_type:
        query.append(DesignImage.image_type == image_type)
    if node_key:
        query.append(DesignImage.node_key == node_key)
    if liked is not None:
        query.append(DesignImage.liked == liked)
    if garment_id:
        query.append(DesignImage.garment_id == garment_id)

    images = await DesignImage.find(*query).sort([("created_at", -1)]).to_list()
    return [_serialize_image(img) for img in images]


@router.get("/garment/{garment_id}")
async def list_images_for_garment(
    garment_id: str,
    node_key: Optional[NodeKey] = Query(None),
    image_type: Optional[str] = Query(None),
    liked: Optional[bool] = Query(None),
):
    """Query images by garment with filters. Powers the stage workspace output panel."""
    garment = await Garment.get(garment_id)
    if not garment:
        raise HTTPException(status_code=404, detail="Garment not found")

    query = [DesignImage.garment_id == garment_id]
    if node_key:
        query.append(DesignImage.node_key == node_key)
    if image_type:
        query.append(DesignImage.image_type == image_type)
    if liked is not None:
        query.append(DesignImage.liked == liked)

    images = await DesignImage.find(*query).sort([("created_at", -1)]).to_list()
    return [_serialize_image(img) for img in images]


@router.get("/run/{run_id}")
async def list_images_for_run(run_id: str):
    """Get all images produced by a specific node run."""
    images = await DesignImage.find(DesignImage.run_id == run_id).sort(
        [("index", 1)]
    ).to_list()
    return [_serialize_image(img) for img in images]


@router.get("/{image_id}")
async def get_image(image_id: str):
    """Get single image with full metadata."""
    img = await DesignImage.get(image_id)
    if not img:
        raise HTTPException(status_code=404, detail="Image not found")
    return _serialize_image(img)


# ─── Mutation endpoints ────────────────────────────────────────────


@router.patch("/{image_id}/like")
async def toggle_like(image_id: str):
    """Toggle liked status on an image. The source of truth for downstream stage inputs."""
    img = await DesignImage.get(image_id)
    if not img:
        raise HTTPException(status_code=404, detail="Image not found")

    img.liked = not img.liked
    img.updated_at = _now()
    await img.save()
    return _serialize_image(img)


@router.patch("/{image_id}/star")
async def toggle_star(image_id: str):
    """Toggle starred (wishlist) status."""
    img = await DesignImage.get(image_id)
    if not img:
        raise HTTPException(status_code=404, detail="Image not found")

    img.starred = not img.starred
    img.updated_at = _now()
    await img.save()
    return _serialize_image(img)


@router.patch("/{image_id}/note")
async def update_note(image_id: str, body: dict):
    """Update note on an image."""
    img = await DesignImage.get(image_id)
    if not img:
        raise HTTPException(status_code=404, detail="Image not found")

    img.note = body.get("note", "")
    img.updated_at = _now()
    await img.save()
    return _serialize_image(img)


@router.delete("/{image_id}", status_code=204)
async def delete_image(image_id: str):
    """Delete an image. Also deletes from ImageKit if uploaded."""
    img = await DesignImage.get(image_id)
    if not img:
        raise HTTPException(status_code=404, detail="Image not found")

    # Delete from ImageKit if uploaded
    if img.imagekit_file_id:
        try:
            await imagekit_delete(img.imagekit_file_id)
        except Exception as e:
            logger.warning(f"Failed to delete ImageKit file {img.imagekit_file_id}: {e}")

    await img.delete()


# ─── Batch query for season tabs ───────────────────────────────────


@router.get("/season/{season_id}/counts")
async def image_counts_for_season(season_id: str):
    """Get image counts by type for a season. Powers the tab badges."""
    season = await Season.get(season_id)
    if not season:
        raise HTTPException(status_code=404, detail="Season not found")

    pipeline = [
        {"$match": {"season_id": season_id}},
        {"$group": {"_id": "$image_type", "count": {"$sum": 1}, "liked_count": {"$sum": {"$cond": ["$liked", 1, 0]}}}},
    ]
    results = await DesignImage.aggregate(pipeline).to_list()

    counts = {}
    for r in results:
        counts[r["_id"]] = {"total": r["count"], "liked": r["liked_count"]}

    return {
        "sketch": counts.get("sketch", {"total": 0, "liked": 0}),
        "fabric": counts.get("fabric", {"total": 0, "liked": 0}),
        "render": counts.get("render", {"total": 0, "liked": 0}),
        "print": counts.get("print", {"total": 0, "liked": 0}),
        "tech_pack": counts.get("tech_pack", {"total": 0, "liked": 0}),
        "pattern": counts.get("pattern", {"total": 0, "liked": 0}),
        "3d": counts.get("3d", {"total": 0, "liked": 0}),
        "photo": counts.get("photo", {"total": 0, "liked": 0}),
    }


# ─── Upload endpoint ───────────────────────────────────────────────


@router.post("/upload")
async def upload_image_to_library(
    file: UploadFile = File(...),
    season_id: str = Form(...),
    garment_id: str = Form(""),
    image_type: str = Form("reference"),
    note: str = Form(""),
):
    """
    Upload an image to ImageKit and save to DesignImage library.
    Used for manual uploads in Render stage (sketch picker, fabric picker).
    """
    season = await Season.get(season_id)
    if not season:
        raise HTTPException(status_code=404, detail="Season not found")

    # Read file bytes
    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File exceeds 10MB limit")

    # Determine folder based on image type
    folder_map = {
        "sketch": f"/design-studio/{season_id}/sketches/",
        "fabric": f"/design-studio/{season_id}/fabrics/",
        "print": f"/design-studio/{season_id}/prints/",
        "render": f"/design-studio/{season_id}/renders/",
    }
    folder = folder_map.get(image_type, f"/design-studio/{season_id}/uploads/")

    # Generate image code with random suffix to avoid duplicates
    now = _now()

    while True:
        suffix = ''.join(random.choices(string.digits, k=6))
        img_code = f"{season.code or 'UNK'}_{image_type.upper()}_{suffix}"

        # Upload to ImageKit
        file_name = f"{img_code}.png"
        try:
            ik_result = await upload_image(contents, folder=folder, file_name=file_name)
            img_url = ik_result["url"]
            ik_file_id = ik_result["file_id"]
        except Exception as e:
            logger.error(f"ImageKit upload failed: {e}")
            raise HTTPException(status_code=500, detail="Image upload to CDN failed. Please try again.")

        # Save to DesignImage
        design_img = DesignImage(
            image_code=img_code,
            index=0,
            season_id=season_id,
            garment_id=garment_id or "",
            node_key=NodeKey.SKETCH if image_type == "sketch" else NodeKey.PRINT,
            run_id="",
            version=1,
            image_type=image_type,
            view="front",
            liked=False,
            starred=False,
            input_images=[],
            source="upload",
            ai_model=None,
            ai_prompt=None,
            params={},
            url=img_url,
            imagekit_file_id=ik_file_id,
            file_size_bytes=len(contents),
            file_format=file.content_type or "image/png",
            note=note,
            created_at=now,
            updated_at=now,
        )
        try:
            await design_img.insert()
            break
        except DuplicateKeyError:
            logger.warning(f"Duplicate image_code {img_code}, retrying with new suffix")
            try:
                await imagekit_delete(ik_file_id)
            except Exception:
                pass

    logger.info(f"Uploaded {image_type} image: {img_code} -> {img_url[:60]}...")
    return _serialize_image(design_img)
