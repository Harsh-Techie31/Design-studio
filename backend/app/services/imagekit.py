from imagekitio import ImageKit

from app.config import settings

_imagekit: ImageKit | None = None


def get_imagekit() -> ImageKit:
    global _imagekit
    if _imagekit is None:
        _imagekit = ImageKit(
            private_key=settings.imagekit_private_key,
        )
    return _imagekit


def upload_image(file_bytes: bytes, folder: str, file_name: str) -> dict:
    ik = get_imagekit()
    result = ik.files.upload(
        file=file_bytes,
        file_name=file_name,
        folder=folder,
        use_unique_file_name=True,
    )
    return {"file_id": result.file_id, "url": result.url}


def delete_image(file_id: str) -> None:
    ik = get_imagekit()
    ik.files.delete(file_id=file_id)
