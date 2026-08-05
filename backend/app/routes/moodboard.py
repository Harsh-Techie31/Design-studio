import logging
import re
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, UploadFile, File, Form

from app.models.season import Season, MoodboardImage
from app.models.enums import ImageSource, MoodboardStatus
from app.services.imagekit import upload_image, delete_image
from app.services.gemini import analyze_moodboard as gemini_analyze

logger = logging.getLogger("moodboard")

router = APIRouter(prefix="/api/seasons", tags=["moodboard"])


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _sanitize_error(exc: Exception) -> str:
    """Convert an exception to a user-safe error message, stripping secrets."""
    raw = str(exc)

    # Strip API keys from URLs (e.g. ?key=XXXX or &key=XXXX)
    sanitized = re.sub(r'[?&]key=[A-Za-z0-9_\-]+', '', raw)

    # Map known error patterns to friendly messages
    lower = raw.lower()
    if "400" in lower and ("bad request" in lower or "invalid" in lower):
        return "The analysis service rejected the request. Please try again or upload different images."
    if "403" in lower or "permission" in lower:
        return "Access denied. Please check your API configuration."
    if "429" in lower or "rate" in lower or "quota" in lower:
        return "Too many requests. Please wait a moment and try again."
    if "timeout" in lower or "timed out" in lower:
        return "The analysis took too long. Please try again with fewer images."
    if "500" in lower or "502" in lower or "503" in lower:
        return "The analysis service is temporarily unavailable. Please try again later."
    if "connection" in lower or "connect" in lower:
        return "Could not reach the analysis service. Please check your connection."

    # Fallback: return sanitized string (no API keys) truncated for safety
    return sanitized[:200] if sanitized else "An unexpected error occurred."


def _serialize_moodboard(season: Season) -> dict:
    return {
        "name": season.moodboard.name,
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
async def upload_moodboard_images(
    season_id: str,
    files: list[UploadFile] = File(...),
    name: str | None = Form(None),
):
    logger.info(f"POST /api/seasons/{season_id}/moodboard/images — {len(files)} file(s)")
    season = await Season.get(season_id)
    if not season:
        logger.error(f"Season {season_id} not found")
        raise HTTPException(status_code=404, detail="Season not found")

    if name is not None and name.strip():
        season.moodboard.name = name.strip()

    if len(season.moodboard.images) + len(files) > 12:
        logger.error(f"Too many images: {len(season.moodboard.images)} existing + {len(files)} new")
        raise HTTPException(status_code=400, detail="Moodboard can have at most 12 images")

    ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

    uploaded = []
    base_order = len(season.moodboard.images)

    for i, file in enumerate(files):
        # Validate MIME type
        if file.content_type and file.content_type not in ALLOWED_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file type '{file.content_type}'. Allowed: JPEG, PNG, WebP, GIF."
            )

        file_bytes = await file.read()

        # Validate file size
        if len(file_bytes) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"File '{file.filename}' exceeds 10MB limit ({len(file_bytes)} bytes)."
            )

        ext = file.filename.rsplit(".", 1)[-1] if file.filename and "." in file.filename else "png"
        file_name = f"moodboard_{season_id}_{uuid.uuid4().hex[:8]}.{ext}"

        logger.info(f"Uploading to ImageKit: {file_name} ({len(file_bytes)} bytes)")
        result = await upload_image(file_bytes, folder="/moodboard/", file_name=file_name)
        logger.info(f"ImageKit upload OK: {result['url'][:60]}...")

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
    logger.info(f"Season {season_id} now has {len(season.moodboard.images)} images, status={season.moodboard.status.value}")

    return {"images": uploaded, "moodboard": _serialize_moodboard(season)}


@router.delete("/{season_id}/moodboard/images/{image_index}")
async def delete_moodboard_image(season_id: str, image_index: int):
    logger.info(f"DELETE /api/seasons/{season_id}/moodboard/images/{image_index}")
    season = await Season.get(season_id)
    if not season:
        raise HTTPException(status_code=404, detail="Season not found")

    if image_index < 0 or image_index >= len(season.moodboard.images):
        raise HTTPException(status_code=404, detail="Image index out of range")

    img = season.moodboard.images[image_index]

    if img.imagekit_file_id:
        try:
            await delete_image(img.imagekit_file_id)
        except Exception as e:
            logger.warning(f"Failed to delete ImageKit file {img.imagekit_file_id}: {e}")

    season.moodboard.images.pop(image_index)

    for i, remaining in enumerate(season.moodboard.images):
        remaining.order = i

    if len(season.moodboard.images) == 0:
        season.moodboard.status = MoodboardStatus.EMPTY

    season.updated_at = _now()
    await season.save()

    return {"moodboard": _serialize_moodboard(season)}


@router.post("/{season_id}/moodboard/analyze")
async def analyze_moodboard(season_id: str):
    logger.info(f"POST /api/seasons/{season_id}/moodboard/analyze — START")
    season = await Season.get(season_id)
    if not season:
        logger.error(f"Season {season_id} not found")
        raise HTTPException(status_code=404, detail="Season not found")

    if len(season.moodboard.images) == 0:
        logger.error(f"No images to analyze for season {season_id}")
        raise HTTPException(status_code=400, detail="No images to analyze")

    image_urls = [img.url for img in season.moodboard.images]
    real_urls = [u for u in image_urls if not u.startswith("mood-placeholder:")]
    logger.info(f"Season {season_id}: {len(image_urls)} total images, {len(real_urls)} real URLs")

    season.moodboard.status = MoodboardStatus.ANALYZING
    season.updated_at = _now()
    await season.save()
    logger.info(f"Status set to 'analyzing'")

    try:
        logger.info(f"Calling Gemini API with {len(real_urls)} images...")
        result = await gemini_analyze(real_urls)
        logger.info(f"Gemini returned: palette={result['palette']}, keywords={result['keywords'][:3]}..., brief={result['brief'][:50]}...")

        season.moodboard.analysis.palette = result["palette"]
        season.moodboard.analysis.keywords = result["keywords"]
        season.moodboard.analysis.brief = result["brief"]
        season.moodboard.analysis.model = result["model"]
        season.moodboard.analysis.analyzed_at = _now()
        season.moodboard.analysis.error = None
        season.moodboard.status = MoodboardStatus.READY
        logger.info(f"Analysis saved, status set to 'ready'")

    except Exception as e:
        logger.error(f"Gemini analysis failed: {type(e).__name__}: {e}")
        season.moodboard.status = MoodboardStatus.FAILED
        season.moodboard.analysis.error = _sanitize_error(e)

    season.updated_at = _now()
    await season.save()

    return {"moodboard": _serialize_moodboard(season)}
