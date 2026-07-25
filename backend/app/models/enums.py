from enum import Enum


class NodeKey(str, Enum):
    RESEARCH = "research"
    SKETCH = "sketch"
    FABRIC = "fabric"
    COLOR_TRIM = "colorTrim"
    PATTERN = "pattern"
    MOCKUP = "mockup"
    FIT_CHECK = "fitCheck"
    MODEL_SHOOT = "modelShoot"


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
