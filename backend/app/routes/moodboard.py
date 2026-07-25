import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, UploadFile, File

from app.models.season import Season, MoodboardImage
from app.models.enums import ImageSource, MoodboardStatus
from app.services.imagekit import upload_image, delete_image

router = APIRouter(prefix="/api/seasons", tags=["moodboard"])


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _serialize_moodboard(season: Season) -> dict:
    return {
        "status": season.moodboard.status.value,
        "images": [
            {
                "url": img.url,
                "imagekit_file_id": img.imagekit_file_id,
                "source": img.source.value,
                "order": img.order,
            }
            for img in season.moodboard.images
        ],
        "analysis": {
            "palette": season.moodboard.analysis.palette,
            "keywords": season.moodboard.analysis.keywords,
            "brief": season.moodboard.analysis.brief,
            "model": season.moodboard.analysis.model,
            "analyzed_at": season.moodboard.analysis.analyzed_at.isoformat() if season.moodboard.analysis.analyzed_at else None,
            "error": season.moodboard.analysis.error,
        },
    }


@router.post("/{season_id}/moodboard/images")
async def upload_moodboard_images(season_id: str, files: list[UploadFile] = File(...)):
    season = await Season.get(season_id)
    if not season:
        raise HTTPException(status_code=404, detail="Season not found")

    if len(season.moodboard.images) + len(files) > 12:
        raise HTTPException(status_code=400, detail="Moodboard can have at most 12 images")

    uploaded = []
    base_order = len(season.moodboard.images)

    for i, file in enumerate(files):
        file_bytes = await file.read()
        ext = file.filename.rsplit(".", 1)[-1] if file.filename and "." in file.filename else "png"
        file_name = f"moodboard_{season_id}_{uuid.uuid4().hex[:8]}.{ext}"

        result = upload_image(file_bytes, folder="/moodboard/", file_name=file_name)

        img = MoodboardImage(
            url=result["url"],
            imagekit_file_id=result["file_id"],
            source=ImageSource.UPLOAD,
            order=base_order + i,
        )
        season.moodboard.images.append(img)
        uploaded.append({
            "url": result["url"],
            "imagekit_file_id": result["file_id"],
            "source": "upload",
            "order": base_order + i,
        })

    if season.moodboard.status == MoodboardStatus.EMPTY:
        season.moodboard.status = MoodboardStatus.UPLOADING

    season.updated_at = _now()
    await season.save()

    return {"images": uploaded, "moodboard": _serialize_moodboard(season)}


@router.delete("/{season_id}/moodboard/images/{image_index}")
async def delete_moodboard_image(season_id: str, image_index: int):
    season = await Season.get(season_id)
    if not season:
        raise HTTPException(status_code=404, detail="Season not found")

    if image_index < 0 or image_index >= len(season.moodboard.images):
        raise HTTPException(status_code=404, detail="Image index out of range")

    img = season.moodboard.images[image_index]

    if img.imagekit_file_id:
        try:
            delete_image(img.imagekit_file_id)
        except Exception:
            pass

    season.moodboard.images.pop(image_index)

    for i, remaining in enumerate(season.moodboard.images):
        remaining.order = i

    if len(season.moodboard.images) == 0:
        season.moodboard.status = MoodboardStatus.EMPTY

    season.updated_at = _now()
    await season.save()

    return {"moodboard": _serialize_moodboard(season)}
