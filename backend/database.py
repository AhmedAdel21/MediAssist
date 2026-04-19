from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from config import settings
from logging_config import get_logger

logger = get_logger(__name__)

engine = create_async_engine(settings.database_url, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            logger.debug("DB session opened")
            yield session
        except HTTPException:
            raise
        except Exception as exc:
            logger.error("DB session error: %s", exc, exc_info=True)
            raise
        finally:
            await session.close()
            logger.debug("DB session closed")


async def init_db():
    logger.info("Initializing database schema")
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database schema ready")
    except Exception as exc:
        logger.error("Database initialization failed: %s", exc, exc_info=True)
        raise
