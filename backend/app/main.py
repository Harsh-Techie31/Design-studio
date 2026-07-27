import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .db import init_db
from .routes.seasons import router as seasons_router
from .routes.garments import router as garments_router
from .routes.moodboard import router as moodboard_router
from .routes.node_runs import router as node_runs_router
from .routes.design_images import router as design_images_router
from .routes.sketch import router as sketch_router
from .routes.print import router as print_router
from .routes.render import router as render_router
from .routes.techpack import router as techpack_router
from .routes.pattern import router as pattern_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="Design Studio API", lifespan=lifespan)

cors_origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
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
app.include_router(print_router)
app.include_router(render_router)
app.include_router(techpack_router)
app.include_router(pattern_router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
