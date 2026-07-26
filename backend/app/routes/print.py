import base64
import io
import json
import logging
from typing import Optional

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

logger = logging.getLogger("print_studio")
router = APIRouter(tags=["print"])


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


# ─── Gemini prompt builder ──────────────────────────────────────────


def _build_gemini_prompt(
    fabric_type: str,
    background_color: str,
    canvas_width: int,
    canvas_height: int,
    scale: float,
    repeat_type: str,
    spacing_x: int,
    spacing_y: int,
    rotation: float,
    moodboard_palette: list[str],
) -> str:
    """
    Build a robust, detailed prompt for Gemini to generate a production-ready
    seamless fabric pattern. The prompt includes all design parameters and
    instructs Gemini to output a high-quality textile print.
    """

    palette_str = ", ".join(moodboard_palette) if moodboard_palette else "none provided"

    spacing_desc = "tightly packed, seamless, edge-to-edge pattern with zero visible gaps"
    if spacing_x > 20 or spacing_y > 20:
        spacing_desc = f"spaced-out layout with generous breathing room ({spacing_x}px horizontal, {spacing_y}px vertical gap) between each motif repeat"

    scale_desc = "delicate, intricate small-scale repeating print"
    if scale > 1.2:
        scale_desc = "bold, prominent large-scale focal-point pattern"
    elif scale < 0.4:
        scale_desc = "ultra-fine, highly dense micro-pattern"

    rotation_desc = "upright vertical alignment"
    if rotation != 0:
        rotation_desc = f"gracefully rotated {int(rotation)} degrees, creating a dynamic diagonal flow"

    repeat_desc = {
        "block": "standard grid repeat — motifs aligned in straight rows and columns",
        "half-drop": "half-drop repeat — every other column is offset vertically by 50%, creating a staggered cascade",
        "brick": "half-brick repeat — every other row is offset horizontally by 50%, like a brick wall pattern",
        "mirror": "mirror/diamond repeat — motifs are alternately flipped horizontally and vertically, creating kaleidoscopic symmetry",
    }.get(repeat_type, "standard grid repeat")

    prompt = f"""You are an expert fashion textile designer and masterprint artist creating a production-ready seamless fabric pattern.

TASK:
Generate a seamless, tileable fabric pattern image based on the provided canvas preview. The preview shows the desired layout, scale, rotation, and spacing of the motif. Your job is to transform this into a polished, production-quality textile print.

DESIGN SPECIFICATIONS:
- Fabric Type: {fabric_type} — render the pattern with the characteristic texture and drape of {fabric_type} fabric
- Background Color: {background_color} — this is the base fabric color; the motif pattern sits on top of this
- Export Resolution: {canvas_width}x{canvas_height} pixels — generate at this exact size
- Scale: {scale}x — {scale_desc}
- Repeat Type: {repeat_desc}
- Spacing: {spacing_desc}
- Rotation: {rotation_desc}
- Moodboard Palette: {palette_str} — if any of these colors appear in the motif, ensure they are preserved and harmonized

QUALITY REQUIREMENTS:
1. SEAMLESS TILING: The output MUST tile perfectly both horizontally and vertically. The left edge must match the right edge, and the top edge must match the bottom edge. No visible seams, no offset shifts, no broken motifs at tile boundaries.
2. TEXTURE AUTHENTICITY: Render the {fabric_type} fabric texture realistically — include subtle weave patterns, sheen, drape characteristics, and material-specific visual qualities that make it look like real {fabric_type}.
3. COLOR HARMONY: The motif colors should complement the {background_color} background. If the moodboard palette was provided, ensure color coherence with those reference tones.
4. PATTERN DENSITY: Fill the canvas completely with the pattern. No large empty areas, no awkward gaps. Every pixel should contribute to the textile design.
5. PRODUCTION QUALITY: This output will be used for actual fabric printing. Ensure clean edges, consistent color values, and professional-grade output suitable for textile manufacturing.

OUTPUT:
Generate a single seamless tileable fabric pattern image at {canvas_width}x{canvas_height} pixels. The image should be a complete, self-contained fabric swatch that tiles perfectly when repeated."""

    return prompt


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

        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"

        logger.info("Calling Gemini 3 Pro Image for pattern generation...")
        resp = await client.post(url, json=payload)

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


def _upload_to_imagekit(file_bytes: bytes, folder: str, file_name: str) -> dict:
    return upload_image(file_bytes, folder=folder, file_name=file_name)


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
    existing = await NodeRun.find(
        NodeRun.garment_id == garment_id,
        NodeRun.node_key == NodeKey.PRINT,
    ).to_list()
    iteration = len(existing) + 1

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
        canvas_width=body.canvas_width,
        canvas_height=body.canvas_height,
        scale=body.scale,
        repeat_type=body.repeat_type,
        spacing_x=body.spacing_x,
        spacing_y=body.spacing_y,
        rotation=body.rotation,
        moodboard_palette=body.moodboard_palette,
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
                run.ai.model = "gemini-2.5-flash"
                run.ai.prompt = prompt
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
    img_code = f"{code}_01"
    file_name = f"{img_code}.png"
    folder = f"/design-studio/{garment.season_id}/{garment_id}/prints/"

    try:
        ik_result = _upload_to_imagekit(img_bytes, folder=folder, file_name=file_name)
        img_url = ik_result["url"]
        ik_file_id = ik_result["file_id"]
        logger.info(f"ImageKit upload OK: {img_code} -> {img_url[:60]}...")
    except Exception as e:
        logger.error(f"ImageKit upload failed for {img_code}: {e}")
        b64 = base64.b64encode(img_bytes).decode()
        img_url = f"data:image/png;base64,{b64}"
        ik_file_id = None

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
    await design_img.insert()

    # ─── Update NodeRun ───
    run.output = NodeOutput(images=[img_url])
    run.output_image_ids = [str(design_img.id)]
    run.status = RunStatus.COMPLETE
    run.ai.completed_at = datetime.now(timezone.utc)
    await run.save()

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
