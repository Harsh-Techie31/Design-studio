from datetime import datetime, timezone
from typing import Optional

from beanie import Document, Indexed
from pydantic import BaseModel, Field
from pymongo import ASCENDING, IndexModel
from typing_extensions import Annotated

from .enums import NodeKey, ImageType


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class InputImageRef(BaseModel):
    """Which image from the library was used as input to generate this image."""

    image_id: str
    stage: NodeKey
    role: str = "primary"  # "primary", "reference", "style"


class DesignImage(Document):
    # ─── Identity ───
    image_code: str  # "SS27_PANT_001_v1_SKTCH_R01"
    index: int  # 0-based position in batch

    # ─── Hierarchy ───
    season_id: Annotated[str, Indexed()]
    garment_id: Annotated[str, Indexed()]
    node_key: Annotated[NodeKey, Indexed()]  # which stage produced this
    run_id: Annotated[str, Indexed()]  # which NodeRun produced this
    version: int = 1

    # ─── Classification ───
    image_type: Annotated[str, Indexed()]  # "sketch", "fabric", "render", etc.
    view: str = ""  # "front", "back", "front_and_back", "flat", "3d", "model"

    # ─── State ───
    liked: bool = False  # user picked this to move forward
    starred: bool = False  # wishlist / bookmark

    # ─── Lineage (CRITICAL for downstream stages) ───
    input_images: list[InputImageRef] = Field(default_factory=list)
    # ^^^ which images from the library were used as input to generate THIS image.
    #     Stage 2 (fabric) → points to liked sketch image(s).
    #     Stage 3 (render) → points to liked sketch + liked fabric.
    #     Stage 6 (3d) → points to liked render.
    #     Stage 7 (photoshoot) → points to liked 3d.

    # ─── Provenance ───
    source: str = "generated"  # "generated", "uploaded", "ai", "pil"
    ai_model: Optional[str] = None  # "gemini-2.5-flash", "pil-v1"
    ai_prompt: Optional[str] = None  # full prompt sent to AI

    # ─── Generation Parameters (for reproducibility) ───
    params: dict = Field(default_factory=dict)
    # Sketch: {"gender", "silhouette", "descriptors", "mood_influence", "moodboard_refs"}
    # Fabric: {"fabric_name", "pattern_type", "color_override"}
    # Render: {"style", "lighting"}

    # ─── File ───
    url: str  # ImageKit URL or data URL
    imagekit_file_id: Optional[str] = None
    file_size_bytes: Optional[int] = None
    width: Optional[int] = None
    height: Optional[int] = None
    file_format: str = "png"  # "png", "jpg", "webp"

    # ─── User Metadata ───
    note: str = ""  # user annotation (250 char)
    tags: list[str] = Field(default_factory=list)  # custom user tags

    # ─── Lifecycle ───
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "design_images"
        indexes = [
            IndexModel([("season_id", ASCENDING), ("image_type", ASCENDING)]),
            IndexModel([("garment_id", ASCENDING), ("node_key", ASCENDING)]),
            IndexModel([("season_id", ASCENDING), ("liked", ASCENDING)]),
            IndexModel([("garment_id", ASCENDING), ("liked", ASCENDING)]),
            IndexModel(
                [
                    ("season_id", ASCENDING),
                    ("node_key", ASCENDING),
                    ("liked", ASCENDING),
                ]
            ),
            IndexModel([("run_id", ASCENDING)]),
            IndexModel([("image_code", ASCENDING)], unique=True),
        ]
