from enum import Enum


class NodeKey(str, Enum):
    SKETCH = "sketch"
    FABRIC = "fabric"
    RENDER = "render"
    TECH_PACK = "techPack"
    PATTERN = "pattern"
    VISUALIZATION = "visualization"
    PHOTOSHOOT = "photoshoot"


STAGE_ORDER = [
    NodeKey.SKETCH,
    NodeKey.FABRIC,
    NodeKey.RENDER,
    NodeKey.TECH_PACK,
    NodeKey.PATTERN,
    NodeKey.VISUALIZATION,
    NodeKey.PHOTOSHOOT,
]

STAGE_ABBREVIATIONS = {
    NodeKey.SKETCH: "SKTCH",
    NodeKey.FABRIC: "FBRC",
    NodeKey.RENDER: "RNDR",
    NodeKey.TECH_PACK: "TECH",
    NodeKey.PATTERN: "PTRN",
    NodeKey.VISUALIZATION: "3D",
    NodeKey.PHOTOSHOOT: "SHOOT",
}


class GarmentCategory(str, Enum):
    SHIRT = "SHIRT"
    TEE = "TEE"
    TOP = "TOP"
    DRESS = "DRESS"
    SKIRT = "SKIRT"
    PANT = "PANT"
    SHORT = "SHORT"
    JACKET = "JACKET"
    SWEATSHIRT = "SWTSHRT"
    JUMPSUIT = "JUMP"


class RunStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETE = "complete"
    FAILED = "failed"


class MoodboardStatus(str, Enum):
    EMPTY = "empty"
    UPLOADING = "uploading"
    ANALYZING = "analyzing"
    READY = "ready"
    FAILED = "failed"


class ImageSource(str, Enum):
    UPLOAD = "upload"
    PINTEREST = "pinterest"


class ImageType(str, Enum):
    SKETCH = "sketch"
    FABRIC = "fabric"
    RENDER = "render"
    PRINT = "print"
    TECH_PACK = "tech_pack"
    PATTERN = "pattern"
    THREE_D = "3d"
    PHOTO = "photo"
    MOODBOARD = "moodboard"
    REFERENCE = "reference"
