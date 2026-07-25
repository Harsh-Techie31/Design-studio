from pydantic import BaseModel

from app.models.enums import ImageSource


class MoodboardImageResponse(BaseModel):
    url: str
    imagekit_file_id: str | None = None
    source: ImageSource
    order: int
