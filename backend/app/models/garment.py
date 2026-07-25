from datetime import datetime, timezone
from typing import Optional

from beanie import Document, Indexed
from pydantic import BaseModel, Field
from typing_extensions import Annotated

from .enums import GarmentCategory, NodeKey


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class NodeSummary(BaseModel):
    """Denormalized read cache derived from `node_runs` — never the source of truth."""

    run_count: int = 0
    liked_count: int = 0
    has_processing: bool = False
    has_failed: bool = False
    last_run_at: Optional[datetime] = None


class Garment(Document):
    season_id: Annotated[str, Indexed()]
    name: str
    category: GarmentCategory
    current_version: int = 1
    node_summary: dict[NodeKey, NodeSummary] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "garments"
