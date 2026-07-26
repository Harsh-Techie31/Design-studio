import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db import init_db
from .routes.seasons import router as seasons_router
from .routes.garments import router as garments_router
from .routes.moodboard import router as moodboard_router
from .routes.node_runs import router as node_runs_router
from .routes.design_images import router as design_images_router
from .routes.sketch import router as sketch_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="Design Studio API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(seasons_router)
app.include_router(garments_router)
app.include_router(moodboard_router)
app.include_router(node_runs_router)
app.include_router(design_images_router)
app.include_router(sketch_router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
