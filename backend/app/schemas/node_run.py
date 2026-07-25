from pydantic import BaseModel

from app.models.enums import NodeKey, RunStatus


class NodeRunCreate(BaseModel):
    inputs: list[dict] | None = None


class NodeRunResponse(BaseModel):
    id: str
    season_id: str
    garment_id: str
    node_key: NodeKey
    iteration: int
    version: int
    code: str
    status: RunStatus
    liked: bool
    inputs: list[dict]
    output: dict
    ai: dict
    created_at: str
    updated_at: str


class NodeRunLikeToggle(BaseModel):
    liked: bool
