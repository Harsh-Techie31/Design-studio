from enum import Enum


class NodeKey(str, Enum):
    SKETCH = "sketch"
    FABRIC = "fabric"
    RENDER = "render"
    TECH_PACK = "techPack"
    PATTERN = "pattern"
    VISUALIZATION = "visualization"
    PHOTOSHOOT = "photoshoot"


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
