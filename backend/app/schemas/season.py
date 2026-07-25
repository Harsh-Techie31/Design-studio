import re

from pydantic import BaseModel, field_validator

CODE_PATTERN = re.compile(r"^[A-Z0-9]{1,12}$")


def _normalize_code(v: str) -> str:
    v = v.strip().upper().replace(" ", "")
    if not CODE_PATTERN.match(v):
        raise ValueError("Season code must be 1-12 alphanumeric characters (e.g. SS27, AW27)")
    return v


class SeasonCreate(BaseModel):
    code: str

    @field_validator("code")
    @classmethod
    def validate_code(cls, v: str) -> str:
        return _normalize_code(v)


class SeasonUpdate(BaseModel):
    code: str | None = None

    @field_validator("code")
    @classmethod
    def validate_code(cls, v: str | None) -> str | None:
        return _normalize_code(v) if v is not None else v


class SeasonResponse(BaseModel):
    id: str
    code: str
    moodboard: dict
    created_at: str
    updated_at: str
