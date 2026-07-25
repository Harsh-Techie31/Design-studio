from pydantic import BaseModel

from app.models.enums import GarmentCategory


class GarmentCreate(BaseModel):
    name: str
    category: GarmentCategory


class GarmentUpdate(BaseModel):
    name: str | None = None
    category: GarmentCategory | None = None


class GarmentResponse(BaseModel):
    id: str
    season_id: str
    name: str
    category: str
    style_number: int
    current_version: int
    node_summary: dict
    created_at: str
    updated_at: str
