from pydantic import BaseModel


class GarmentCreate(BaseModel):
    name: str


class GarmentUpdate(BaseModel):
    name: str | None = None


class GarmentResponse(BaseModel):
    id: str
    season_id: str
    name: str
    node_summary: dict
    created_at: str
    updated_at: str
