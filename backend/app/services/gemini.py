import json
import logging

import httpx

from app.config import settings

logger = logging.getLogger("gemini")

GEMINI_MODEL = "gemini-2.5-flash"
GEMINI_API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"

MAX_IMAGES = 5

ANALYSIS_PROMPT = """Analyze these fashion moodboard images. Return ONLY a JSON object, no extra text:
{
  "palette": ["#hex1", "#hex2", "#hex3", "#hex4", "#hex5"],
  "keywords": ["word1", "word2", "word3", "word4", "word5", "word6", "word7", "word8", "word9", "word10"],
  "brief": "30-40 word creative direction brief"
}
Rules: palette=5 dominant hex colors. keywords=10 single lowercase words. brief=one sentence, 30-40 words, fashion design direction. ONLY the JSON object."""


def _guess_mime(url: str) -> str:
    lower = url.split("?")[0].lower()
    if lower.endswith(".png"):
        return "image/png"
    if lower.endswith(".webp"):
        return "image/webp"
    return "image/jpeg"


async def analyze_moodboard(image_urls: list[str]) -> dict:
    """Send moodboard image URLs to Gemini and extract style profile."""

    real_urls = [u for u in image_urls if not u.startswith("mood-placeholder:")]
    real_urls = real_urls[:MAX_IMAGES]
    logger.info(f"analyze_moodboard: {len(real_urls)} real URLs (capped at {MAX_IMAGES})")

    if not real_urls:
        raise ValueError("No real images to analyze — all are placeholders")

    parts = []
    for url in real_urls:
        parts.append({
            "fileData": {
                "mimeType": _guess_mime(url),
                "fileUri": url,
            }
        })

    parts.append({"text": ANALYSIS_PROMPT})

    payload = {
        "contents": [{"parts": parts}],
        "generationConfig": {
            "temperature": 0.7,
            "topP": 0.95,
            "topK": 40,
            "maxOutputTokens": 2048,
            "responseMimeType": "application/json",
        },
    }

    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(
            f"{GEMINI_API_URL}?key={settings.ai_key}",
            json=payload,
        )
        logger.info(f"Gemini API response status: {resp.status_code}")
        resp.raise_for_status()

    data = resp.json()
    logger.info(f"Gemini full response keys: {list(data.keys())}")

    candidates = data.get("candidates", [])
    if not candidates:
        raise ValueError(f"Gemini returned no candidates: {data}")

    candidate = candidates[0]
    content = candidate.get("content", {})
    parts = content.get("parts", [])

    if not parts:
        logger.error(f"Gemini content has no parts. Full candidate: {json.dumps(candidate, indent=2)[:500]}")
        raise ValueError(f"Gemini returned no parts in content: {content}")

    text = parts[0].get("text", "")
    logger.info(f"Gemini raw response: {text[:300]}...")

    result = json.loads(text)

    palette = result.get("palette", [])[:5]
    keywords = result.get("keywords", [])[:10]
    brief = result.get("brief", "")

    words = brief.split()
    if len(words) > 45:
        brief = " ".join(words[:40]) + "..."

    return {
        "palette": palette,
        "keywords": keywords,
        "brief": brief,
        "model": GEMINI_MODEL,
    }
