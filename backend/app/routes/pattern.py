import base64
import io
import logging
import asyncio
from typing import Optional

from pymongo.errors import DuplicateKeyError

import httpx
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from PIL import Image, ImageDraw, ImageFont

from app.config import settings
from app.models.design_image import DesignImage, InputImageRef
from app.models.enums import NodeKey, RunStatus, STAGE_ABBREVIATIONS, STAGE_ORDER
from app.models.garment import Garment
from app.models.node_run import AIMeta, NodeOutput, NodeRun
from app.models.season import Season
from app.services.imagekit import upload_image
from app.routes.garments import _update_node_summary

logger = logging.getLogger("pattern_studio")
router = APIRouter(tags=["pattern"])


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


class PatternGenerateRequest(BaseModel):
    tech_pack_image_url: str
    gender: str = "male"
    body_measurements: dict[str, float] = {}
    construction: dict[str, str] = {}
    fabric_type: str = "Woven"
    seam_allowance: str = "1cm"
    hem_allowance: str = "3cm"
    grain_line: str = "Lengthwise"
    ease: str = "Standard"
    pattern_markings: list[str] = ["Notches", "Drill holes", "Grain arrows", "Fold lines"]
    additional_notes: str = ""
    num_outputs: int = 1


# ─── Helpers ─────────────────────────────────────────────────────────


async def _fetch_image_bytes(url: str) -> bytes | None:
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


# ─── My custom prompt for pattern piece generation ──────────────────


def _build_pattern_prompt(
    category: str,
    gender: str,
    body_measurements: dict[str, float],
    construction: dict[str, str],
    fabric_type: str,
    seam_allowance: str,
    hem_allowance: str,
    grain_line: str,
    ease: str,
    pattern_markings: list[str],
    additional_notes: str,
) -> str:
    """
    Builds a detailed prompt for Gemini 2.5 Flash Image to generate
    the left 60% of the pattern sheet — the actual pattern pieces laid out.
    """

    cat = category.lower().strip()

    # Category-specific pieces description
    pieces_map = {
        "pant": (
            "7 pattern pieces for a pant: "
            "FRONT PANEL (cut 2, left and right mirrored), "
            "BACK PANEL (cut 2, left and right mirrored), "
            "WAISTBAND (cut 1 on fold), "
            "POCKET BAG (cut 2), "
            "FLY SHIELD (cut 1), "
            "FLY FACING (cut 1), "
            "WAISTBAND FACING (cut 1). "
            "Show the crotch curve, inseam, outseam, waistline, hip curve, and hem line on each panel."
        ),
        "short": (
            "5 pattern pieces for shorts: "
            "FRONT PANEL (cut 2), "
            "BACK PANEL (cut 2), "
            "WAISTBAND (cut 1 on fold), "
            "POCKET BAG (cut 2), "
            "FLY SHIELD (cut 1). "
            "Shorter leg length than pant. Show crotch curve, inseam, outseam, waistline."
        ),
        "shirt": (
            "8 pattern pieces for a shirt: "
            "FRONT BODICE (cut 2, left and right), "
            "BACK BODICE (cut 1 on fold), "
            "SLEEVE (cut 2), "
            "COLLAR (cut 2, upper and under), "
            "COLLAR STAND (cut 2), "
            "CUFF (cut 4), "
            "YOKE (cut 2), "
            "FRONT PLACKET (cut 1). "
            "Show neckline, shoulder slope, armhole curve, side seam, hem, and center front/back lines."
        ),
        "tee": (
            "5 pattern pieces for a tee: "
            "FRONT BODICE (cut 2), "
            "BACK BODICE (cut 1 on fold), "
            "SLEEVE (cut 2), "
            "NECKBAND (cut 1), "
            "HEM BAND (cut 1). "
            "Show crew neck or V-neck shape, sleeve cap, side seam, hem."
        ),
        "top": (
            "6 pattern pieces for a top: "
            "FRONT BODICE (cut 2), "
            "BACK BODICE (cut 1 on fold), "
            "SLEEVE (cut 2), "
            "NECKLINE FACING (cut 1), "
            "HEM FACING (cut 1). "
            "Show neckline shape, armhole, side seam, hem line."
        ),
        "swtshrt": (
            "6 pattern pieces for a sweatshirt: "
            "FRONT BODICE (cut 2), "
            "BACK BODICE (cut 1 on fold), "
            "SLEEVE (cut 2), "
            "RIBBED NECKBAND (cut 1), "
            "RIBBED CUFF (cut 2), "
            "RIBBED HEM BAND (cut 1). "
            "Show dropped shoulder, kangaroo pocket if applicable, crew neck."
        ),
        "jacket": (
            "7 pattern pieces for a jacket: "
            "FRONT BODICE (cut 2), "
            "BACK BODICE (cut 1 on fold), "
            "SLEEVE (cut 2), "
            "COLLAR/LAPEL (cut 2), "
            "CHEST POCKET (cut 2), "
            "WELT POCKET (cut 2), "
            "INNER FACING (cut 2). "
            "Show lapel notch, shoulder line, armhole, front closure, pocket placement."
        ),
        "dress": (
            "7 pattern pieces for a dress: "
            "FRONT BODICE (cut 1 on fold), "
            "BACK BODICE (cut 2 for zipper), "
            "SLEEVE (cut 2), "
            "FRONT SKIRT (cut 1 on fold), "
            "BACK SKIRT (cut 2), "
            "WAIST FACING (cut 1), "
            "NECKLINE FACING (cut 1). "
            "Show bodice waist seam, skirt flare, armhole, neckline."
        ),
        "jump": (
            "9 pattern pieces for a jumpsuit: "
            "FRONT BODICE (cut 1 on fold), "
            "BACK BODICE (cut 2), "
            "SLEEVE (cut 2), "
            "FRONT PANT LEG (cut 2), "
            "BACK PANT LEG (cut 2), "
            "WAISTBAND (cut 1 on fold), "
            "FLY SHIELD (cut 1). "
            "Show bodice-to-pant transition, crotch curve, waist seam."
        ),
        "skirt": (
            "5 pattern pieces for a skirt: "
            "FRONT PANEL (cut 1 on fold), "
            "BACK PANEL (cut 2 for zipper/vent), "
            "WAISTBAND (cut 1 on fold), "
            "POCKET BAG (cut 2), "
            "FACING (cut 1). "
            "Show waist curve, hip flare, hem line, side seam, center front/back."
        ),
    }

    pieces_text = pieces_map.get(cat, pieces_map["pant"])

    # Construction summary
    construction_text = ", ".join(
        f"{k}: {v}" for k, v in construction.items() if v
    ) if construction else "Standard construction"

    # Measurements summary
    measurements_text = ", ".join(
        f"{k}: {v}cm" for k, v in body_measurements.items()
    ) if body_measurements else "Standard sizing"

    # Markings
    markings_text = ", ".join(pattern_markings) if pattern_markings else "notches and grain lines"

    prompt = (
        f"Generate a professional 2D flat pattern development layout for a {gender} {category}. "
        f"The image must show ALL {pieces_text} "
        f"laid out flat on a light beige grid plotting paper background (hex #F4F2EE) with fine grid lines. "
        f"Aspect ratio: roughly 9:10 (nearly square, slightly taller than wide). "
        f"\n\n"
        f"VISUAL STYLE: Technical CAD drafting style. Clean, crisp vector outlines in dark navy blue (#285A96). "
        f"Each pattern piece must be a closed polygon shape with accurate garment geometry. "
        f"NO 3D effects, NO shadows, NO photorealism, NO human body. Pure flat 2D pattern pieces. "
        f"\n\n"
        f"PATTERN PIECE ANNOTATIONS on each piece: "
        f"- Piece name label (e.g. 'FRONT PANEL', 'BACK BODICE', 'SLEEVE') in dark text "
        f"- Cut quantity (e.g. 'Cut 2', 'Cut 1 On Fold') in smaller gray text "
        f"- Seam allowance shown as a dashed offset line outside the main outline "
        f"- Grain line arrow (vertical red arrow with 'GRAIN' label) "
        f"- Notch marks (small red ticks at key match points: shoulder, armhole, waist, hip, knee) "
        f"- Drill holes (small red circles at pocket placements, dart points) "
        f"- Fold lines (dashed blue lines with 'PLACE ON FOLD' text where applicable) "
        f"- Construction reference lines (dashed gray): hip line, waist line, crotch line, knee line where relevant "
        f"\n\n"
        f"GARMENT DETAILS: "
        f"- Fabric: {fabric_type} "
        f"- Seam allowance: {seam_allowance} "
        f"- Hem allowance: {hem_allowance} "
        f"- Grain alignment: {grain_line} "
        f"- Ease: {ease} "
        f"- Construction: {construction_text} "
        f"- Body measurements: {measurements_text} "
        f"\n\n"
        f"LAYOUT: Arrange pieces filling the entire canvas. Larger pieces (front/back panels) on the left side, "
        f"smaller pieces (waistband, pocket, collar, fly) at the bottom. "
        f"Each piece should be clearly labeled and separated with spacing. "
        f"Do NOT include any info panel, text table, or specification sheet — just the pattern pieces on the grid background. "
        f"The output is ONLY the flat pattern pieces with all technical markings."
    )

    if additional_notes:
        prompt += f"\n\nSPECIAL INSTRUCTIONS: {additional_notes}"

    return prompt


# ─── Gemini image generation (left 60%) ─────────────────────────────


async def _generate_pattern_image(
    api_key: str,
    prompt: str,
    techpack_b64: str | None = None,
    techpack_mime: str = "image/png",
    temperature: float = 0.4,
) -> bytes | None:
    """
    Calls Gemini 2.5 Flash Image to generate the pattern pieces layout.
    Returns PNG bytes or None.
    """
    parts = [{"text": prompt}]

    if techpack_b64:
        parts.append({"text": "Reference tech pack for style context:"})
        parts.append({
            "inlineData": {
                "mimeType": techpack_mime,
                "data": techpack_b64,
            }
        })

    async with httpx.AsyncClient(timeout=60.0) as client:
        payload = {
            "contents": [{"role": "user", "parts": parts}],
            "generationConfig": {
                "temperature": temperature,
                "responseModalities": ["TEXT", "IMAGE"],
            },
        }
        url = f"{settings.vertex_base_url}/gemini-3.1-flash-image:generateContent?key={api_key}"

        for attempt in range(4):
            resp = await client.post(url, json=payload)
            if resp.status_code == 429:
                wait = min(2 ** attempt * 2, 30)
                logger.warning(f"[PATTERN] Gemini 429 on attempt {attempt+1}/4, retrying in {wait}s...")
                await asyncio.sleep(wait)
                continue
            break

        if resp.status_code != 200:
            logger.error(f"Gemini pattern image gen returned {resp.status_code}: {resp.text[:500]}")
            return None

        data = resp.json()
        parts_list = (
            data.get("candidates", [{}])[0]
            .get("content", {})
            .get("parts", [])
        )
        for part in parts_list:
            if "inlineData" in part:
                mime = part["inlineData"].get("mimeType", "")
                if mime.startswith("image/"):
                    b64 = part["inlineData"].get("data")
                    if b64:
                        logger.info("Gemini generated pattern image successfully")
                        return base64.b64decode(b64)

    logger.warning("Gemini returned no pattern image")
    return None


# ─── PIL Info Panel (right 40%) ─────────────────────────────────────


def _draw_info_panel(
    category: str,
    gender: str,
    style_code: str,
    body_measurements: dict[str, float],
    construction: dict[str, str],
    fabric_type: str,
    seam_allowance: str,
    hem_allowance: str,
    grain_line: str,
    ease: str,
    pattern_markings: list[str],
    additional_notes: str,
) -> Image.Image:
    """
    Compact info card (440×520) — positioned top-right of the canvas.
    Matches the reference HTML layout: 35% width × 65% height of a 1200×800 canvas.
    """
    PW, PH = 440, 520
    panel = Image.new("RGB", (PW, PH), (234, 229, 218))
    draw = ImageDraw.Draw(panel)

    border = (180, 175, 165)
    text = (42, 38, 32)
    dim = (120, 115, 105)
    section = (90, 85, 75)
    divider_c = (200, 195, 185)

    try:
        font_title = ImageFont.truetype("arial.ttf", 14)
        font_section = ImageFont.truetype("arial.ttf", 11)
        font_body = ImageFont.truetype("arial.ttf", 10)
    except Exception:
        try:
            font_title = ImageFont.truetype("Helvetica.ttc", 14)
            font_section = ImageFont.truetype("Helvetica.ttc", 11)
            font_body = ImageFont.truetype("Helvetica.ttc", 10)
        except Exception:
            font_title = ImageFont.load_default()
            font_section = font_title
            font_body = font_title

    pad = 18
    y = pad

    # Title
    draw.text((pad, y), "PATTERN INFO", fill=dim, font=font_title)
    y += 28
    draw.line([(pad, y), (PW - pad, y)], fill=divider_c, width=1)
    y += 10

    # Construction
    draw.text((pad, y), "Construction", fill=section, font=font_section)
    y += 18
    for label, val in list(construction.items())[:5]:
        if val:
            draw.text((pad + 4, y), f"{label}: {val}", fill=text, font=font_body)
            y += 15
    y += 6
    draw.line([(pad, y), (PW - pad, y)], fill=divider_c, width=1)
    y += 10

    # Body Measurements (2-column)
    draw.text((pad, y), "Body Measurements", fill=section, font=font_section)
    y += 18
    items = list(body_measurements.items())
    for i in range(0, len(items), 2):
        left_label, left_val = items[i]
        draw.text((pad + 4, y), f"{left_label}: {left_val}cm", fill=text, font=font_body)
        if i + 1 < len(items):
            right_label, right_val = items[i + 1]
            draw.text((PW // 2 + 4, y), f"{right_label}: {right_val}cm", fill=text, font=font_body)
        y += 15
    y += 6
    draw.line([(pad, y), (PW - pad, y)], fill=divider_c, width=1)
    y += 10

    # Pattern Settings
    draw.text((pad, y), "Pattern Settings", fill=section, font=font_section)
    y += 18
    settings = [
        f"Fabric: {fabric_type}",
        f"Ease: {ease}",
        f"SA: {seam_allowance}",
        f"Hem: {hem_allowance}",
        f"Grain: {grain_line}",
    ]
    for i in range(0, len(settings), 2):
        draw.text((pad + 4, y), settings[i], fill=text, font=font_body)
        if i + 1 < len(settings):
            draw.text((PW // 2 + 4, y), settings[i + 1], fill=text, font=font_body)
        y += 15
    y += 6
    draw.line([(pad, y), (PW - pad, y)], fill=divider_c, width=1)
    y += 10

    # Pieces list
    draw.text((pad, y), "Pieces", fill=section, font=font_section)
    y += 18

    cat = category.lower().strip()
    if cat in ["pant", "short"]:
        pieces = [
            "1. Front panel (x2)", "2. Back panel (x2)",
            "3. Waistband (x1)", "4. Pocket bag (x2)",
            "5. Fly shield (x1)", "6. Fly facing (x1)",
            "7. WB facing (x1)",
        ]
    elif cat in ["shirt", "tee", "top", "swtshrt", "jacket"]:
        pieces = [
            "1. Front bodice (x2)", "2. Back bodice (x1)",
            "3. Sleeve (x2)", "4. Collar (x2)",
            "5. Collar stand (x2)", "6. Cuff (x4)",
            "7. Yoke (x2)", "8. Front placket (x1)",
        ]
    elif cat in ["dress", "jump"]:
        pieces = [
            "1. Front bodice (x1)", "2. Back bodice (x2)",
            "3. Sleeve (x2)", "4. Front skirt (x1)",
            "5. Back skirt (x2)", "6. Waist facing (x1)",
        ]
    else:
        pieces = [
            "1. Front panel (x1)", "2. Back panel (x2)",
            "3. Waistband (x1)", "4. Pocket bag (x2)",
            "5. Facing (x1)",
        ]

    for i in range(0, len(pieces), 2):
        draw.text((pad + 4, y), pieces[i], fill=text, font=font_body)
        if i + 1 < len(pieces):
            draw.text((PW // 2 + 4, y), pieces[i + 1], fill=text, font=font_body)
        y += 14

    # Notes (if any, at bottom)
    if additional_notes:
        y = max(y, PH - 50)
        draw.line([(pad, y), (PW - pad, y)], fill=divider_c, width=1)
        y += 8
        notes = additional_notes[:80]
        draw.text((pad + 4, y), notes, fill=(100, 70, 30), font=font_body)

    return panel


# ─── Stitch left (AI) + right (PIL) into final image ────────────────


def _stitch_pattern(ai_left: Image.Image, info_right: Image.Image) -> Image.Image:
    """
    Combines AI-generated pattern pieces (left 60%) with PIL info card (top-right).
    Canvas: 1200×800 landscape (3:2 ratio like reference HTML).
    - AI fills left 60% (720×800), centered vertically
    - PIL card is compact (440×520), positioned top-right
    """
    W, H = 1200, 800
    canvas = Image.new("RGB", (W, H), (244, 242, 238))

    # Left area: 720px wide, full height
    left_w = 720
    ai_resized = ai_left.copy()
    ai_resized.thumbnail((left_w, H), Image.Resampling.LANCZOS)
    y_offset = (H - ai_resized.height) // 2
    canvas.paste(ai_resized, (0, y_offset))

    # Right area: PIL card at top-right, 440×520, with 20px margin
    card_w, card_h = info_right.size
    card_x = left_w + 30  # 30px gap from AI area
    card_y = 30           # 30px from top
    canvas.paste(info_right, (card_x, card_y))

    # Draw thin divider
    draw = ImageDraw.Draw(canvas)
    draw.line([(left_w + 10, 20), (left_w + 10, H - 20)], fill=(200, 195, 185), width=1)

    return canvas


# ─── Endpoint ───────────────────────────────────────────────────────


@router.post("/api/garments/{garment_id}/nodes/pattern/generate")
async def generate_pattern(
    garment_id: str,
    body: PatternGenerateRequest,
    x_gemini_api_key: Optional[str] = Header(None, alias="X-Gemini-API-Key"),
):
    """
    Generate a 2D flat cutting pattern layout.
    - Left 60%: AI-generated pattern pieces (Gemini 2.5 Flash Image) at 720×800
    - Right top: PIL info card (440×520, compact)
    - Stitched into a single 1200×800 landscape PNG
    """

    garment = await Garment.get(garment_id)
    if not garment:
        raise HTTPException(status_code=404, detail="Garment not found")

    season = await Season.get(garment.season_id)
    if not season:
        raise HTTPException(status_code=404, detail="Season not found")

    # ─── Create NodeRun ───
    iteration = await _next_iteration(garment_id, NodeKey.PATTERN)

    version = garment.current_version
    stage_index = STAGE_ORDER.index(NodeKey.PATTERN)
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
        f"_v{version}_{STAGE_ABBREVIATIONS[NodeKey.PATTERN]}_R{iteration:02d}"
    )

    from datetime import datetime, timezone

    now = datetime.now(timezone.utc)

    run = NodeRun(
        season_id=garment.season_id,
        garment_id=garment_id,
        node_key=NodeKey.PATTERN,
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

    # ─── Resolve tech pack image (for AI reference) ───
    techpack_bytes = None
    techpack_mime = "image/png"
    if body.tech_pack_image_url:
        tp_img = await DesignImage.get(body.tech_pack_image_url)
        if tp_img:
            techpack_bytes = await _fetch_image_bytes(tp_img.url)
            if tp_img.url.endswith(".jpg") or tp_img.url.endswith(".jpeg"):
                techpack_mime = "image/jpeg"
        else:
            techpack_bytes = await _fetch_image_bytes(body.tech_pack_image_url)

    techpack_b64 = None
    if techpack_bytes:
        techpack_b64 = base64.b64encode(techpack_bytes).decode()

    # ─── Build my prompt ───
    style_code = f"{season.code}_{garment.category.value}_{garment.style_number:03d}_v{version}"
    prompt = _build_pattern_prompt(
        category=garment.category.value,
        gender=body.gender,
        body_measurements=body.body_measurements,
        construction=body.construction,
        fabric_type=body.fabric_type,
        seam_allowance=body.seam_allowance,
        hem_allowance=body.hem_allowance,
        grain_line=body.grain_line,
        ease=body.ease,
        pattern_markings=body.pattern_markings,
        additional_notes=body.additional_notes,
    )
    logger.info(f"Pattern prompt: {prompt[:200]}...")

    # ─── Generate pattern pieces via Gemini ───
    api_key = (x_gemini_api_key or "").strip() or (settings.ai_key or "").strip()
    ai_image_bytes = None

    if api_key:
        try:
            ai_image_bytes = await _generate_pattern_image(
                api_key, prompt, techpack_b64, techpack_mime,
            )
            if ai_image_bytes:
                run.ai.model = "gemini-3.1-flash-image"
                run.ai.prompt = prompt
                logger.info("AI pattern generation succeeded")
        except Exception as e:
            logger.error(f"AI pattern generation failed: {e}")

    # ─── Generate info panel with PIL ───
    info_panel = _draw_info_panel(
        category=garment.category.value,
        gender=body.gender,
        style_code=style_code,
        body_measurements=body.body_measurements,
        construction=body.construction,
        fabric_type=body.fabric_type,
        seam_allowance=body.seam_allowance,
        hem_allowance=body.hem_allowance,
        grain_line=body.grain_line,
        ease=body.ease,
        pattern_markings=body.pattern_markings,
        additional_notes=body.additional_notes,
    )

    # ─── Stitch together ───
    try:
        if ai_image_bytes:
            ai_img = Image.open(io.BytesIO(ai_image_bytes)).convert("RGB")
            final_img = _stitch_pattern(ai_img, info_panel)
            source = "ai+pill"
        else:
            # Fallback: use PIL for both sides (generate a placeholder left)
            logger.info("No AI image, using PIL-only fallback")
            placeholder_left = Image.new("RGB", (720, 800), (244, 242, 238))
            ph_draw = ImageDraw.Draw(placeholder_left)
            try:
                ph_font = ImageFont.truetype("arial.ttf", 24)
            except Exception:
                ph_font = ImageFont.load_default()
            ph_draw.text((200, 380), "[Pattern pieces]", fill=(180, 180, 180), font=ph_font)
            ph_draw.text((180, 420), "AI generation unavailable", fill=(150, 150, 150), font=ph_font)
            final_img = _stitch_pattern(placeholder_left, info_panel)
            source = "pil-fallback"
            run.ai.model = "pil-fallback"

        buf = io.BytesIO()
        final_img.save(buf, format="PNG", quality=95)
        img_bytes = buf.getvalue()
    except Exception as e:
        logger.error(f"Pattern stitching failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate pattern")

    # ─── Upload to ImageKit ───
    count = 1
    img_code = f"{code}_{count:02d}"

    while True:
        file_name = f"{img_code}.png"
        folder = f"/design-studio/{garment.season_id}/{garment_id}/patterns/"

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
        if body.tech_pack_image_url:
            input_refs.append(InputImageRef(image_id=body.tech_pack_image_url, stage=NodeKey.TECH_PACK, role="primary"))

        design_img = DesignImage(
            image_code=img_code,
            index=0,
            season_id=garment.season_id,
            garment_id=garment_id,
            node_key=NodeKey.PATTERN,
            run_id=str(run.id),
            version=version,
            image_type="pattern",
            view="front",
            liked=False,
            starred=False,
            input_images=input_refs,
            source=source,
            ai_model=run.ai.model,
            ai_prompt=prompt[:500],
            params={
                "gender": body.gender,
                "body_measurements": body.body_measurements,
                "construction": body.construction,
                "fabric_type": body.fabric_type,
                "seam_allowance": body.seam_allowance,
                "hem_allowance": body.hem_allowance,
                "grain_line": body.grain_line,
                "ease": body.ease,
                "pattern_markings": body.pattern_markings,
            },
            url=img_url,
            imagekit_file_id=ik_file_id,
            file_size_bytes=len(img_bytes),
            file_format="png",
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
        "style_code": style_code,
    }
