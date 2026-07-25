"""Seed the design_studio database with mock data from the frontend."""

import asyncio
import sys
from datetime import datetime, timezone

sys.path.insert(0, ".")

from motor.motor_asyncio import AsyncIOMotorClient

from app.config import settings

NOW = datetime.now(timezone.utc)


def hsl_to_hex(h: int, s: int, l: int) -> str:
    s /= 100
    l /= 100
    k = lambda n: (n + h / 30) % 12
    a = s * min(l, 1 - l)
    f = lambda n: l - a * max(-1, min(k(n) - 3, min(9 - k(n), 1)))
    to_hex = lambda n: format(round(255 * f(n)), "02x")
    return f"#{to_hex(0)}{to_hex(8)}{to_hex(4)}"


def palette_for_seed(seed: int) -> list[str]:
    base = (seed * 47) % 360
    sats = [58, 32, 74, 20, 45]
    ligs = [22, 68, 45, 12, 82]
    return [hsl_to_hex((base + i * 27) % 360, sats[i], ligs[i]) for i in range(5)]


KEYWORD_POOL = [
    "raw silk", "brutalist", "sun-bleached", "nocturne", "archive",
    "soft tailoring", "industrial", "botanical", "monastic", "coastal fog",
    "patina", "translucent", "deconstructed", "quiet luxury", "terracotta", "static",
]


def keywords_for_seed(seed: int) -> list[str]:
    return [KEYWORD_POOL[(seed + i * 3) % len(KEYWORD_POOL)] for i in range(4)]


def placeholder_moodboard() -> list[dict]:
    return [
        {
            "url": f"mood-placeholder:{i}",
            "imagekit_file_id": None,
            "source": "upload",
            "order": i,
        }
        for i in range(12)
    ]


async def main():
    client = AsyncIOMotorClient(settings.mongodb_uri)
    db = client[settings.mongodb_db_name]

    await db.seasons.drop()
    await db.garments.drop()
    await db.node_runs.drop()
    print("Cleared existing data")

    # Insert seasons — let MongoDB generate ObjectIDs
    season_docs = [
        {
            "name": "Ash & Ember",
            "moodboard": {
                "status": "ready",
                "images": placeholder_moodboard(),
                "analysis": {
                    "palette": palette_for_seed(3),
                    "keywords": keywords_for_seed(3),
                    "brief": None,
                    "model": None,
                    "analyzed_at": NOW,
                    "error": None,
                },
            },
            "created_at": NOW,
            "updated_at": NOW,
        },
        {
            "name": "Quiet Coastline",
            "moodboard": {
                "status": "ready",
                "images": placeholder_moodboard(),
                "analysis": {
                    "palette": palette_for_seed(9),
                    "keywords": keywords_for_seed(9),
                    "brief": None,
                    "model": None,
                    "analyzed_at": NOW,
                    "error": None,
                },
            },
            "created_at": NOW,
            "updated_at": NOW,
        },
    ]

    result = await db.seasons.insert_many(season_docs)
    s1_id = result.inserted_ids[0]
    s2_id = result.inserted_ids[1]
    print(f"Inserted 2 seasons: s1={s1_id}, s2={s2_id}")

    # Insert garments referencing the real season IDs
    garment_docs = [
        {
            "season_id": str(s1_id),
            "name": "Frayed Silk Trench",
            "node_summary": {},
            "created_at": datetime(2026, 6, 2, tzinfo=timezone.utc),
            "updated_at": datetime(2026, 6, 2, tzinfo=timezone.utc),
        },
        {
            "season_id": str(s1_id),
            "name": "Wide-Leg Ash Trouser",
            "node_summary": {},
            "created_at": datetime(2026, 6, 4, tzinfo=timezone.utc),
            "updated_at": datetime(2026, 6, 4, tzinfo=timezone.utc),
        },
        {
            "season_id": str(s1_id),
            "name": "Bonded Shell Jacket",
            "node_summary": {},
            "created_at": datetime(2026, 6, 6, tzinfo=timezone.utc),
            "updated_at": datetime(2026, 6, 6, tzinfo=timezone.utc),
        },
        {
            "season_id": str(s2_id),
            "name": "Draped Column Dress",
            "node_summary": {},
            "created_at": datetime(2026, 5, 14, tzinfo=timezone.utc),
            "updated_at": datetime(2026, 5, 14, tzinfo=timezone.utc),
        },
    ]

    await db.garments.insert_many(garment_docs)
    print(f"Inserted 4 garments")

    client.close()
    print("Seed complete!")


if __name__ == "__main__":
    asyncio.run(main())
