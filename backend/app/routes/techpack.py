import base64
import io
import logging
from typing import Optional

import httpx
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from PIL import Image, ImageDraw, ImageFont

from app.config import settings
from app.models.design_image import DesignImage, InputImageRef
from app.models.enums import NodeKey, RunStatus, STAGE_ABBREVIATIONS, STAGE_ORDER
from app.models.garment import Garment
from app.models.node_run import AIMeta, NodeOutput, NodeRun, RunInputRef
from app.models.season import Season
from app.services.imagekit import upload_image
from app.routes.garments import _update_node_summary

logger = logging.getLogger("techpack_studio")
router = APIRouter(tags=["techpack"])


async def _next_iteration(garment_id: str, node_key: NodeKey) -> int:
    """Get the next iteration number atomically using the unique index as guard."""
    for _ in range(5):
        existing = await NodeRun.find(
            NodeRun.garment_id == garment_id,
            NodeRun.node_key == node_key,
        ).to_list()
        return len(existing) + 1
    raise RuntimeError("Failed to determine iteration after 5 attempts")


# ─── Request model ──────────────────────────────────────────────────


class TechPackGenerateRequest(BaseModel):
    render_image_id: str  # DesignImage ID from library (the selected render)
    gender: str = "male"
    construction: dict[str, str] = {}  # e.g. {"Waistband": "Curtain", "Fly": "Zip fly"}
    stitch_type: str = "Lockstitch"
    seam_type: str = "Plain seam"
    bom: dict[str, str] = {}  # e.g. {"Main fabric": "Olive floral twill", "Thread": "Tex-40"}
    measurements: dict[str, int] = {}  # e.g. {"Waist": 94, "Hip": 110}
    construction_notes: str = ""
    num_outputs: int = 1
    note: str = ""


# ─── PIL Tech Pack Assembly ─────────────────────────────────────────


def _load_image_from_bytes(data: bytes, max_w: int, max_h: int) -> Image.Image:
    """Load an image from bytes, resize to fit within max dimensions."""
    try:
        img = Image.open(io.BytesIO(data)).convert("RGB")
        img.thumbnail((max_w, max_h), Image.Resampling.LANCZOS)
        return img
    except Exception as e:
        logger.error(f"Failed to load image: {e}")
        fallback = Image.new("RGB", (max_w, max_h), (255, 255, 255))
        draw = ImageDraw.Draw(fallback)
        draw.text((10, max_h // 2 - 5), "[Image unavailable]", fill=(180, 180, 180))
        return fallback


def _draw_techpack(
    sketch_bytes: bytes | None,
    fabric_bytes: list[bytes],
    render_bytes: bytes | None,
    category: str,
    gender: str,
    style_code: str,
    construction: dict[str, str],
    stitch_type: str,
    seam_type: str,
    bom: dict[str, str],
    measurements: dict[str, int],
    construction_notes: str,
) -> Image.Image:
    """
    Assembles a landscape tech pack document (1200x900) using PIL.
    Layout: Header | Sketch | Fabrics+Construction | Measurements | BOM
    """
    W, H = 1200, 900
    canvas = Image.new("RGB", (W, H), (245, 242, 235))
    draw = ImageDraw.Draw(canvas)

    border = (40, 40, 40)
    text = (25, 25, 25)
    accent = (130, 95, 45)
    muted = (130, 125, 115)
    line_color = (210, 205, 195)

    font = ImageFont.load_default()

    # ─── 1. HEADER ───────────────────────────────────────────────
    draw.rectangle([(0, 0), (W, 60)], fill=(234, 230, 220), outline=border, width=2)
    draw.text((20, 20), "TECH PACK", fill=accent, font=font)
    draw.text((200, 22), f"{style_code}", fill=text, font=font)
    draw.text((500, 22), f"{category.upper()} — {gender.upper()}", fill=muted, font=font)

    # ─── 2. FLAT SKETCH (left: 0-380, y:60-420) ─────────────────
    draw.rectangle([(0, 60), (380, 420)], fill=(255, 255, 255), outline=border, width=2)
    draw.text((15, 70), "FLAT SKETCH", fill=accent, font=font)

    if sketch_bytes:
        sketch_img = _load_image_from_bytes(sketch_bytes, 350, 310)
        sx = 15 + (350 - sketch_img.width) // 2
        sy = 95 + (310 - sketch_img.height) // 2
        canvas.paste(sketch_img, (sx, sy))

    # ─── 3. FABRICS & CONSTRUCTION (middle: 380-780, y:60-420) ──
    draw.rectangle([(380, 60), (780, 420)], fill=(255, 255, 255), outline=border, width=2)
    draw.text((395, 70), "FABRICS & CONSTRUCTION", fill=accent, font=font)

    # Fabric swatches
    if fabric_bytes:
        swatch_x = 395
        for i, fb in enumerate(fabric_bytes[:3]):
            fab_img = _load_image_from_bytes(fb, 80, 80)
            canvas.paste(fab_img, (swatch_x + i * 90, 100))
            draw.rectangle([(swatch_x + i * 90, 100), (swatch_x + i * 90 + 80, 180)], outline=border, width=1)
    else:
        draw.text((395, 120), "[No fabric swatches]", fill=muted, font=font)

    # Construction summary
    cy = 200
    draw.text((395, cy), "CONSTRUCTION", fill=accent, font=font)
    cy += 18
    for field, value in list(construction.items())[:6]:
        draw.text((395, cy), f"{field}:", fill=accent, font=font)
        draw.text((520, cy), value, fill=text, font=font)
        cy += 18

    draw.text((395, cy + 5), f"Stitch: {stitch_type}", fill=text, font=font)
    draw.text((395, cy + 22), f"Seam: {seam_type}", fill=text, font=font)

    if construction_notes:
        draw.text((395, cy + 45), "NOTES:", fill=accent, font=font)
        notes_text = construction_notes[:60] + ("..." if len(construction_notes) > 60 else "")
        draw.text((395, cy + 62), notes_text, fill=muted, font=font)

    # ─── 4. MEASUREMENTS (right: 780-1200, y:60-420) ────────────
    draw.rectangle([(780, 60), (W, 420)], fill=(250, 248, 242), outline=border, width=2)
    draw.text((795, 70), "MEASUREMENTS (cm)", fill=accent, font=font)

    # Table header
    draw.rectangle([(795, 95), (W - 20, 115)], fill=(230, 225, 215))
    draw.text((805, 100), "POINT", fill=accent, font=font)
    draw.text((980, 100), "SPEC", fill=accent, font=font)
    draw.text((1080, 100), "TOL", fill=accent, font=font)

    my = 125
    for field, value in list(measurements.items())[:12]:
        draw.text((805, my), field, fill=text, font=font)
        draw.text((990, my), str(value), fill=text, font=font)
        draw.text((1090, my), "1.0", fill=muted, font=font)
        draw.line([(795, my + 15), (W - 20, my + 15)], fill=line_color, width=1)
        my += 22

    # ─── 5. BOM TABLE (bottom: 0-780, y:420-900) ────────────────
    draw.rectangle([(0, 420), (780, H)], fill=(250, 248, 242), outline=border, width=2)
    draw.text((15, 435), "BILL OF MATERIALS", fill=accent, font=font)

    # Table header
    draw.rectangle([(15, 460), (765, 480)], fill=(230, 225, 215))
    draw.text((25, 465), "COMPONENT", fill=accent, font=font)
    draw.text((300, 465), "DESCRIPTION", fill=accent, font=font)

    by = 490
    for component, description in bom.items():
        draw.text((25, by), component, fill=accent, font=font)
        desc_text = (description or "Not specified")[:50]
        draw.text((300, by), desc_text, fill=text, font=font)
        draw.line([(15, by + 18), (765, by + 18)], fill=line_color, width=1)
        by += 24
        if by > H - 30:
            break

    # ─── 6. RENDER PREVIEW (bottom right: 780-1200, y:420-900) ──
    draw.rectangle([(780, 420), (W, H)], fill=(255, 255, 255), outline=border, width=2)
    draw.text((795, 435), "STYLE RENDER", fill=accent, font=font)

    if render_bytes:
        render_img = _load_image_from_bytes(render_bytes, 380, 430)
        rx = 795 + (380 - render_img.width) // 2
        ry = 465 + (400 - render_img.height) // 2
        canvas.paste(render_img, (rx, ry))
    else:
        draw.text((840, 650), "[No render available]", fill=muted, font=font)

    return canvas


# ─── Helpers ─────────────────────────────────────────────────────────


async def _fetch_image_bytes(url: str) -> bytes | None:
    """Fetch image bytes from a URL (ImageKit or data URL)."""
    if url.startswith("data:"):
        _, b64data = url.split(",", 1)
        return base64.b64decode(b64data)
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                return resp.content
    except Exception as e:
        logger.warning(f"Failed to fetch image from {url[:60]}: {e}")
    return None


async def _upload_to_imagekit(file_bytes: bytes, folder: str, file_name: str) -> dict:
    return await upload_image(file_bytes, folder=folder, file_name=file_name)


# ─── Endpoint ───────────────────────────────────────────────────────


@router.post("/api/garments/{garment_id}/nodes/techPack/generate")
async def generate_techpack(
    garment_id: str,
    body: TechPackGenerateRequest,
    x_gemini_api_key: Optional[str] = Header(None, alias="X-Gemini-API-Key"),
):
    """
    Generate a factory-ready tech pack image.
    Uses PIL to assemble a structured 1200x900 landscape document with:
    - Flat sketch with callout annotations
    - Fabric swatches + construction summary
    - Measurement spec table
    - BOM table
    - Style render
    """

    garment = await Garment.get(garment_id)
    if not garment:
        raise HTTPException(status_code=404, detail="Garment not found")

    season = await Season.get(garment.season_id)
    if not season:
        raise HTTPException(status_code=404, detail="Season not found")

    # ─── Create NodeRun ───
    iteration = await _next_iteration(garment_id, NodeKey.TECH_PACK)

    version = garment.current_version
    stage_index = STAGE_ORDER.index(NodeKey.TECH_PACK)
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
        f"_v{version}_{STAGE_ABBREVIATIONS[NodeKey.TECH_PACK]}_R{iteration:02d}"
    )

    from datetime import datetime, timezone

    now = datetime.now(timezone.utc)

    run = NodeRun(
        season_id=garment.season_id,
        garment_id=garment_id,
        node_key=NodeKey.TECH_PACK,
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

    # ─── Resolve render and its lineage ───
    logger.info(f"TechPack: render_image_id={body.render_image_id}")
    render_img = await DesignImage.get(body.render_image_id)
    if not render_img:
        render_img = await DesignImage.find_one(
            DesignImage.id == body.render_image_id,
        )
    logger.info(f"TechPack: render_img found={render_img is not None}")
    if not render_img:
        # Try treating it as a URL directly
        render_url = body.render_image_id
        sketch_bytes = None
        fabric_bytes_list: list[bytes] = []
    else:
        render_url = render_img.url
        logger.info(f"TechPack: render input_images count={len(render_img.input_images)}")
        # Trace back to sketch and fabrics via input_images
        sketch_bytes = None
        fabric_bytes_list: list[bytes] = []

        for inp in render_img.input_images:
            # Skip fake/invalid IDs (not valid ObjectId hex strings)
            logger.info(f"TechPack: checking input ref image_id={inp.image_id} stage={inp.stage}")
            if not inp.image_id or len(inp.image_id) != 24:
                logger.info(f"TechPack: skipping invalid image_id={inp.image_id}")
                continue
            try:
                ref_img = await DesignImage.get(inp.image_id)
                if not ref_img:
                    ref_img = await DesignImage.find_one(DesignImage.id == inp.image_id)
                if ref_img:
                    logger.info(f"TechPack: found ref_img id={ref_img.id} url={ref_img.url[:60]}")
                    img_bytes = await _fetch_image_bytes(ref_img.url)
                    if img_bytes:
                        logger.info(f"TechPack: fetched {len(img_bytes)} bytes for stage={inp.stage}")
                        if inp.stage == NodeKey.SKETCH:
                            sketch_bytes = img_bytes
                        elif inp.stage == NodeKey.PRINT:
                            fabric_bytes_list.append(img_bytes)
                    else:
                        logger.warning(f"TechPack: failed to fetch bytes from {ref_img.url[:60]}")
                else:
                    logger.warning(f"TechPack: DesignImage.find_one returned None for id={inp.image_id}")
            except Exception as e:
                logger.error(f"TechPack: exception tracing input ref: {e}")
                pass

        # Fallback: if lineage didn't resolve, look up by node_key for this garment
        if not sketch_bytes:
            logger.info("TechPack: fallback - looking up sketch by node_key")
            sketch_ref = await DesignImage.find_one(
                DesignImage.garment_id == garment_id,
                DesignImage.node_key == NodeKey.SKETCH,
            ).sort([("created_at", -1)])
            if sketch_ref:
                logger.info(f"TechPack: fallback sketch found id={sketch_ref.id}")
                sketch_bytes = await _fetch_image_bytes(sketch_ref.url)

        if not fabric_bytes_list:
            logger.info("TechPack: fallback - looking up fabrics by node_key")
            fabric_refs = await DesignImage.find(
                DesignImage.garment_id == garment_id,
                DesignImage.node_key == NodeKey.PRINT,
            ).sort([("created_at", -1)]).limit(3).to_list()
            logger.info(f"TechPack: fallback found {len(fabric_refs)} fabric refs")
            for fab_ref in fabric_refs:
                fb = await _fetch_image_bytes(fab_ref.url)
                if fb:
                    fabric_bytes_list.append(fb)

    # Fetch render image bytes
    logger.info(f"TechPack: fetching render bytes from {render_url[:60] if render_url else 'None'}")
    render_bytes = await _fetch_image_bytes(render_url)
    logger.info(f"TechPack: render_bytes={len(render_bytes) if render_bytes else None}")

    # ─── Build style code ───
    style_code = f"{season.code}_{garment.category.value}_{garment.style_number:03d}_v{version}"

    # ─── Assemble tech pack with PIL ───
    try:
        logger.info(f"TechPack: assembling with sketch_bytes={'YES' if sketch_bytes else 'NO'}, fabric_bytes={len(fabric_bytes_list)}, render_bytes={'YES' if render_bytes else 'NO'}")
        techpack_img = _draw_techpack(
            sketch_bytes=sketch_bytes,
            fabric_bytes=fabric_bytes_list,
            render_bytes=render_bytes,
            category=garment.category.value,
            gender=body.gender,
            style_code=style_code,
            construction=body.construction,
            stitch_type=body.stitch_type,
            seam_type=body.seam_type,
            bom=body.bom,
            measurements=body.measurements,
            construction_notes=body.construction_notes,
        )

        # Convert to bytes
        buf = io.BytesIO()
        techpack_img.save(buf, format="PNG", quality=95)
        img_bytes = buf.getvalue()
        source = "pil"
        run.ai.model = "pil-v1"
    except Exception as e:
        logger.error(f"PIL tech pack assembly failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate tech pack")

    # ─── Upload to ImageKit ───
    img_code = f"{code}_01"
    file_name = f"{img_code}.png"
    folder = f"/design-studio/{garment.season_id}/{garment_id}/techpacks/"

    try:
        ik_result = await _upload_to_imagekit(img_bytes, folder=folder, file_name=file_name)
        img_url = ik_result["url"]
        ik_file_id = ik_result["file_id"]
        logger.info(f"ImageKit upload OK: {img_code} -> {img_url[:60]}...")
    except Exception as e:
        logger.error(f"ImageKit upload failed for {img_code}: {e}")
        raise HTTPException(status_code=500, detail="Image upload to CDN failed. Please try again.")

    # ─── Save DesignImage ───
    input_refs = []
    if body.render_image_id:
        input_refs.append(InputImageRef(image_id=body.render_image_id, stage=NodeKey.RENDER, role="primary"))

    design_img = DesignImage(
        image_code=img_code,
        index=0,
        season_id=garment.season_id,
        garment_id=garment_id,
        node_key=NodeKey.TECH_PACK,
        run_id=str(run.id),
        version=version,
        image_type="tech_pack",
        view="front",
        liked=False,
        starred=False,
        input_images=input_refs,
        source=source,
        ai_model=run.ai.model,
        ai_prompt=f"Tech pack for {garment.category.value} — {body.construction}",
        params={
            "gender": body.gender,
            "construction": body.construction,
            "stitch_type": body.stitch_type,
            "seam_type": body.seam_type,
            "bom": body.bom,
            "measurements": body.measurements,
            "construction_notes": body.construction_notes,
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
        "style_code": style_code,
    }
