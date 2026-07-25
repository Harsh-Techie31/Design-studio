from datetime import datetime, timezone
from typing import Optional

from beanie import Document
from pydantic import BaseModel, Field

from .enums import ImageSource, MoodboardStatus


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class MoodboardImage(BaseModel):
    url: str
    imagekit_file_id: Optional[str] = None
    source: ImageSource = ImageSource.UPLOAD
    order: int = 0


class MoodboardAnalysis(BaseModel):
    palette: list[str] = Field(default_factory=list)
    keywords: list[str] = Field(default_factory=list)
    brief: Optional[str] = None
    model: Optional[str] = None
    analyzed_at: Optional[datetime] = None
    error: Optional[str] = None


class MoodboardData(BaseModel):
    name: Optional[str] = None
    status: MoodboardStatus = MoodboardStatus.EMPTY
    images: list[MoodboardImage] = Field(default_factory=list)
    analysis: MoodboardAnalysis = Field(default_factory=MoodboardAnalysis)


class Season(Document):
    code: Optional[str] = None
    moodboard: MoodboardData = Field(default_factory=MoodboardData)
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "seasons"
