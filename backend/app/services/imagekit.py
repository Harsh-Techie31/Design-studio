import asyncio
import logging

from imagekitio import ImageKit

from app.config import settings

logger = logging.getLogger("imagekit")

_imagekit: ImageKit | None = None


def _get_imagekit_sync() -> ImageKit:
    global _imagekit
    if _imagekit is None:
        if not settings.imagekit_private_key:
            raise RuntimeError("IMAGEKIT_PRIVATE_KEY is not configured")
        _imagekit = ImageKit(
            private_key=settings.imagekit_private_key,
        )
    return _imagekit


def _upload_sync(file_bytes: bytes, folder: str, file_name: str) -> dict:
    ik = _get_imagekit_sync()
    result = ik.files.upload(
        file=file_bytes,
        file_name=file_name,
        folder=folder,
        use_unique_file_name=True,
    )
    return {"file_id": result.file_id, "url": result.url}


def _delete_sync(file_id: str) -> None:
    ik = _get_imagekit_sync()
    ik.files.delete(file_id=file_id)


async def upload_image(file_bytes: bytes, folder: str, file_name: str) -> dict:
    return await asyncio.to_thread(_upload_sync, file_bytes, folder, file_name)


async def delete_image(file_id: str) -> None:
    await asyncio.to_thread(_delete_sync, file_id)
