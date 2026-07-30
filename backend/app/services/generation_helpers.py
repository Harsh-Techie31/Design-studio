"""Shared helpers for stages that fetch a library image and generate against it."""

import base64
import io
import logging

import httpx
from PIL import Image, ImageDraw, ImageFont

logger = logging.getLogger("generation_helpers")


async def fetch_image_bytes(url: str) -> bytes | None:
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


def build_placeholder_image(
    title: str,
    subtitle: str,
    size: tuple[int, int] = (1200, 750),
) -> bytes:
    """Lightweight fallback image used when AI generation is unavailable/fails."""
    img = Image.new("RGB", size, (244, 242, 238))
    draw = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype("arial.ttf", 26)
        font_small = ImageFont.truetype("arial.ttf", 15)
    except Exception:
        font = ImageFont.load_default()
        font_small = font

    w, h = size
    draw.text((w // 2 - 160, h // 2 - 20), title, fill=(160, 160, 160), font=font)
    draw.text((w // 2 - 240, h // 2 + 20), subtitle, fill=(180, 180, 180), font=font_small)

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()
