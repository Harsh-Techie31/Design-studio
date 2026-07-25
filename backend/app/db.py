from typing import Optional

from beanie import init_beanie
from motor.motor_asyncio import AsyncIOMotorClient

from .config import settings
from .models import DOCUMENT_MODELS

client: Optional[AsyncIOMotorClient] = None


async def init_db() -> None:
    global client
    client = AsyncIOMotorClient(settings.mongodb_uri)
    await init_beanie(database=client[settings.mongodb_db_name], document_models=DOCUMENT_MODELS)
