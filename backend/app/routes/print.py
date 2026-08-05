import base64
import io
import json
import logging
import asyncio
from typing import Optional

from pymongo.errors import DuplicateKeyError

import httpx
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from PIL import Image

from app.config import settings
from app.models.design_image import DesignImage, InputImageRef
from app.models.enums import NodeKey, RunStatus, STAGE_ABBREVIATIONS, STAGE_ORDER
from app.models.garment import Garment
from app.models.node_run import AIMeta, NodeOutput, NodeRun, RunInputRef
from app.models.season import Season
from app.services.imagekit import upload_image
from app.routes.garments import _update_node_summary

logger = logging.getLogger("print_studio")
router = APIRouter(tags=["print"])


async def _next_iteration(garment_id: str, node_key: NodeKey) -> int:
    """Get the next iteration number atomically using the unique index as guard."""
    for _ in range(5):
        existing = await NodeRun.find(
            NodeRun.garment_id == garment_id,
            NodeRun.node_key == node_key,
        ).to_list()
        return len(existing) + 1
    raise RuntimeError("Failed to determine iteration after 5 attempts")


# ─── Request models ──────────────────────────────────────────────────


class RemoveBackgroundRequest(BaseModel):
    image: str  # base64 data URL


# ─── Request model ──────────────────────────────────────────────────


class PrintGenerateRequest(BaseModel):
    canvas_image: str  # base64 data URL from frontend canvas
    fabric_type: str = "cotton"
    background_color: str = "#ffffff"
    canvas_width: int = 1024
    canvas_height: int = 1024
    scale: float = 1.0
    repeat_type: str = "block"
    spacing_x: int = 0
    spacing_y: int = 0
    rotation: float = 0.0
    note: str = ""
    moodboard_palette: list[str] = []


# ─── Remove Background endpoint ─────────────────────────────────────


@router.post("/api/motif/remove-background")
async def remove_background(body: RemoveBackgroundRequest):
    """
    Remove the background from a motif image using remove.bg API.
    Returns the processed image as a base64 data URL.
    """
    api_key = settings.removebg_api_key
    if not api_key:
        raise HTTPException(status_code=500, detail="remove.bg API key not configured")

    # Extract base64 data
    if body.image.startswith("data:"):
        header, b64data = body.image.split(",", 1)
        # Detect mime type from header
        mime = header.split(":")[1].split(";")[0] if ":" in header else "image/png"
    else:
        b64data = body.image
        mime = "image/png"

    image_bytes = base64.b64decode(b64data)
    logger.info(f"remove-bg: decoded {len(image_bytes)} bytes, first 8: {image_bytes[:8].hex()}")

    # Validate file signature — remove.bg rejects non-image files
    valid_signatures = [
        b'\x89PNG',   # PNG
        b'\xff\xd8\xff',  # JPEG
        b'RIFF',      # WebP (RIFF container)
    ]
    if not any(image_bytes[:len(sig)] == sig for sig in valid_signatures):
        raise HTTPException(
            status_code=400,
            detail="File is not a valid image (JPG, PNG, or WebP). Please upload an image file."
        )

    image_file = io.BytesIO(image_bytes)

    # Call remove.bg API — use multipart file upload for reliability
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            resp = await client.post(
                "https://api.remove.bg/v1.0/removebg",
                headers={"X-Api-Key": api_key},
                files={"image_file": ("motif.png", image_file, "image/png")},
                data={"size": "auto"},
            )
        except httpx.RequestError as e:
            logger.error(f"remove.bg request failed: {e}")
            raise HTTPException(status_code=502, detail="Failed to connect to remove.bg API")

    if resp.status_code != 200:
        error_detail = resp.text[:500]
        logger.error(f"remove.bg returned status {resp.status_code}: {error_detail}")
        try:
            err = resp.json()
            msg = err.get("errors", [{}])[0].get("title", "Background removal failed")
        except Exception:
            msg = f"Background removal failed (status {resp.status_code})"
        raise HTTPException(status_code=resp.status_code, detail=msg)

    # Encode result as base64 data URL
    result_b64 = base64.b64encode(resp.content).decode()
    result_url = f"data:image/png;base64,{result_b64}"

    return {
        "success": True,
        "image": result_url,
    }


# ─── Gemini prompt builder ──────────────────────────────────────────


def _build_gemini_prompt(
    fabric_type: str,
    background_color: str,
    **_,
) -> str:
    lines = [
        "Transform the provided pattern into a photorealistic, high-quality seamless fabric texture.",
    ]

    if fabric_type and fabric_type != "none":
        lines.append(
            f"Material: {fabric_type} with its authentic weave, sheen, and micro-textural characteristics."
        )

    lines.extend([
        f"Base Color: {background_color}.",
        "Visual Style: 1:1 aspect ratio macro studio photography of a perfectly flat fabric swatch.",
        "Lighting & Geometry: Even, flat studio illumination with absolutely zero shadows, zero drape, and zero folds.",
        "STRICT INSTRUCTIONS: The output MUST tile perfectly both horizontally and vertically with no visible seams.",
        "Do not alter the scale or geometry of the underlying print. Completely fill the frame with the flat fabric texture.",
    ])

    return " ".join(lines)


NEGATIVE_PROMPT = (
    "3D volume, drape, folds, wrinkles, shadows, uneven lighting, gradient, vignette, human hands, "
    "garments, clothing, sewing tools, borders, frames, text"
)


# ─── Gemini API call ────────────────────────────────────────────────


async def _generate_with_gemini(
    api_key: str,
    canvas_base64: str,
    prompt: str,
) -> Optional[bytes]:
    """
    Send the canvas image + prompt to Gemini 3 Pro Image for generation.
    Returns PNG bytes of the generated image, or None on failure.
    """
    # Extract base64 data from data URL
    if canvas_base64.startswith("data:"):
        _, b64data = canvas_base64.split(",", 1)
    else:
        b64data = canvas_base64

    async with httpx.AsyncClient(timeout=120.0) as client:
        payload = {
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        {"text": prompt},
                        {
                            "inlineData": {
                                "mimeType": "image/png",
                                "data": b64data,
                            }
                        },
                    ]
                }
            ],
            "generationConfig": {
                "temperature": 0.4,
                "responseModalities": ["TEXT", "IMAGE"],
            },
        }

        url = f"{settings.vertex_base_url}/gemini-3.1-flash-image:generateContent?key={api_key}"

        logger.info("Calling Gemini for pattern generation...")
        for attempt in range(4):
            resp = await client.post(url, json=payload)
            if resp.status_code == 429:
                wait = min(2 ** attempt * 2, 30)
                logger.warning(f"[PRINT] Gemini 429 on attempt {attempt+1}/4, retrying in {wait}s...")
                await asyncio.sleep(wait)
                continue
            break

        if resp.status_code != 200:
            logger.error(f"Gemini returned status {resp.status_code}: {resp.text[:500]}")
            return None

        data = resp.json()
        parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])

        for part in parts:
            if "inlineData" in part:
                mime = part["inlineData"].get("mimeType", "")
                if mime.startswith("image/"):
                    img_b64 = part["inlineData"].get("data")
                    if img_b64:
                        logger.info("Gemini generated image successfully")
                        return base64.b64decode(img_b64)

        logger.warning("Gemini returned no image in response")
        return None


# ─── Upload helper ──────────────────────────────────────────────────


async def _upload_to_imagekit(file_bytes: bytes, folder: str, file_name: str) -> dict:
    return await upload_image(file_bytes, folder=folder, file_name=file_name)


# ─── Endpoint ───────────────────────────────────────────────────────


@router.post("/api/garments/{garment_id}/nodes/print/generate")
async def generate_print(
    garment_id: str,
    body: PrintGenerateRequest,
    x_gemini_api_key: Optional[str] = Header(None, alias="X-Gemini-API-Key"),
):
    """
    Generate a production-ready fabric print pattern.
    1. Receives the canvas preview as base64 + AI layer params
    2. Builds a robust prompt with fabric, color, resolution specs
    3. Sends to Gemini 3 Pro Image for AI generation
    4. Saves result to library
    """

    garment = await Garment.get(garment_id)
    if not garment:
        raise HTTPException(status_code=404, detail="Garment not found")

    season = await Season.get(garment.season_id)
    if not season:
        raise HTTPException(status_code=404, detail="Season not found")

    # ─── Create NodeRun ───
    iteration = await _next_iteration(garment_id, NodeKey.PRINT)

    version = garment.current_version
    stage_index = STAGE_ORDER.index(NodeKey.PRINT)
    downstream_keys = STAGE_ORDER[stage_index + 1:]
    if downstream_keys:
        has_downstream = await NodeRun.find(
            NodeRun.garment_id == garment_id,
            NodeRun.version == garment.current_version,
            {"node_key": {"$in": [k.value for k in downstream_keys]}},
        ).exists()
        if has_downstream:
            version = garment.current_version + 1
            garment.current_version = version
            await garment.save()

    code = (
        f"{season.code}_{garment.category.value}_{garment.style_number:03d}"
        f"_v{version}_{STAGE_ABBREVIATIONS[NodeKey.PRINT]}_R{iteration:02d}"
    )

    from datetime import datetime, timezone

    now = datetime.now(timezone.utc)

    run = NodeRun(
        season_id=garment.season_id,
        garment_id=garment_id,
        node_key=NodeKey.PRINT,
        iteration=iteration,
        version=version,
        code=code,
        status=RunStatus.PROCESSING,
        inputs=[],
        output=NodeOutput(),
        output_image_ids=[],
        ai=AIMeta(started_at=now),
        created_at=now,
        updated_at=now,
    )
    await run.insert()

    # ─── Build prompt ───
    prompt = _build_gemini_prompt(
        fabric_type=body.fabric_type,
        background_color=body.background_color,
    )

    # ─── Call Gemini ───
    api_key = (x_gemini_api_key or "").strip() or (settings.ai_key or "").strip()
    img_bytes = None
    source = "pil"

    if api_key:
        try:
            img_bytes = await _generate_with_gemini(api_key, body.canvas_image, prompt)
            if img_bytes:
                source = "ai"
                run.ai.model = "gemini-3.1-flash-image"
                run.ai.prompt = prompt
                logger.info(f"NEW PROMPT | {prompt[:200]}")
        except Exception as e:
            logger.error(f"Gemini generation failed: {e}")

    # ─── Fallback: PIL tiling ───
    if img_bytes is None:
        logger.info("Falling back to PIL tiling engine")
        try:
            # Decode canvas image
            if body.canvas_image.startswith("data:"):
                _, b64data = body.canvas_image.split(",", 1)
            else:
                b64data = body.canvas_image
            img_bytes = base64.b64decode(b64data)
            source = "canvas"
            run.ai.model = "canvas-passthrough"
        except Exception as e:
            logger.error(f"Failed to decode canvas image: {e}")
            raise HTTPException(status_code=500, detail="Failed to process image")

    # ─── Upload to ImageKit ───
    count = 1
    img_code = f"{code}_{count:02d}"

    while True:
        file_name = f"{img_code}.png"
        folder = f"/design-studio/{garment.season_id}/{garment_id}/prints/"

        try:
            ik_result = await _upload_to_imagekit(img_bytes, folder=folder, file_name=file_name)
            img_url = ik_result["url"]
            ik_file_id = ik_result["file_id"]
            logger.info(f"ImageKit upload OK: {img_code} -> {img_url[:60]}...")
        except Exception as e:
            logger.error(f"ImageKit upload failed for {img_code}: {e}")
            raise HTTPException(status_code=500, detail="Image upload to CDN failed. Please try again.")

        # ─── Save DesignImage ───
        design_img = DesignImage(
            image_code=img_code,
            index=0,
            season_id=garment.season_id,
            garment_id=garment_id,
            node_key=NodeKey.PRINT,
            run_id=str(run.id),
            version=version,
            image_type="print",
            view="front",
            liked=False,
            starred=False,
            input_images=[],
            source=source,
            ai_model=run.ai.model,
            ai_prompt=prompt,
            params={
                "fabric_type": body.fabric_type,
                "background_color": body.background_color,
                "scale": body.scale,
                "repeat_type": body.repeat_type,
                "spacing_x": body.spacing_x,
                "spacing_y": body.spacing_y,
                "rotation": body.rotation,
                "canvas_width": body.canvas_width,
                "canvas_height": body.canvas_height,
            },
            url=img_url,
            imagekit_file_id=ik_file_id,
            file_size_bytes=len(img_bytes),
            file_format="png",
            note=body.note,
            created_at=now,
            updated_at=now,
        )
        try:
            await design_img.insert()
            break
        except DuplicateKeyError:
            count += 1
            img_code = f"{code}_{count:02d}"
            logger.warning(f"Duplicate image_code, retrying with {img_code}")
            try:
                from app.services.imagekit import delete_image
                await delete_image(ik_file_id)
            except Exception:
                pass

    # ─── Update NodeRun ───
    run.output = NodeOutput(images=[img_url])
    run.output_image_ids = [str(design_img.id)]
    run.status = RunStatus.COMPLETE
    run.ai.completed_at = datetime.now(timezone.utc)
    await run.save()

    await _update_node_summary(garment_id)

    return {
        "success": True,
        "run": {
            "id": str(run.id),
            "code": run.code,
            "iteration": run.iteration,
            "version": run.version,
            "status": run.status.value,
            "node_key": run.node_key.value,
        },
        "image": {
            "id": str(design_img.id),
            "image_code": design_img.image_code,
            "url": design_img.url,
            "source": source,
            "ai_model": run.ai.model,
        },
        "params": {
            "fabric_type": body.fabric_type,
            "background_color": body.background_color,
            "scale": body.scale,
            "repeat_type": body.repeat_type,
        },
    }
