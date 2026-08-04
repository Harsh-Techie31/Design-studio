import base64
import json
import logging
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
from app.services.imagekit import upload_image

logger = logging.getLogger("render_studio")
router = APIRouter(tags=["render"])


# ─── Request models ─────────────────────────────────────────────────


class FabricSlot(BaseModel):
    image_url: str  # URL from library or data URL from upload
    image_id: str = ""  # DesignImage ID from library (if available)
    placements: list[str] = []
    prompt: str = ""
    scale: float = 1.0


class RenderGenerateRequest(BaseModel):
    sketch_image: str  # base64 data URL or URL from library
    sketch_image_id: str = ""  # DesignImage ID from library (if available)
    gender: str = "male"
    num_outputs: int = 1
    fabrics: list[FabricSlot] = []
    note: str = ""


# ─── Gemini prompt synthesis ────────────────────────────────────────


def _build_fallback_prompt(
    gender: str,
    fabrics: list[dict],
    sketch_desc: str = "",
) -> str:
    """Local fallback prompt builder when Gemini text model is unavailable."""
    fabric_instructions = ""
    for i, f in enumerate(fabrics):
        name = f.get("prompt", f"Fabric #{i+1}")
        placements = f.get("placements", [])
        custom_notes = f" User instructions: {f['prompt']}" if f.get("prompt") else ""
        fabric_instructions += (
            f"Fabric {i+1} ({name}): "
            f"Target zones: {', '.join(placements) if placements else 'full garment'}."
            f"{custom_notes} | "
        )

    prompt = (
        f"A clean, full-color 2D technical flat CAD fashion render of a {gender} garment. "
        f"Strictly maintain the exact structural lines, silhouette, and construction details of the provided input sketch. "
        f"Material Mapping: {fabric_instructions} "
        f"Visual Style: Completely flat 2D layout. The fabrics must look flatly printed onto the designated garment panels. "
        f"Construction details including seam lines and topstitching must remain visibly overlaid on top of the applied fabrics. "
        f"STRICT INSTRUCTIONS: Pure solid white background. Absolute zero 3D volume, zero drape, zero shadows. "
        f"No mannequins, no human body parts."
    )
    return prompt


async def _synthesize_prompt(
    api_key: str,
    sketch_b64: str,
    sketch_mime: str,
    gender: str,
    fabrics: list[dict],
) -> str:
    """
    Step 1: Use Gemini text model to synthesize a detailed render prompt
    from the sketch image + fabric swatches + user descriptions.
    """
    system_instruction = (
        "You are an expert AI fashion director and professional clothing designer.\n"
        "Your task is to write a highly detailed, professional prompt for an AI image generator "
        "that renders a clean 2D vector technical flat sketch of a garment from a user's sketch silhouette.\n\n"
        "You must integrate the following inputs into your prompt design:\n"
        f"- Style Gender Target: Designed for a {gender} cut and sizing.\n"
        "- Garment Silhouette: Analyze the user's sketch image. The final garment MUST strictly follow the structural lines, cuts, silhouette, and design features shown in this sketch.\n"
        "- Fabrics & Textures: Integrate the provided fabric images into specific parts of the garment. Refer to the fabric colors, textures, patterns, and their descriptions to describe exactly which parts of the garment use which fabric.\n\n"
        "CRITICAL DESIGN CONSTRAINTS:\n"
        "1. STRICT 2D VECTOR FLAT DRAWING / TECHNICAL CAD ILLUSTRATION STYLE: The output image must be a perfectly flat 2D vector technical sketch. It must have clean, crisp, solid black outer stroke lines. It must have ABSOLUTELY NO 3D volumetric effect, NO 3D body curvature, NO mannequin shadows, NO realistic depth or shadows, NO photorealistic folds, and NO human body parts. It must be an entirely flat, 2D vector design presentation on a plain white background.\n"
        "2. 2D FLAT TEXTURE MAPPING: The fabric patterns, colors, and textures must be filled flatly inside the outlines of their respective panels, without any 3D warp, shading, or realistic folding distortions.\n"
        "3. Construction details including seam lines and topstitching must remain visibly overlaid on top of the applied fabrics.\n"
        "4. Compile all fabrics into a SINGLE, cohesive, flat 2D garment render.\n"
        "5. IF the sketch contains pants, trousers, shorts, or any other lower-body garment, DO NOT apply any fabric pattern, texture, or color to that lower garment. Keep them completely plain with just black outlines.\n"
        "6. Output ONLY the raw prompt text itself. Do not include any introductory remarks, conversation, explanations, or codeblocks."
    )

    parts = [
        {"text": system_instruction},
        {"text": f"Garment gender target: {gender}"},
        {"text": "Here is the user's base garment sketch:"},
        {
            "inlineData": {
                "mimeType": sketch_mime,
                "data": sketch_b64,
            }
        },
    ]

    for i, fab in enumerate(fabrics):
        desc_text = f"Fabric #{i+1} Description: {fab.get('prompt', 'Seamless texture')}"
        p_list = fab.get("placements", [])
        if p_list:
            desc_text += f", Placement target areas on garment: {', '.join(p_list)}"
        if fab.get("scale"):
            desc_text += f", Texture scale multiplier: {fab['scale']}x"
        parts.append({"text": desc_text})
        if fab.get("image_b64"):
            parts.append({
                "inlineData": {
                    "mimeType": fab.get("mime", "image/jpeg"),
                    "data": fab["image_b64"],
                }
            })

    async with httpx.AsyncClient(timeout=30.0) as client:
        payload = {
            "contents": [{"role": "user", "parts": parts}],
            "generationConfig": {
                "temperature": 0.3,
                "maxOutputTokens": 1000,
            },
        }
        url = f"{settings.vertex_base_url}/gemini-2.5-flash:generateContent?key={api_key}"
        resp = await client.post(url, json=payload)

        if resp.status_code == 200:
            data = resp.json()
            text = (
                data.get("candidates", [{}])[0]
                .get("content", {})
                .get("parts", [{}])[0]
                .get("text", "")
                .strip()
            )
            if text:
                logger.info("Synthesized render prompt via Gemini")
                return text

    logger.warning("Gemini prompt synthesis failed, using fallback")
    return _build_fallback_prompt(gender, fabrics)


# ─── Gemini image generation ────────────────────────────────────────


async def _generate_image(
    api_key: str,
    sketch_b64: str,
    sketch_mime: str,
    prompt: str,
    fabrics: list[dict],
    temperature: float = 0.5,
) -> Optional[bytes]:
    """
    Step 2: Use Gemini to generate the final render image.
    Sends sketch + synthesized prompt + fabric swatches.
    Returns PNG bytes or None.
    """
    parts = [
        {"text": prompt},
        {"text": "Silhouette Sketch Reference:"},
        {
            "inlineData": {
                "mimeType": sketch_mime,
                "data": sketch_b64,
            }
        },
    ]

    for i, fab in enumerate(fabrics):
        if fab.get("image_b64"):
            parts.append({"text": f"Fabric swatch #{i+1} texture reference:"})
            parts.append({
                "inlineData": {
                    "mimeType": fab.get("mime", "image/jpeg"),
                    "data": fab["image_b64"],
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
        resp = await client.post(url, json=payload)

        if resp.status_code != 200:
            logger.error(f"Gemini image gen returned {resp.status_code}: {resp.text[:500]}")
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
                        logger.info("Gemini generated render image successfully")
                        return base64.b64decode(b64)

    logger.warning("Gemini returned no image in response")
    return None


# ─── Upload helper ──────────────────────────────────────────────────


def _upload_to_imagekit(file_bytes: bytes, folder: str, file_name: str) -> dict:
    return upload_image(file_bytes, folder=folder, file_name=file_name)


# ─── Helper: resolve image to base64 ────────────────────────────────


async def _resolve_image_to_base64(image_ref: str) -> tuple[str, str]:
    """
    Resolve an image reference (URL or data URL) to (base64_data, mime_type).
    For URLs, fetches the image. For data URLs, extracts directly.
    """
    if image_ref.startswith("data:"):
        header, b64data = image_ref.split(",", 1)
        mime = header.split(":")[1].split(";")[0]
        return b64data, mime

    # It's a URL - fetch it
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(image_ref)
        if resp.status_code != 200:
            raise HTTPException(status_code=400, detail=f"Failed to fetch image: {resp.status_code}")
        content_type = resp.headers.get("content-type", "image/jpeg")
        mime = content_type.split(";")[0].strip()
        b64 = base64.b64encode(resp.content).decode()
        return b64, mime


# ─── Endpoint ───────────────────────────────────────────────────────


@router.post("/api/garments/{garment_id}/nodes/render/generate")
async def generate_render(
    garment_id: str,
    body: RenderGenerateRequest,
    x_gemini_api_key: Optional[str] = Header(None, alias="X-Gemini-API-Key"),
):
    """
    Generate a 2D vector CAD render of a garment with fabric textures.
    Two-step AI flow:
      1. Gemini text synthesizes a detailed prompt from sketch + fabrics
      2. Gemini image generates the final render using the prompt
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
        NodeRun.node_key == NodeKey.RENDER,
    ).to_list()
    iteration = len(existing) + 1

    version = garment.current_version
    stage_index = STAGE_ORDER.index(NodeKey.RENDER)
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
        f"_v{version}_{STAGE_ABBREVIATIONS[NodeKey.RENDER]}_R{iteration:02d}"
    )

    from datetime import datetime, timezone

    now = datetime.now(timezone.utc)

    run = NodeRun(
        season_id=garment.season_id,
        garment_id=garment_id,
        node_key=NodeKey.RENDER,
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

    # ─── Resolve sketch image ───
    try:
        sketch_b64, sketch_mime = await _resolve_image_to_base64(body.sketch_image)
    except Exception as e:
        logger.error(f"Failed to resolve sketch image: {e}")
        raise HTTPException(status_code=400, detail="Failed to process sketch image")

    # ─── Resolve fabric images ───
    resolved_fabrics = []
    for fab in body.fabrics:
        try:
            fab_b64, fab_mime = await _resolve_image_to_base64(fab.image_url)
            resolved_fabrics.append({
                "image_b64": fab_b64,
                "mime": fab_mime,
                "prompt": fab.prompt,
                "placements": fab.placements,
                "scale": fab.scale,
            })
        except Exception as e:
            logger.warning(f"Failed to resolve fabric image, skipping: {e}")
            resolved_fabrics.append({
                "image_b64": None,
                "mime": "image/jpeg",
                "prompt": fab.prompt,
                "placements": fab.placements,
                "scale": fab.scale,
            })

    # ─── Call Gemini ───
    api_key = (x_gemini_api_key or "").strip() or (settings.ai_key or "").strip()
    generated_images = []  # list of {"bytes": bytes, "source": str}

    if api_key:
        try:
            # Step 1: Synthesize prompt
            synthesized_prompt = await _synthesize_prompt(
                api_key, sketch_b64, sketch_mime, body.gender, resolved_fabrics,
            )
            run.ai.prompt = synthesized_prompt
            logger.info(f"NEW PROMPT | {synthesized_prompt[:200]}")

            # Step 2: Generate images
            for idx in range(body.num_outputs):
                try:
                    img_bytes = await _generate_image(
                        api_key, sketch_b64, sketch_mime,
                        synthesized_prompt, resolved_fabrics,
                        temperature=0.5 + (0.1 * idx),
                    )
                    if img_bytes:
                        generated_images.append({"bytes": img_bytes, "source": "ai"})
                except Exception as e:
                    logger.error(f"Gemini image generation failed on iteration {idx}: {e}")

            run.ai.model = "gemini-3.1-flash-image"
        except Exception as e:
            logger.error(f"Gemini render generation failed: {e}")

    # ─── Fallback: return sketch as-is ───
    if not generated_images:
        logger.info("No AI images generated, using sketch as fallback")
        try:
            img_bytes = base64.b64decode(sketch_b64)
            generated_images.append({"bytes": img_bytes, "source": "sketch-passthrough"})
            run.ai.model = "sketch-passthrough"
        except Exception as e:
            logger.error(f"Failed to decode sketch for fallback: {e}")
            raise HTTPException(status_code=500, detail="Failed to process image")

    # ─── Upload to ImageKit + Create DesignImage documents ───
    output_image_ids = []
    design_images = []

    for idx, img_data in enumerate(generated_images):
        count_str = f"{idx + 1:02d}"
        img_code = f"{code}_{count_str}"

        file_name = f"{img_code}.png"
        folder = f"/design-studio/{garment.season_id}/{garment_id}/renders/"

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

        # Build input_images refs from sketch and fabrics
        input_refs = []
        if body.sketch_image_id:
            input_refs.append(InputImageRef(image_id=body.sketch_image_id, stage=NodeKey.SKETCH, role="primary"))
        for fi, fab in enumerate(body.fabrics):
            if fab.image_id:
                input_refs.append(InputImageRef(image_id=fab.image_id, stage=NodeKey.PRINT, role=f"fabric_{fi+1}"))

        design_img = DesignImage(
            image_code=img_code,
            index=idx,
            season_id=garment.season_id,
            garment_id=garment_id,
            node_key=NodeKey.RENDER,
            run_id=str(run.id),
            version=version,
            image_type="render",
            view="front",
            liked=False,
            starred=False,
            input_images=input_refs,
            source=img_data["source"],
            ai_model=run.ai.model,
            ai_prompt=run.ai.prompt,
            params={
                "gender": body.gender,
                "num_fabrics": len(body.fabrics),
                "fabric_placements": [f.placements for f in body.fabrics],
                "fabric_prompts": [f.prompt for f in body.fabrics],
                "fabric_scales": [f.scale for f in body.fabrics],
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
        "prompt": run.ai.prompt,
        "gender": body.gender,
        "num_fabrics": len(body.fabrics),
    }
