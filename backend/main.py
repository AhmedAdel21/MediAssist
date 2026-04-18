from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from admin.router import router as admin_router
from agents.router import router as agents_router
from auth.router import router as auth_router
from config import settings
from database import init_db
from logging_config import get_logger, setup_logging
from logging_middleware import LoggingMiddleware
from rag.router import router as rag_router
from telemetry.setup import setup_telemetry

setup_logging()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("MediAssist AI starting up")
    await init_db()
    setup_telemetry()
    logger.info("Startup complete — database and telemetry ready")
    yield
    logger.info("MediAssist AI shutting down")


app = FastAPI(
    title="MediAssist AI",
    description="AI-powered clinical decision support platform",
    version="1.0.0",
    lifespan=lifespan,
)

origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]

app.add_middleware(LoggingMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(rag_router)
app.include_router(agents_router)
app.include_router(admin_router)


@app.get("/health", tags=["health"])
async def health_check():
    return {"status": "ok", "service": settings.service_name}
