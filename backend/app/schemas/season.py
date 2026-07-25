from pydantic import BaseModel


class SeasonCreate(BaseModel):
    name: str


class SeasonUpdate(BaseModel):
    name: str | None = None


class SeasonResponse(BaseModel):
    id: str
    name: str
    moodboard: dict
    created_at: str
    updated_at: str
