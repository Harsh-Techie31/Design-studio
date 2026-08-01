import base64
import io
import json
import logging
import random
import time
from typing import Optional

import httpx
from fastapi import APIRouter, Form, Header, HTTPException
from PIL import Image, ImageDraw, ImageFont

# Monkey-patch PIL rectangle to auto-normalize inverted coordinates
_orig_rectangle = ImageDraw.ImageDraw.rectangle

def _safe_rectangle(self, xy, fill=None, outline=None, width=1):
    (x0, y0), (x1, y1) = xy
    _orig_rectangle(self, [(min(x0, x1), min(y0, y1)), (max(x0, x1), max(y0, y1))], fill=fill, outline=outline, width=width)

ImageDraw.ImageDraw.rectangle = _safe_rectangle

from app.config import settings
from app.models.design_image import DesignImage, InputImageRef
from app.models.enums import NodeKey, RunStatus, STAGE_ABBREVIATIONS, STAGE_ORDER
from app.models.garment import Garment
from app.models.node_run import AIMeta, NodeOutput, NodeRun, RunInputRef
from app.models.season import Season
from app.services.imagekit import upload_image, delete_image

logger = logging.getLogger("sketch_studio")
router = APIRouter(tags=["sketch"])


# ─── PIL Sketch Engine (ported from read_only/sketch) ──────────────


def draw_flat_garment_sketch(
    category: str,
    gender: str,
    silhouette: str,
    descriptors: list[str],
    view: str,
    variation_seed: int = 0,
) -> Image.Image:
    """Generates a procedural vector-style technical flat sketch using PIL."""
    random.seed(variation_seed)

    w, h = 400, 500

    def draw_single_view(is_back: bool = False) -> Image.Image:
        img = Image.new("RGB", (w, h), (253, 252, 250))
        draw = ImageDraw.Draw(img)

        cx, cy = w // 2, h // 2

        stroke_color = (30, 30, 30)
        stitch_color = (110, 110, 110)
        fill_color = (255, 255, 255)

        category_lower = category.lower()

        has_cargo = any("cargo" in d.lower() for d in descriptors)
        has_pleat = any("pleat" in d.lower() for d in descriptors)
        has_cuff = any("cuffed" in d.lower() or "cuff" in d.lower() for d in descriptors)
        has_zipper = any("zipper" in d.lower() or "half-zip" in d.lower() for d in descriptors)
        has_pocket = any("pocket" in d.lower() for d in descriptors)
        has_hood = any("hoodie" in d.lower() or "hood" in d.lower() for d in descriptors)
        has_collar = any("collar" in d.lower() for d in descriptors)

        sil_lower = silhouette.lower()
        width_mod = 1.0
        length_mod = 1.0

        if any(k in sil_lower for k in ["oversized", "wide-leg", "relaxed", "boxy"]):
            width_mod = 1.25
        elif any(k in sil_lower for k in ["slim", "fitted", "bodycon"]):
            width_mod = 0.85
        elif any(k in sil_lower for k in ["cropped", "mini"]):
            length_mod = 0.75
        elif any(k in sil_lower for k in ["maxi", "longline"]):
            length_mod = 1.25

        if category_lower in ["pant", "short", "skirt"]:
            waist_y = cy - 80
            crotch_y = cy + 10
            hem_y = (
                cy + 180
                if category_lower == "pant"
                else (cy + 60 if category_lower == "short" else cy + 150)
            )
            hem_y = int(waist_y + (hem_y - waist_y) * length_mod)

            waist_w = int(55 * width_mod)
            hip_w = int(65 * width_mod)
            hem_w = (
                int(45 * width_mod) if category_lower == "pant" else int(55 * width_mod)
            )

            if category_lower in ["pant", "short"]:
                poly_left = [
                    (cx - waist_w, waist_y),
                    (cx, waist_y),
                    (cx, crotch_y),
                    (cx - hem_w, hem_y),
                    (cx - hip_w, cy),
                ]
                poly_right = [
                    (cx, waist_y),
                    (cx + waist_w, waist_y),
                    (cx + hip_w, cy),
                    (cx + hem_w, hem_y),
                    (cx, crotch_y),
                ]

                draw.polygon(poly_left, fill=fill_color, outline=stroke_color, width=3)
                draw.polygon(poly_right, fill=fill_color, outline=stroke_color, width=3)
                draw.line([(cx, waist_y), (cx, crotch_y)], fill=stroke_color, width=3)

                draw.rectangle(
                    [(cx - waist_w, waist_y), (cx + waist_w, waist_y + 20)],
                    fill=fill_color,
                    outline=stroke_color,
                    width=2,
                )
                draw.line(
                    [(cx - waist_w, waist_y + 10), (cx + waist_w, waist_y + 10)],
                    fill=stitch_color,
                    width=1,
                )

                if has_pleat:
                    draw.line(
                        [(cx - waist_w // 2, waist_y + 20), (cx - waist_w // 2, crotch_y + 50)],
                        fill=stroke_color,
                        width=1,
                    )
                    draw.line(
                        [(cx + waist_w // 2, waist_y + 20), (cx + waist_w // 2, crotch_y + 50)],
                        fill=stroke_color,
                        width=1,
                    )

                if has_cargo:
                    p_w, p_h = 20, 30
                    draw.rectangle(
                        [(cx - hip_w - 5, cy + 10), (cx - hip_w + p_w, cy + 10 + p_h)],
                        fill=fill_color,
                        outline=stroke_color,
                        width=2,
                    )
                    draw.rectangle(
                        [(cx + hip_w - p_w, cy + 10), (cx + hip_w + 5, cy + 10 + p_h)],
                        fill=fill_color,
                        outline=stroke_color,
                        width=2,
                    )
                    draw.polygon(
                        [
                            (cx - hip_w - 7, cy + 10),
                            (cx - hip_w + p_w + 2, cy + 10),
                            (cx - hip_w + p_w // 2, cy + 5),
                        ],
                        fill=fill_color,
                        outline=stroke_color,
                        width=2,
                    )
                    draw.polygon(
                        [
                            (cx + hip_w - p_w - 2, cy + 10),
                            (cx + hip_w + 7, cy + 10),
                            (cx + hip_w - p_w // 2, cy + 5),
                        ],
                        fill=fill_color,
                        outline=stroke_color,
                        width=2,
                    )

                if has_pocket and not is_back:
                    draw.arc(
                        [(cx - waist_w, waist_y + 20), (cx - waist_w + 25, waist_y + 50)],
                        270,
                        360,
                        fill=stroke_color,
                        width=2,
                    )
                    draw.arc(
                        [(cx + waist_w - 25, waist_y + 20), (cx + waist_w, waist_y + 50)],
                        180,
                        270,
                        fill=stroke_color,
                        width=2,
                    )

                if is_back:
                    bp_w, bp_h = 25, 30
                    draw.rectangle(
                        [(cx - waist_w + 5, waist_y + 30), (cx - waist_w + 5 + bp_w, waist_y + 30 + bp_h)],
                        fill=fill_color,
                        outline=stroke_color,
                        width=2,
                    )
                    draw.rectangle(
                        [(cx + waist_w - 5 - bp_w, waist_y + 30), (cx + waist_w - 5, waist_y + 30 + bp_h)],
                        fill=fill_color,
                        outline=stroke_color,
                        width=2,
                    )

                if has_cuff:
                    draw.rectangle(
                        [(cx - hem_w - 2, hem_y - 15), (cx, hem_y)],
                        fill=fill_color,
                        outline=stroke_color,
                        width=2,
                    )
                    draw.rectangle(
                        [(cx, hem_y - 15), (cx + hem_w + 2, hem_y)],
                        fill=fill_color,
                        outline=stroke_color,
                        width=2,
                    )
            else:
                skirt_points = [
                    (cx - waist_w, waist_y),
                    (cx + waist_w, waist_y),
                    (cx + hem_w, hem_y),
                    (cx - hem_w, hem_y),
                ]
                draw.polygon(skirt_points, fill=fill_color, outline=stroke_color, width=3)
                draw.rectangle(
                    [(cx - waist_w, waist_y), (cx + waist_w, waist_y + 18)],
                    fill=fill_color,
                    outline=stroke_color,
                    width=2,
                )

                if has_pleat or "pleated" in sil_lower:
                    for offset in range(-waist_w + 10, waist_w - 5, 12):
                        draw.line(
                            [(cx + offset, waist_y + 18), (cx + offset * 1.3, hem_y)],
                            fill=stroke_color,
                            width=1,
                        )

                if has_zipper:
                    draw.line([(cx, waist_y), (cx, waist_y + 60)], fill=stroke_color, width=2)
                    draw.ellipse(
                        [(cx - 3, waist_y + 58), (cx + 3, waist_y + 64)],
                        fill=fill_color,
                        outline=stroke_color,
                        width=2,
                    )
        else:
            neck_y = cy - 130
            shoulder_y = cy - 110
            armpit_y = cy - 50
            waist_y = cy + 20

            if category_lower == "dress":
                hem_y = int((cy + 170) * length_mod)
            elif category_lower == "jumpsuit":
                hem_y = int((cy + 185) * length_mod)
            elif "cropped" in sil_lower:
                hem_y = cy - 10
            else:
                hem_y = int((cy + 80) * length_mod)

            sh_w = int(60 * width_mod)
            chest_w = int(55 * width_mod)
            waist_w = int(50 * width_mod)
            hem_w = int(52 * width_mod)

            neck_l = (cx - 22, shoulder_y - 8)
            neck_r = (cx + 22, shoulder_y - 8)

            if category_lower == "jumpsuit":
                crotch_y = cy + 60
                j_hem_w = int(40 * width_mod)
                body_points = [
                    neck_l,
                    (cx - sh_w, shoulder_y),
                    (cx - chest_w, armpit_y),
                    (cx - waist_w, waist_y),
                    (cx - waist_w - 5, crotch_y),
                    (cx - j_hem_w, hem_y),
                    (cx, hem_y - 30),
                    (cx + j_hem_w, hem_y),
                    (cx + waist_w + 5, crotch_y),
                    (cx + waist_w, waist_y),
                    (cx + chest_w, armpit_y),
                    (cx + sh_w, shoulder_y),
                    neck_r,
                ]
                draw.polygon(body_points, fill=fill_color, outline=stroke_color, width=3)
                draw.line([(cx, waist_y), (cx, hem_y - 30)], fill=stroke_color, width=2)
            else:
                body_points = [
                    neck_l,
                    (cx - sh_w, shoulder_y),
                    (cx - chest_w, armpit_y),
                    (cx - waist_w, waist_y),
                    (cx - hem_w, hem_y),
                    (cx + hem_w, hem_y),
                    (cx + waist_w, waist_y),
                    (cx + chest_w, armpit_y),
                    (cx + sh_w, shoulder_y),
                    neck_r,
                ]
                draw.polygon(body_points, fill=fill_color, outline=stroke_color, width=3)

            sleeve_len_y = (
                shoulder_y + 160
                if category_lower in ["jacket", "sweatshirt", "shirt"]
                else shoulder_y + 60
            )
            if "longline" in sil_lower or "oversized" in sil_lower:
                sleeve_len_y += 30
            elif "cropped" in sil_lower or category_lower == "top":
                sleeve_len_y -= 25

            draw.polygon(
                [
                    (cx - sh_w, shoulder_y),
                    (cx - chest_w, armpit_y),
                    (cx - chest_w - 20, sleeve_len_y),
                    (cx - sh_w - 20, sleeve_len_y),
                ],
                fill=fill_color,
                outline=stroke_color,
                width=3,
            )
            draw.polygon(
                [
                    (cx + sh_w, shoulder_y),
                    (cx + chest_w, armpit_y),
                    (cx + sh_w + 20, sleeve_len_y),
                    (cx + chest_w + 20, sleeve_len_y),
                ],
                fill=fill_color,
                outline=stroke_color,
                width=3,
            )

            if has_hood:
                draw.polygon(
                    [
                        (cx - 28, shoulder_y - 8),
                        (cx - 24, shoulder_y - 40),
                        (cx, shoulder_y - 50),
                        (cx + 24, shoulder_y - 40),
                        (cx + 28, shoulder_y - 8),
                    ],
                    fill=fill_color,
                    outline=stroke_color,
                    width=2,
                )
                draw.line([(cx - 8, shoulder_y), (cx - 8, shoulder_y + 35)], fill=stroke_color, width=2)
                draw.line([(cx + 8, shoulder_y), (cx + 8, shoulder_y + 35)], fill=stroke_color, width=2)
            elif has_collar or category_lower in ["shirt", "jacket"]:
                if "camp" in "".join(descriptors).lower():
                    draw.polygon(
                        [(cx - 22, shoulder_y - 8), (cx, shoulder_y + 8), (cx - 40, shoulder_y + 12)],
                        fill=fill_color,
                        outline=stroke_color,
                        width=2,
                    )
                    draw.polygon(
                        [(cx + 22, shoulder_y - 8), (cx, shoulder_y + 8), (cx + 40, shoulder_y + 12)],
                        fill=fill_color,
                        outline=stroke_color,
                        width=2,
                    )
                else:
                    draw.polygon(
                        [(cx - 22, shoulder_y - 8), (cx - 5, shoulder_y + 12), (cx - 30, shoulder_y + 18)],
                        fill=fill_color,
                        outline=stroke_color,
                        width=2,
                    )
                    draw.polygon(
                        [(cx + 22, shoulder_y - 8), (cx + 5, shoulder_y + 12), (cx + 30, shoulder_y + 18)],
                        fill=fill_color,
                        outline=stroke_color,
                        width=2,
                    )
            else:
                draw.arc(
                    [(cx - 22, shoulder_y - 12), (cx + 22, shoulder_y - 4)],
                    0,
                    180,
                    fill=stroke_color,
                    width=2,
                )

            if (category_lower in ["jacket", "sweatshirt", "shirt"] or has_zipper) and not is_back:
                draw.line([(cx, shoulder_y + 8), (cx, hem_y)], fill=stroke_color, width=2)
                if has_zipper or "half-zip" in "".join(descriptors).lower():
                    end_y = shoulder_y + 70 if "half-zip" in "".join(descriptors).lower() else hem_y - 10
                    for zy in range(shoulder_y + 15, end_y, 8):
                        draw.line([(cx - 3, zy), (cx + 3, zy)], fill=stitch_color, width=1)
                elif category_lower in ["shirt", "jacket"]:
                    for by in range(shoulder_y + 30, hem_y - 20, 35):
                        draw.ellipse(
                            [(cx - 3, by - 3), (cx + 3, by + 3)],
                            fill=stroke_color,
                            outline=stroke_color,
                        )

            if has_pocket and not is_back:
                if category_lower == "sweatshirt" or has_hood:
                    draw.polygon(
                        [
                            (cx - 35, hem_y - 10),
                            (cx + 35, hem_y - 10),
                            (cx + 25, hem_y - 60),
                            (cx - 25, hem_y - 60),
                        ],
                        fill=fill_color,
                        outline=stroke_color,
                        width=2,
                    )
                else:
                    draw.rectangle(
                        [(cx - 38, shoulder_y + 40), (cx - 18, shoulder_y + 65)],
                        fill=fill_color,
                        outline=stroke_color,
                        width=2,
                    )
                    draw.rectangle(
                        [(cx + 18, shoulder_y + 40), (cx + 38, shoulder_y + 65)],
                        fill=fill_color,
                        outline=stroke_color,
                        width=2,
                    )
                    draw.rectangle(
                        [(cx - 38, shoulder_y + 35), (cx - 18, shoulder_y + 40)],
                        fill=fill_color,
                        outline=stroke_color,
                        width=2,
                    )
                    draw.rectangle(
                        [(cx + 18, shoulder_y + 35), (cx + 38, shoulder_y + 40)],
                        fill=fill_color,
                        outline=stroke_color,
                        width=2,
                    )

            if has_cuff or category_lower in ["shirt", "jacket", "sweatshirt"]:
                draw.rectangle(
                    [(cx - chest_w - 20, sleeve_len_y), (cx - sh_w - 20, sleeve_len_y + 12)],
                    fill=fill_color,
                    outline=stroke_color,
                    width=2,
                )
                draw.rectangle(
                    [(cx + sh_w + 20, sleeve_len_y), (cx + chest_w + 20, sleeve_len_y + 12)],
                    fill=fill_color,
                    outline=stroke_color,
                    width=2,
                )

            if category_lower in ["sweatshirt", "jacket"]:
                draw.rectangle(
                    [(cx - hem_w, hem_y), (cx + hem_w, hem_y + 15)],
                    fill=fill_color,
                    outline=stroke_color,
                    width=2,
                )
                for rx in range(-hem_w + 8, hem_w, 10):
                    draw.line([(cx + rx, hem_y), (cx + rx, hem_y + 15)], fill=stitch_color, width=1)

        return img

    if view == "Front and back":
        front_img = draw_single_view(is_back=False)
        back_img = draw_single_view(is_back=True)

        combined_w = w * 2 + 40
        combined_h = h + 80
        combined = Image.new("RGB", (combined_w, combined_h), (253, 252, 250))
        combined.paste(front_img, (10, 40))
        combined.paste(back_img, (w + 30, 40))

        draw = ImageDraw.Draw(combined)
        mid_x = combined_w // 2
        for cy_dash in range(20, combined_h - 20, 15):
            draw.line([(mid_x, cy_dash), (mid_x, cy_dash + 8)], fill=(150, 150, 150), width=2)

        try:
            font = ImageFont.load_default()
        except Exception:
            font = None

        draw.text((w // 2 - 20, 15), "FRONT", fill=(80, 80, 80), font=font)
        draw.text((w + 30 + w // 2 - 15, 15), "BACK", fill=(80, 80, 80), font=font)

        return combined
    elif view == "Back only":
        back_img = draw_single_view(is_back=True)
        padded = Image.new("RGB", (w + 40, h + 40), (253, 252, 250))
        padded.paste(back_img, (20, 20))
        return padded
    else:
        front_img = draw_single_view(is_back=False)
        padded = Image.new("RGB", (w + 40, h + 40), (253, 252, 250))
        padded.paste(front_img, (20, 20))
        return padded


def _image_to_bytes(img: Image.Image) -> bytes:
    buf = io.BytesIO()
    img.save(buf, format="PNG", quality=95)
    return buf.getvalue()


def _upload_to_imagekit(file_bytes: bytes, folder: str, file_name: str) -> dict:
    """Upload bytes to ImageKit. Returns {"url": ..., "file_id": ...}."""
    return upload_image(file_bytes, folder=folder, file_name=file_name)


# ─── Gemini AI generation ──────────────────────────────────────────


async def _generate_with_gemini(
    api_key: str,
    category: str,
    gender: str,
    silhouette: str,
    descriptors: list[str],
    prompt_text: str,
    view: str,
    num_outputs: int,
    note: str = "",
) -> list[str]:
    """Call Gemini API to generate sketch images. Returns list of data URLs."""
    desc_str = ", ".join(descriptors) if descriptors else "Standard design"
    images = []

    # Dynamic view logic
    if view == "Front and back":
        layout_instructions = (
            "Horizontal layout. Side-by-side view: Front view on the left, Back view on the right. "
            "Explicitly write the text label 'FRONT' directly below the left garment, "
            "and write the text label 'BACK' directly below the right garment."
        )
    elif view == "Back only":
        layout_instructions = (
            "CRITICAL: Draw ONLY the BACK view of the garment. Show the back neckline, back yoke, "
            "back seams, and any back details. Do NOT include any front elements. "
            "The garment must be facing away from the viewer. "
            "Write the text label 'BACK' directly below the garment."
        )
    else:
        layout_instructions = (
            "Centered Front view only. "
            "Explicitly write the text label 'FRONT' directly below the garment."
        )

    # Build user guidelines from prompt_text
    guidelines = f" Additional notes: {prompt_text}." if prompt_text else ""
    if note:
        guidelines += f" User note: {note}."

    async with httpx.AsyncClient(timeout=60.0) as client:
        for idx in range(num_outputs):
            prompt = (
                f"A clean, professional 2D technical flat fashion sketch of a {gender} {category}. "
                f"Silhouette: {silhouette}. Design details: {desc_str}. "
                f"{layout_instructions} "
                f"Style: Black ink line drawing on a pure solid white background. "
                f"Crisp vector lines, completely flat geometry. "
                f"STRICT INSTRUCTIONS: No 3D forms, no shading, no colors, no gradient. "
                f"Must be an isolated flat sketch."
                f"{guidelines}"
            )

            negative_prompt = (
                "3D, shadows, shading, human body, mannequin, skin, hands, realistic, photographic, "
                "colors, gradients, messy lines, hangers, background clutter, wrinkles, folds with volume"
            )

            if view == "Back only":
                negative_prompt += ", front view, front details, front neckline, front placket, front pockets"

            payload = {
                "contents": [{"role": "user", "parts": [{"text": prompt}, {"text": f"Avoid: {negative_prompt}"}]}],
                "generationConfig": {"temperature": 0.5 + (0.1 * idx)},
            }

            url = f"{settings.vertex_base_url}/gemini-2.5-flash-image:generateContent?key={api_key}"

            try:
                resp = await client.post(url, json=payload)
                if resp.status_code == 200:
                    data = resp.json()
                    parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
                    for part in parts:
                        if "inlineData" in part:
                            mime = part["inlineData"].get("mimeType", "")
                            if mime.startswith("image/"):
                                b64 = part["inlineData"].get("data")
                                if b64:
                                    images.append(f"data:{mime};base64,{b64}")
                                break
            except Exception as e:
                logger.error(f"Gemini API error on iteration {idx}: {e}")
                continue

    return images


# ─── Endpoint ───────────────────────────────────────────────────────


@router.post("/api/garments/{garment_id}/nodes/sketch/generate")
async def generate_sketch(
    garment_id: str,
    gender: str = Form(...),
    silhouette: str = Form(...),
    descriptors_json: str = Form("[]"),
    prompt_text: str = Form(""),
    moodboard_refs_json: str = Form("[]"),
    mood_influence: float = Form(60.0),
    view: str = Form("Front and back"),
    num_outputs: int = Form(1),
    note: str = Form(""),
    previous_run_id: Optional[str] = Form(None),
    input_image_ids_json: str = Form("[]"),
    x_gemini_api_key: Optional[str] = Header(None, alias="X-Gemini-API-Key"),
):
    """Generate technical flat sketches. Uses Gemini if API key available, PIL as fallback."""

    garment = await Garment.get(garment_id)
    if not garment:
        raise HTTPException(status_code=404, detail="Garment not found")

    season = await Season.get(garment.season_id)
    if not season:
        raise HTTPException(status_code=404, detail="Season not found")

    try:
        descriptors = json.loads(descriptors_json)
    except Exception:
        descriptors = []

    try:
        moodboard_refs = json.loads(moodboard_refs_json)
    except Exception:
        moodboard_refs = []

    try:
        input_image_ids = json.loads(input_image_ids_json)
    except Exception:
        input_image_ids = []

    # ─── Create NodeRun ───
    existing = await NodeRun.find(
        NodeRun.garment_id == garment_id,
        NodeRun.node_key == NodeKey.SKETCH,
    ).to_list()
    iteration = len(existing) + 1

    version = garment.current_version
    stage_index = STAGE_ORDER.index(NodeKey.SKETCH)
    downstream_keys = STAGE_ORDER[stage_index + 1 :]
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
        f"_v{version}_{STAGE_ABBREVIATIONS[NodeKey.SKETCH]}_R{iteration:02d}"
    )

    from datetime import datetime, timezone

    now = datetime.now(timezone.utc)

    run = NodeRun(
        season_id=garment.season_id,
        garment_id=garment_id,
        node_key=NodeKey.SKETCH,
        iteration=iteration,
        version=version,
        code=code,
        status=RunStatus.PROCESSING,
        inputs=[
            RunInputRef(run_id=prev_id, node_key=NodeKey.SKETCH)
            for prev_id in ([previous_run_id] if previous_run_id else [])
        ],
        output=NodeOutput(),
        output_image_ids=[],
        ai=AIMeta(started_at=now),
        created_at=now,
        updated_at=now,
    )
    await run.insert()

    # ─── Build input image refs ───
    input_refs = []
    for img_id in input_image_ids:
        input_refs.append(InputImageRef(image_id=img_id, stage=NodeKey.SKETCH, role="primary"))

    # ─── Generate images ───
    api_key = (x_gemini_api_key or "").strip() or (settings.ai_key or "").strip()
    generated_images = []  # list of {"bytes": bytes, "source": str}

    if api_key:
        try:
            gemini_urls = await _generate_with_gemini(
                api_key, garment.category.value, gender, silhouette,
                descriptors, prompt_text, view, num_outputs, note,
            )
            for data_url in gemini_urls:
                # Decode base64 data URL to bytes
                if data_url.startswith("data:"):
                    _, b64data = data_url.split(",", 1)
                    img_bytes = base64.b64decode(b64data)
                    generated_images.append({"bytes": img_bytes, "source": "ai"})
            run.ai.model = "gemini-2.5-flash-image"
            run.ai.prompt = prompt_text
        except Exception as e:
            logger.error(f"Gemini generation failed, falling back to PIL: {e}")

    if not generated_images:
        # PIL fallback
        for i in range(num_outputs):
            seed = int(time.time() * 1000) % 10000 + i
            pil_img = draw_flat_garment_sketch(
                garment.category.value, gender, silhouette, descriptors, view, variation_seed=seed,
            )
            generated_images.append({"bytes": _image_to_bytes(pil_img), "source": "pil"})
            run.ai.model = "pil-v1"

    # ─── Upload to ImageKit + Create DesignImage documents ───
    output_image_ids = []
    design_images = []

    for idx, img_data in enumerate(generated_images):
        count_str = f"{idx + 1:02d}"
        img_code = f"{code}_{count_str}"
        img_view = "front_and_back" if view == "Front and back" else "back" if view == "Back only" else "front"

        # Upload to ImageKit
        file_name = f"{img_code}.png"
        folder = f"/design-studio/{garment.season_id}/{garment_id}/sketches/"
        try:
            ik_result = _upload_to_imagekit(img_data["bytes"], folder=folder, file_name=file_name)
            img_url = ik_result["url"]
            ik_file_id = ik_result["file_id"]
            logger.info(f"ImageKit upload OK: {img_code} → {img_url[:60]}...")
        except Exception as e:
            logger.error(f"ImageKit upload failed for {img_code}: {e}")
            # Fallback: store as base64 data URL (bad but at least not broken)
            b64 = base64.b64encode(img_data["bytes"]).decode()
            img_url = f"data:image/png;base64,{b64}"
            ik_file_id = None

        design_img = DesignImage(
            image_code=img_code,
            index=idx,
            season_id=garment.season_id,
            garment_id=garment_id,
            node_key=NodeKey.SKETCH,
            run_id=str(run.id),
            version=version,
            image_type="sketch",
            view=img_view,
            liked=False,
            starred=False,
            input_images=input_refs,
            source=img_data["source"],
            ai_model=run.ai.model,
            ai_prompt=prompt_text,
            params={
                "gender": gender,
                "silhouette": silhouette,
                "descriptors": descriptors,
                "mood_influence": mood_influence,
                "moodboard_refs": moodboard_refs,
                "view": view,
            },
            url=img_url,
            imagekit_file_id=ik_file_id,
            file_size_bytes=len(img_data["bytes"]),
            file_format="png",
            note=note,
            created_at=now,
            updated_at=now,
        )
        await design_img.insert()
        output_image_ids.append(str(design_img.id))
        design_images.append(design_img)

    # ─── Update NodeRun ───
    run.output = NodeOutput(images=[img.url for img in design_images])
    run.output_image_ids = output_image_ids
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
        "images": [
            {
                "id": str(img.id),
                "image_code": img.image_code,
                "url": img.url,
                "index": img.index,
                "view": img.view,
                "source": img.source,
                "ai_model": img.ai_model,
            }
            for img in design_images
        ],
        "category": garment.category.value,
        "gender": gender,
        "silhouette": silhouette,
        "view": view,
        "style_descriptors": descriptors,
        "prompt": prompt_text,
    }
