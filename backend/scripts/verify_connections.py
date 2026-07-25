"""One-off script: verify MongoDB Atlas and ImageKit credentials actually work.

Inserts + deletes a throwaway Season document in Mongo, and uploads + deletes a
throwaway 1x1 PNG in ImageKit. Nothing real is left behind either way.
"""

import asyncio
import base64
import sys

sys.path.insert(0, ".")

from app.config import settings  # noqa: E402

TINY_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
)


async def check_mongo() -> bool:
    from beanie import init_beanie
    from motor.motor_asyncio import AsyncIOMotorClient

    from app.models import DOCUMENT_MODELS, Season

    print(f"[mongo] connecting to db '{settings.mongodb_db_name}' ...")
    client = AsyncIOMotorClient(settings.mongodb_uri, serverSelectionTimeoutMS=8000)
    try:
        await client.admin.command("ping")
        print("[mongo] ping OK — cluster reachable")

        await init_beanie(database=client[settings.mongodb_db_name], document_models=DOCUMENT_MODELS)

        doc = Season(name="__connection_test__")
        await doc.insert()
        print(f"[mongo] inserted test Season _id={doc.id}")

        fetched = await Season.get(doc.id)
        assert fetched is not None and fetched.name == "__connection_test__"
        print("[mongo] read-back OK")

        await doc.delete()
        remaining = await Season.get(doc.id)
        assert remaining is None
        print("[mongo] cleanup OK — test document removed")
        return True
    except Exception as e:
        print(f"[mongo] FAILED: {type(e).__name__}: {e}")
        return False
    finally:
        client.close()


def check_imagekit() -> bool:
    from imagekitio import ImageKit

    print("[imagekit] uploading test file ...")
    try:
        ik = ImageKit(private_key=settings.imagekit_private_key)
        result = ik.files.upload(
            file=TINY_PNG,
            file_name="connection_test.png",
            folder="/_connection_tests/",
            use_unique_file_name=True,
        )
        file_id = result.file_id
        print(f"[imagekit] upload OK — file_id={file_id} url={result.url}")

        ik.files.delete(file_id=file_id)
        print("[imagekit] cleanup OK — test file deleted")
        return True
    except Exception as e:
        print(f"[imagekit] FAILED: {type(e).__name__}: {e}")
        return False


async def main() -> None:
    mongo_ok = await check_mongo()
    imagekit_ok = check_imagekit()

    print()
    print(f"MongoDB : {'PASS' if mongo_ok else 'FAIL'}")
    print(f"ImageKit: {'PASS' if imagekit_ok else 'FAIL'}")

    if not (mongo_ok and imagekit_ok):
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
