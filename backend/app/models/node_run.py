from datetime import datetime, timezone
from typing import Optional

from beanie import Document, Indexed
from pydantic import BaseModel, Field
from pymongo import ASCENDING, IndexModel
from typing_extensions import Annotated

from .enums import NodeKey, RunStatus


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class RunInputRef(BaseModel):
    """Provenance link: this run was generated using another run's output as context."""

    run_id: str
    node_key: NodeKey


class AIMeta(BaseModel):
    model: Optional[str] = None
    prompt: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error: Optional[str] = None
    retry_count: int = 0


class NodeOutput(BaseModel):
    images: list[str] = Field(default_factory=list)
    text: Optional[str] = None
    extra: dict = Field(default_factory=dict)


class NodeRun(Document):
    season_id: Annotated[str, Indexed()]
    garment_id: Annotated[str, Indexed()]
    node_key: Annotated[NodeKey, Indexed()]
    iteration: int
    version: int = 1
    code: Optional[str] = None

    status: RunStatus = RunStatus.PENDING
    liked: bool = False
    inputs: list[RunInputRef] = Field(default_factory=list)
    output: NodeOutput = Field(default_factory=NodeOutput)
    output_image_ids: list[str] = Field(default_factory=list)
    ai: AIMeta = Field(default_factory=AIMeta)

    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "node_runs"
        indexes = [
            IndexModel(
                [("garment_id", ASCENDING), ("node_key", ASCENDING), ("iteration", ASCENDING)],
                unique=True,
            ),
            IndexModel([("garment_id", ASCENDING), ("node_key", ASCENDING), ("liked", ASCENDING)]),
        ]
