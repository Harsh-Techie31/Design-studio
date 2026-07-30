import base64
import logging
from datetime import datetime, timezone
from typing import Optional

import httpx
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from app.config import settings
from app.models.design_image import DesignImage, InputImageRef
from app.models.enums import NodeKey, RunStatus, STAGE_ABBREVIATIONS, STAGE_ORDER
from app.models.garment import Garment
from app.models.node_run import AIMeta, NodeOutput, NodeRun, RunInputRef
from app.models.season import Season
from app.services.avatar_reference import (
    category_display_name,
    framing_logic as category_framing_logic,
    model_description,
)
from app.services.generation_helpers import build_placeholder_image, fetch_image_bytes
from app.services.imagekit import upload_image

logger = logging.getLogger("visualization_studio")
router = APIRouter(tags=["visualization"])


# ─── Request model ──────────────────────────────────────────────────


class VisualizationGenerateRequest(BaseModel):
    render_image_url: str  # DesignImage id from library (the selected render) — required
    model_avatar: str = "Model A"  # "Model A" (male) or "Model B" (female)
    background: str = "Plain studio"
    lighting: str = "Soft"
    additional_notes: str = ""
    num_outputs: int = 1
    note: str = ""


NEGATIVE_PROMPT = (
    "multiple different people, morphing bodies, missing limbs, asymmetrical face, text, "
    "technical lines, flat 2D drawing, illustration, sketch, dramatic cinematic lighting, extreme angles"
)


# ─── Prompt builder (source of truth: the system_instruction spec given for this stage) ───


def _build_visualization_prompt(
    category_display: str,
    category_code: str,
    model_avatar: str,
    background: str,
    lighting: str,
    additional_notes: str,
) -> str:
    model_desc = model_description(model_avatar)
    framing = category_framing_logic(category_code)
    user_notes = f" Additional styling notes: {additional_notes}" if additional_notes else ""

    return (
        "**Visualization Rules:**\n"
        "1. **Subject & Layout:** Generate a single high-fidelity, photorealistic fashion visualization "
        "showing three distinct views side-by-side: FRONT view on the left, SIDE profile view in the middle, "
        "and BACK view on the right. These three views must be separated by neat, dashed vertical lines.\n"
        f"2. **Model Identity:** The subject must consistently be a {model_desc} The model must have a "
        "straight, neutral face and hold a standard, relaxed audition casting pose.\n"
        f"3. **Framing & Camera:** {framing}\n"
        f"4. **Garment & Material:** The model is wearing a perfectly fitted {category_display}. It must wear "
        "the exact fabric texture, print pattern, and colors directly mapped from the provided 2D render input image.\n"
        f"5. **Environment:** {background} background, {lighting} lighting. No distracting shadows, props, "
        f"or background clutter.{user_notes}"
    )


# ─── Gemini image generation ────────────────────────────────────────


async def _generate_visualization_image(
    api_key: str,
    prompt: str,
    render_b64: str,
    render_mime: str,
    temperature: float = 0.5,
) -> Optional[bytes]:
    parts = [
        {"text": prompt},
        {"text": f"Avoid the following at all costs: {NEGATIVE_PROMPT}."},
        {"text": "2D garment render reference — map this exact fabric texture, print, and color onto the model:"},
        {
            "inlineData": {
                "mimeType": render_mime,
                "data": render_b64,
            }
        },
    ]

    async with httpx.AsyncClient(timeout=60.0) as client:
        payload = {
            "contents": [{"parts": parts}],
            "generationConfig": {
                "temperature": temperature,
                "responseModalities": ["TEXT", "IMAGE"],
            },
        }
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key={api_key}"
        resp = await client.post(url, json=payload)

        if resp.status_code != 200:
            logger.error(f"Gemini visualization gen returned {resp.status_code}: {resp.text[:500]}")
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
                        logger.info("Gemini generated visualization image successfully")
                        return base64.b64decode(b64)

    logger.warning("Gemini returned no visualization image")
    return None


# ─── Helpers ─────────────────────────────────────────────────────────


def _upload_to_imagekit(file_bytes: bytes, folder: str, file_name: str) -> dict:
    return upload_image(file_bytes, folder=folder, file_name=file_name)


# ─── Endpoint ───────────────────────────────────────────────────────


@router.post("/api/garments/{garment_id}/nodes/visualization/generate")
async def generate_visualization(
    garment_id: str,
    body: VisualizationGenerateRequest,
    x_gemini_api_key: Optional[str] = Header(None, alias="X-Gemini-API-Key"),
):
    """
    Generate a 3-view (front/side/back) photorealistic 3D visualization of the garment
    on a fixed male/female model, using the selected Render output as the fabric/print/
    color reference. Framing is derived automatically from the garment's category.
    """

    garment = await Garment.get(garment_id)
    if not garment:
        raise HTTPException(status_code=404, detail="Garment not found")
    if not garment.category:
        raise HTTPException(status_code=400, detail="Garment has no category set")

    season = await Season.get(garment.season_id)
    if not season:
        raise HTTPException(status_code=404, detail="Season not found")

    if not body.render_image_url:
        raise HTTPException(status_code=400, detail="A render image is required")

    # ─── Resolve render image (required) ───
    render_img = await DesignImage.get(body.render_image_url)
    if render_img:
        render_bytes = await fetch_image_bytes(render_img.url)
    else:
        render_bytes = await fetch_image_bytes(body.render_image_url)

    if not render_bytes:
        raise HTTPException(status_code=400, detail="Failed to load render image")

    render_mime = (
        "image/jpeg"
        if render_img and render_img.url.lower().endswith((".jpg", ".jpeg"))
        else "image/png"
    )
    render_b64 = base64.b64encode(render_bytes).decode()

    # ─── Create NodeRun ───
    existing = await NodeRun.find(
        NodeRun.garment_id == garment_id,
        NodeRun.node_key == NodeKey.VISUALIZATION,
    ).to_list()
    iteration = len(existing) + 1

    version = garment.current_version
    stage_index = STAGE_ORDER.index(NodeKey.VISUALIZATION)
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
        f"_v{version}_{STAGE_ABBREVIATIONS[NodeKey.VISUALIZATION]}_R{iteration:02d}"
    )

    now = datetime.now(timezone.utc)

    run = NodeRun(
        season_id=garment.season_id,
        garment_id=garment_id,
        node_key=NodeKey.VISUALIZATION,
        iteration=iteration,
        version=version,
        code=code,
        status=RunStatus.PROCESSING,
        inputs=[RunInputRef(run_id=render_img.run_id, node_key=NodeKey.RENDER)] if render_img else [],
        output=NodeOutput(),
        output_image_ids=[],
        ai=AIMeta(started_at=now),
        created_at=now,
        updated_at=now,
    )
    await run.insert()

    # ─── Build prompt ───
    category_code = garment.category.value
    category_display = category_display_name(category_code)
    prompt = _build_visualization_prompt(
        category_display=category_display,
        category_code=category_code,
        model_avatar=body.model_avatar,
        background=body.background,
        lighting=body.lighting,
        additional_notes=body.additional_notes,
    )
    logger.info(f"Visualization prompt: {prompt[:200]}...")

    # ─── Generate via Gemini ───
    api_key = (x_gemini_api_key or "").strip() or (settings.ai_key or "").strip()
    generated_images = []  # list of {"bytes": bytes, "source": str}

    num_outputs = max(1, min(4, body.num_outputs))

    if api_key:
        try:
            for idx in range(num_outputs):
                img_bytes = await _generate_visualization_image(
                    api_key, prompt, render_b64, render_mime,
                    temperature=0.5 + (0.1 * idx),
                )
                if img_bytes:
                    generated_images.append({"bytes": img_bytes, "source": "ai"})
            if generated_images:
                run.ai.model = "gemini-2.5-flash-image"
                run.ai.prompt = prompt
        except Exception as e:
            logger.error(f"Gemini visualization generation failed: {e}")

    # ─── Fallback: lightweight placeholder if AI unavailable/failed ───
    if not generated_images:
        logger.info("No AI images generated, using placeholder fallback")
        placeholder_bytes = build_placeholder_image(
            "[3D Visualization]",
            f"{body.model_avatar} — {category_display} — AI generation unavailable",
        )
        generated_images.append({"bytes": placeholder_bytes, "source": "pil-fallback"})
        run.ai.model = "pil-fallback"

    # ─── Upload to ImageKit + Create DesignImage documents ───
    output_image_ids = []
    design_images = []

    input_refs = []
    if render_img:
        input_refs.append(InputImageRef(image_id=str(render_img.id), stage=NodeKey.RENDER, role="primary"))

    for idx, img_data in enumerate(generated_images):
        count_str = f"{idx + 1:02d}"
        img_code = f"{code}_{count_str}"

        file_name = f"{img_code}.png"
        folder = f"/design-studio/{garment.season_id}/{garment_id}/visualizations/"

        try:
            ik_result = _upload_to_imagekit(img_data["bytes"], folder=folder, file_name=file_name)
            img_url = ik_result["url"]
            ik_file_id = ik_result["file_id"]
            logger.info(f"ImageKit upload OK: {img_code} -> {img_url[:60]}...")
        except Exception as e:
            logger.error(f"ImageKit upload failed for {img_code}: {e}")
            b64 = base64.b64encode(img_data["bytes"]).decode()
            img_url = f"data:image/png;base64,{b64}"
            ik_file_id = None

        design_img = DesignImage(
            image_code=img_code,
            index=idx,
            season_id=garment.season_id,
            garment_id=garment_id,
            node_key=NodeKey.VISUALIZATION,
            run_id=str(run.id),
            version=version,
            image_type="3d",
            view="3d",
            liked=False,
            starred=False,
            input_images=input_refs,
            source=img_data["source"],
            ai_model=run.ai.model,
            ai_prompt=prompt,
            params={
                "model_avatar": body.model_avatar,
                "background": body.background,
                "lighting": body.lighting,
            },
            url=img_url,
            imagekit_file_id=ik_file_id,
            file_size_bytes=len(img_data["bytes"]),
            file_format="png",
            note=body.note,
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
                "source": img.source,
                "ai_model": img.ai_model,
            }
            for img in design_images
        ],
        "prompt": prompt,
        "model_avatar": body.model_avatar,
    }
