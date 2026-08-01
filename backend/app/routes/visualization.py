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
    aspect_ratio: str = "1:1"
    additional_notes: str = ""
    num_outputs: int = 1


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
    aspect_ratio: str,
    additional_notes: str,
) -> str:
    model_desc = model_description(model_avatar)
    framing = category_framing_logic(category_code)
    user_notes = f" Additional styling notes: {additional_notes}" if additional_notes else ""
    aspect_ratio_text = f" Use {aspect_ratio} aspect ratio for the output image."

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
        f"or background clutter.{aspect_ratio_text}{user_notes}"
    )


# ─── Gemini image generation ────────────────────────────────────────


async def _generate_visualization_image(
    api_key: str,
    prompt: str,
    render_b64: str,
    render_mime: str,
    temperature: float = 0.5,
    aspect_ratio: str = "1:1",
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
            "contents": [{"role": "user", "parts": parts}],
            "generationConfig": {
                "temperature": temperature,
                "responseModalities": ["TEXT", "IMAGE"],
            },
        }
        url = f"{settings.vertex_base_url}/gemini-2.5-flash-image:generateContent?key={api_key}"
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
    logger.info("=" * 60)
    logger.info("[VIS] POST /api/garments/%s/nodes/visualization/generate", garment_id)
    logger.info("[VIS] Request body: render_image_url=%s, model_avatar=%s, background=%s, lighting=%s, num_outputs=%d",
                body.render_image_url, body.model_avatar, body.background, body.lighting, body.num_outputs)

    garment = await Garment.get(garment_id)
    if not garment:
        logger.error("[VIS] Garment %s not found", garment_id)
        raise HTTPException(status_code=404, detail="Garment not found")
    if not garment.category:
        logger.error("[VIS] Garment %s has no category set", garment_id)
        raise HTTPException(status_code=400, detail="Garment has no category set")
    logger.info("[VIS] Garment: name=%s, category=%s, style_number=%d, version=%d",
                garment.name, garment.category.value, garment.style_number, garment.current_version)

    season = await Season.get(garment.season_id)
    if not season:
        logger.error("[VIS] Season %s not found", garment.season_id)
        raise HTTPException(status_code=404, detail="Season not found")
    logger.info("[VIS] Season: code=%s", season.code)

    if not body.render_image_url:
        logger.error("[VIS] No render_image_url provided")
        raise HTTPException(status_code=400, detail="A render image is required")

    # ─── Resolve render image (required) ───
    render_img = await DesignImage.get(body.render_image_url)
    if render_img:
        logger.info("[VIS] Render image found in library: id=%s, code=%s, type=%s, url=%s",
                    str(render_img.id), render_img.image_code, render_img.image_type, render_img.url[:80])
        render_bytes = await fetch_image_bytes(render_img.url)
    else:
        logger.info("[VIS] render_image_url is not a DesignImage ID, treating as raw URL: %s", body.render_image_url[:80])
        render_bytes = await fetch_image_bytes(body.render_image_url)

    if not render_bytes:
        logger.error("[VIS] Failed to load render image bytes")
        raise HTTPException(status_code=400, detail="Failed to load render image")

    render_mime = (
        "image/jpeg"
        if render_img and render_img.url.lower().endswith((".jpg", ".jpeg"))
        else "image/png"
    )
    render_b64 = base64.b64encode(render_bytes).decode()
    logger.info("[VIS] Render image loaded: %d bytes, mime=%s, b64_length=%d", len(render_bytes), render_mime, len(render_b64))

    # ─── Create NodeRun ───
    existing = await NodeRun.find(
        NodeRun.garment_id == garment_id,
        NodeRun.node_key == NodeKey.VISUALIZATION,
    ).to_list()
    iteration = len(existing) + 1
    logger.info("[VIS] Existing runs for visualization: %d, new iteration=%d", len(existing), iteration)

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
            logger.info("[VIS] Downstream runs exist — version bumped to %d", version)
    logger.info("[VIS] Final version=%d", version)

    code = (
        f"{season.code}_{garment.category.value}_{garment.style_number:03d}"
        f"_v{version}_{STAGE_ABBREVIATIONS[NodeKey.VISUALIZATION]}_R{iteration:02d}"
    )
    logger.info("[VIS] Generated code: %s", code)

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
    logger.info("[VIS] NodeRun created: id=%s, status=processing", str(run.id))

    # ─── Build prompt ───
    category_code = garment.category.value
    category_display = category_display_name(category_code)
    prompt = _build_visualization_prompt(
        category_display=category_display,
        category_code=category_code,
        model_avatar=body.model_avatar,
        background=body.background,
        lighting=body.lighting,
        aspect_ratio=body.aspect_ratio,
        additional_notes=body.additional_notes,
    )
    logger.info("[VIS] Prompt built (%d chars): %s...", len(prompt), prompt[:300])

    # ─── Generate via Gemini ───
    api_key = (x_gemini_api_key or "").strip() or (settings.ai_key or "").strip()
    generated_images = []  # list of {"bytes": bytes, "source": str}

    num_outputs = max(1, min(4, body.num_outputs))
    logger.info("[VIS] num_outputs=%d, api_key present=%s", num_outputs, bool(api_key))

    if api_key:
        try:
            for idx in range(num_outputs):
                logger.info("[VIS] Calling Gemini for output %d/%d (temperature=%.2f)...", idx + 1, num_outputs, 0.5 + (0.1 * idx))
                img_bytes = await _generate_visualization_image(
                    api_key, prompt, render_b64, render_mime,
                    temperature=0.5 + (0.1 * idx),
                    aspect_ratio=body.aspect_ratio,
                )
                if img_bytes:
                    generated_images.append({"bytes": img_bytes, "source": "ai"})
                    logger.info("[VIS] Gemini output %d: %d bytes", idx + 1, len(img_bytes))
                else:
                    logger.warning("[VIS] Gemini output %d: no image returned", idx + 1)
            if generated_images:
                run.ai.model = "gemini-2.5-flash-image"
                run.ai.prompt = prompt
                logger.info("[VIS] Gemini generation complete: %d images", len(generated_images))
        except Exception as e:
            logger.error("[VIS] Gemini visualization generation failed: %s", e, exc_info=True)

    # ─── Fallback: lightweight placeholder if AI unavailable/failed ───
    if not generated_images:
        logger.warning("[VIS] No AI images generated — falling back to PIL placeholder")
        placeholder_bytes = build_placeholder_image(
            "[3D Visualization]",
            f"{body.model_avatar} — {category_display} — AI generation unavailable",
        )
        generated_images.append({"bytes": placeholder_bytes, "source": "pil-fallback"})
        run.ai.model = "pil-fallback"
        logger.info("[VIS] Placeholder created: %d bytes", len(placeholder_bytes))

    # ─── Upload to ImageKit + Create DesignImage documents ───
    output_image_ids = []
    design_images = []

    input_refs = []
    if render_img:
        input_refs.append(InputImageRef(image_id=str(render_img.id), stage=NodeKey.RENDER, role="primary"))
        logger.info("[VIS] Input lineage: render image_id=%s", str(render_img.id))

    for idx, img_data in enumerate(generated_images):
        count_str = f"{idx + 1:02d}"
        img_code = f"{code}_{count_str}"

        file_name = f"{img_code}.png"
        folder = f"/design-studio/{garment.season_id}/{garment_id}/visualizations/"

        try:
            logger.info("[VIS] Uploading to ImageKit: %s (%d bytes)", img_code, len(img_data["bytes"]))
            ik_result = _upload_to_imagekit(img_data["bytes"], folder=folder, file_name=file_name)
            img_url = ik_result["url"]
            ik_file_id = ik_result["file_id"]
            logger.info("[VIS] ImageKit upload OK: %s -> %s", img_code, img_url[:80])
        except Exception as e:
            logger.error("[VIS] ImageKit upload failed for %s: %s", img_code, e)
            b64 = base64.b64encode(img_data["bytes"]).decode()
            img_url = f"data:image/png;base64,{b64}"
            ik_file_id = None
            logger.warning("[VIS] Using data URL fallback for %s", img_code)

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
            created_at=now,
            updated_at=now,
        )
        await design_img.insert()
        output_image_ids.append(str(design_img.id))
        design_images.append(design_img)
        logger.info("[VIS] DesignImage created: id=%s, code=%s, source=%s", str(design_img.id), img_code, img_data["source"])

    # ─── Update NodeRun ───
    run.output = NodeOutput(images=[img.url for img in design_images])
    run.output_image_ids = output_image_ids
    run.status = RunStatus.COMPLETE
    run.ai.completed_at = datetime.now(timezone.utc)
    await run.save()
    logger.info("[VIS] NodeRun completed: id=%s, status=complete, images=%d", str(run.id), len(design_images))
    logger.info("=" * 60)

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
