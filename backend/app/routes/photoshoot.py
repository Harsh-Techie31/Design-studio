import base64
import logging
from datetime import datetime, timezone
from typing import Optional

import httpx
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from app.config import settings
from app.models.design_image import DesignImage, InputImageRef
from app.models.enums import MoodboardStatus, NodeKey, RunStatus, STAGE_ABBREVIATIONS, STAGE_ORDER
from app.models.garment import Garment
from app.models.node_run import AIMeta, NodeOutput, NodeRun, RunInputRef
from app.models.season import Season
from app.services.avatar_reference import (
    DEFAULT_MODEL_AVATAR,
    category_display_name,
    model_description,
)
from app.services.generation_helpers import build_placeholder_image, fetch_image_bytes
from app.services.imagekit import upload_image

logger = logging.getLogger("photoshoot_studio")
router = APIRouter(tags=["photoshoot"])


# ─── Request model ──────────────────────────────────────────────────


class PhotoshootGenerateRequest(BaseModel):
    visualization_image_url: str  # DesignImage id from library (Stage 6 output) — required
    moodboard_influence: bool = True
    shot_type: str = "Single shot"
    location: str = "Urban street"
    time_of_day: str = "Golden hour"
    mood: str = "Editorial"
    pose: str = "Standing"
    custom_pose: str = ""
    additional_notes: str = ""
    num_outputs: int = 1


NEGATIVE_PROMPT = (
    "plastic mannequin, dress form, CGI rendering, 3D render look, studio backdrop, "
    "text, watermark, distorted hands, extra limbs, unrealistic skin, flat lighting"
)


# ─── Prompt builder (source of truth: the system_instruction spec given for this stage) ───


def _build_moodboard_text(season: Season) -> str:
    """Describe the season's moodboard mood for the AI to echo, if one exists."""
    mb = season.moodboard
    if not mb or mb.status != MoodboardStatus.READY:
        return ""

    parts = []
    if mb.analysis.keywords:
        parts.append(f"mood keywords: {', '.join(mb.analysis.keywords)}")
    if mb.analysis.palette:
        parts.append(f"color palette: {', '.join(mb.analysis.palette)}")
    if mb.analysis.brief:
        parts.append(f"brief: {mb.analysis.brief}")

    if not parts:
        return ""

    return (
        " Moodboard influence: let the scene's color grading, atmosphere, and overall "
        f"visual language echo this season's mood — {'; '.join(parts)}."
    )


def _build_photoshoot_prompt(
    category_display: str,
    model_avatar: str,
    shot_type: str,
    location: str,
    time_of_day: str,
    mood: str,
    pose: str,
    custom_pose: str,
    additional_notes: str,
    moodboard_text: str,
) -> str:
    model_desc = model_description(model_avatar)
    custom_pose_text = f" Custom pose details: {custom_pose}." if custom_pose else ""
    notes_text = f" Additional notes: {additional_notes}." if additional_notes else ""

    return (
        "**Photoshoot Rules:**\n"
        f"1. **Subject:** A real, professional fashion model — {model_desc} The model must look natural, "
        "with realistic skin texture and a relaxed, authentic expression.\n"
        f"2. **Garment & Material:** The model is wearing the exact {category_display} shown in the provided "
        "3D visualization reference image — same fabric texture, print, color, fit, and construction details, "
        "now rendered as real, photographable fabric reacting naturally to outdoor light.\n"
        f"3. **Shot Type:** {shot_type}. Compose the camera framing and layout to match this shot type exactly.\n"
        f"4. **Location:** {location}. Render a vivid, believable outdoor environment and background for this location.\n"
        f"5. **Time of Day:** {time_of_day}. Light the scene accordingly — direction, warmth, and shadow length must match.\n"
        f"6. **Mood:** {mood}. Set the color grading, contrast, and overall atmosphere to match this mood.\n"
        f"7. **Pose:** {pose}.{custom_pose_text}\n"
        "8. **Photography Quality:** Shoot like a real 85mm DSLR fashion editorial photograph, portrait 4:5 "
        "aspect ratio — sharp focus on the garment, soft background bokeh, natural fabric folds, "
        f"photorealistic. No mannequins, no studio backdrops, no CGI look.{moodboard_text}{notes_text}"
    )


# ─── Gemini image generation ────────────────────────────────────────


async def _generate_photoshoot_image(
    api_key: str,
    prompt: str,
    visualization_b64: str,
    visualization_mime: str,
    temperature: float = 0.5,
) -> Optional[bytes]:
    parts = [
        {"text": prompt},
        {"text": f"Avoid the following at all costs: {NEGATIVE_PROMPT}."},
        {
            "text": (
                "3D visualization reference — replace the mannequin with a real human model exactly as "
                "described above, keeping the garment's fabric texture, print, and color identical:"
            )
        },
        {
            "inlineData": {
                "mimeType": visualization_mime,
                "data": visualization_b64,
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
            logger.error(f"Gemini photoshoot gen returned {resp.status_code}: {resp.text[:500]}")
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
                        logger.info("Gemini generated photoshoot image successfully")
                        return base64.b64decode(b64)

    logger.warning("Gemini returned no photoshoot image")
    return None


# ─── Helpers ─────────────────────────────────────────────────────────


def _upload_to_imagekit(file_bytes: bytes, folder: str, file_name: str) -> dict:
    return upload_image(file_bytes, folder=folder, file_name=file_name)


# ─── Endpoint ───────────────────────────────────────────────────────


@router.post("/api/garments/{garment_id}/nodes/photoshoot/generate")
async def generate_photoshoot(
    garment_id: str,
    body: PhotoshootGenerateRequest,
    x_gemini_api_key: Optional[str] = Header(None, alias="X-Gemini-API-Key"),
):
    """
    Generate the final outdoor photoshoot image: the garment on a real human model,
    using the selected Stage 6 (3D Visualization) output as the garment/model reference.
    The model persona is carried forward from whichever one was used in that visualization
    — it is not re-selected here, so Stage 7 always matches Stage 6.
    """
    logger.info("=" * 60)
    logger.info("[SHOOT] POST /api/garments/%s/nodes/photoshoot/generate", garment_id)
    logger.info("[SHOOT] Request body: viz_image=%s, moodboard_influence=%s, shot_type=%s, location=%s, time=%s, mood=%s, pose=%s, custom_pose=%s, num_outputs=%d",
                body.visualization_image_url, body.moodboard_influence, body.shot_type,
                body.location, body.time_of_day, body.mood, body.pose,
                body.custom_pose or "(none)", body.num_outputs)

    garment = await Garment.get(garment_id)
    if not garment:
        logger.error("[SHOOT] Garment %s not found", garment_id)
        raise HTTPException(status_code=404, detail="Garment not found")
    if not garment.category:
        logger.error("[SHOOT] Garment %s has no category set", garment_id)
        raise HTTPException(status_code=400, detail="Garment has no category set")
    logger.info("[SHOOT] Garment: name=%s, category=%s, style_number=%d, version=%d",
                garment.name, garment.category.value, garment.style_number, garment.current_version)

    season = await Season.get(garment.season_id)
    if not season:
        logger.error("[SHOOT] Season %s not found", garment.season_id)
        raise HTTPException(status_code=404, detail="Season not found")
    logger.info("[SHOOT] Season: code=%s, moodboard.status=%s", season.code, season.moodboard.status if season.moodboard else "none")

    if not body.visualization_image_url:
        logger.error("[SHOOT] No visualization_image_url provided")
        raise HTTPException(status_code=400, detail="A 3D visualization image is required")

    # ─── Resolve visualization image (required) ───
    viz_img = await DesignImage.get(body.visualization_image_url)
    if viz_img:
        logger.info("[SHOOT] Viz image found in library: id=%s, code=%s, type=%s, model_avatar=%s",
                    str(viz_img.id), viz_img.image_code, viz_img.image_type,
                    (viz_img.params or {}).get("model_avatar", "?"))
        viz_bytes = await fetch_image_bytes(viz_img.url)
    else:
        logger.info("[SHOOT] visualization_image_url is not a DesignImage ID, treating as raw URL: %s", body.visualization_image_url[:80])
        viz_bytes = await fetch_image_bytes(body.visualization_image_url)

    if not viz_bytes:
        logger.error("[SHOOT] Failed to load visualization image bytes")
        raise HTTPException(status_code=400, detail="Failed to load 3D visualization image")

    viz_mime = (
        "image/jpeg"
        if viz_img and viz_img.url.lower().endswith((".jpg", ".jpeg"))
        else "image/png"
    )
    viz_b64 = base64.b64encode(viz_bytes).decode()
    logger.info("[SHOOT] Viz image loaded: %d bytes, mime=%s, b64_length=%d", len(viz_bytes), viz_mime, len(viz_b64))

    # Model persona is carried forward from the selected visualization — not re-picked here.
    model_avatar = (
        (viz_img.params or {}).get("model_avatar", DEFAULT_MODEL_AVATAR) if viz_img else DEFAULT_MODEL_AVATAR
    )
    logger.info("[SHOOT] Model avatar (carried from viz): %s", model_avatar)

    # ─── Create NodeRun ───
    existing = await NodeRun.find(
        NodeRun.garment_id == garment_id,
        NodeRun.node_key == NodeKey.PHOTOSHOOT,
    ).to_list()
    iteration = len(existing) + 1
    logger.info("[SHOOT] Existing runs for photoshoot: %d, new iteration=%d", len(existing), iteration)

    version = garment.current_version
    stage_index = STAGE_ORDER.index(NodeKey.PHOTOSHOOT)
    downstream_keys = STAGE_ORDER[stage_index + 1:]  # empty — photoshoot is the last stage
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
            logger.info("[SHOOT] Downstream runs exist — version bumped to %d", version)
    logger.info("[SHOOT] Final version=%d", version)

    code = (
        f"{season.code}_{garment.category.value}_{garment.style_number:03d}"
        f"_v{version}_{STAGE_ABBREVIATIONS[NodeKey.PHOTOSHOOT]}_R{iteration:02d}"
    )
    logger.info("[SHOOT] Generated code: %s", code)

    now = datetime.now(timezone.utc)

    run = NodeRun(
        season_id=garment.season_id,
        garment_id=garment_id,
        node_key=NodeKey.PHOTOSHOOT,
        iteration=iteration,
        version=version,
        code=code,
        status=RunStatus.PROCESSING,
        inputs=[RunInputRef(run_id=viz_img.run_id, node_key=NodeKey.VISUALIZATION)] if viz_img else [],
        output=NodeOutput(),
        output_image_ids=[],
        ai=AIMeta(started_at=now),
        created_at=now,
        updated_at=now,
    )
    await run.insert()
    logger.info("[SHOOT] NodeRun created: id=%s, status=processing", str(run.id))

    # ─── Build prompt ───
    category_code = garment.category.value
    category_display = category_display_name(category_code)
    moodboard_text = _build_moodboard_text(season) if body.moodboard_influence else ""
    logger.info("[SHOOT] Moodboard influence: %s, moodboard_text present: %s", body.moodboard_influence, bool(moodboard_text))
    if moodboard_text:
        logger.info("[SHOOT] Moodboard text: %s", moodboard_text[:200])
    prompt = _build_photoshoot_prompt(
        category_display=category_display,
        model_avatar=model_avatar,
        shot_type=body.shot_type,
        location=body.location,
        time_of_day=body.time_of_day,
        mood=body.mood,
        pose=body.pose,
        custom_pose=body.custom_pose,
        additional_notes=body.additional_notes,
        moodboard_text=moodboard_text,
    )
    logger.info("[SHOOT] Prompt built (%d chars): %s...", len(prompt), prompt[:300])

    # ─── Generate via Gemini ───
    api_key = (x_gemini_api_key or "").strip() or (settings.ai_key or "").strip()
    generated_images = []  # list of {"bytes": bytes, "source": str}

    num_outputs = max(1, min(4, body.num_outputs))
    logger.info("[SHOOT] num_outputs=%d, api_key present=%s", num_outputs, bool(api_key))

    if api_key:
        try:
            for idx in range(num_outputs):
                logger.info("[SHOOT] Calling Gemini for output %d/%d (temperature=%.2f)...", idx + 1, num_outputs, 0.5 + (0.1 * idx))
                img_bytes = await _generate_photoshoot_image(
                    api_key, prompt, viz_b64, viz_mime,
                    temperature=0.5 + (0.1 * idx),
                )
                if img_bytes:
                    generated_images.append({"bytes": img_bytes, "source": "ai"})
                    logger.info("[SHOOT] Gemini output %d: %d bytes", idx + 1, len(img_bytes))
                else:
                    logger.warning("[SHOOT] Gemini output %d: no image returned", idx + 1)
            if generated_images:
                run.ai.model = "gemini-2.5-flash-image"
                run.ai.prompt = prompt
                logger.info("[SHOOT] Gemini generation complete: %d images", len(generated_images))
        except Exception as e:
            logger.error("[SHOOT] Gemini photoshoot generation failed: %s", e, exc_info=True)

    # ─── Fallback: lightweight placeholder if AI unavailable/failed ───
    if not generated_images:
        logger.warning("[SHOOT] No AI images generated — falling back to PIL placeholder")
        placeholder_bytes = build_placeholder_image(
            "[Photoshoot]",
            f"{model_avatar} — {category_display} — AI generation unavailable",
            size=(1000, 1250),  # 4:5 portrait, matches the spec's photography aspect ratio
        )
        generated_images.append({"bytes": placeholder_bytes, "source": "pil-fallback"})
        run.ai.model = "pil-fallback"
        logger.info("[SHOOT] Placeholder created: %d bytes", len(placeholder_bytes))

    # ─── Upload to ImageKit + Create DesignImage documents ───
    output_image_ids = []
    design_images = []

    input_refs = []
    if viz_img:
        input_refs.append(InputImageRef(image_id=str(viz_img.id), stage=NodeKey.VISUALIZATION, role="primary"))
        logger.info("[SHOOT] Input lineage: viz image_id=%s", str(viz_img.id))

    for idx, img_data in enumerate(generated_images):
        count_str = f"{idx + 1:02d}"
        img_code = f"{code}_{count_str}"

        file_name = f"{img_code}.png"
        folder = f"/design-studio/{garment.season_id}/{garment_id}/photoshoots/"

        try:
            logger.info("[SHOOT] Uploading to ImageKit: %s (%d bytes)", img_code, len(img_data["bytes"]))
            ik_result = _upload_to_imagekit(img_data["bytes"], folder=folder, file_name=file_name)
            img_url = ik_result["url"]
            ik_file_id = ik_result["file_id"]
            logger.info("[SHOOT] ImageKit upload OK: %s -> %s", img_code, img_url[:80])
        except Exception as e:
            logger.error("[SHOOT] ImageKit upload failed for %s: %s", img_code, e)
            b64 = base64.b64encode(img_data["bytes"]).decode()
            img_url = f"data:image/png;base64,{b64}"
            ik_file_id = None
            logger.warning("[SHOOT] Using data URL fallback for %s", img_code)

        design_img = DesignImage(
            image_code=img_code,
            index=idx,
            season_id=garment.season_id,
            garment_id=garment_id,
            node_key=NodeKey.PHOTOSHOOT,
            run_id=str(run.id),
            version=version,
            image_type="photo",
            view="model",
            liked=False,
            starred=False,
            input_images=input_refs,
            source=img_data["source"],
            ai_model=run.ai.model,
            ai_prompt=prompt,
            params={
                "model_avatar": model_avatar,
                "moodboard_influence": body.moodboard_influence,
                "shot_type": body.shot_type,
                "location": body.location,
                "time_of_day": body.time_of_day,
                "mood": body.mood,
                "pose": body.pose,
                "custom_pose": body.custom_pose,
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
        logger.info("[SHOOT] DesignImage created: id=%s, code=%s, source=%s", str(design_img.id), img_code, img_data["source"])

    # ─── Update NodeRun ───
    run.output = NodeOutput(images=[img.url for img in design_images])
    run.output_image_ids = output_image_ids
    run.status = RunStatus.COMPLETE
    run.ai.completed_at = datetime.now(timezone.utc)
    await run.save()
    logger.info("[SHOOT] NodeRun completed: id=%s, status=complete, images=%d", str(run.id), len(design_images))
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
        "model_avatar": model_avatar,
    }
