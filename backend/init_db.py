import asyncio
from sqlalchemy import text
from database import engine, Base
import models
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def init_db():
    try:
        async with engine.begin() as conn:
            # Intentar crear la extensión PostGIS (requiere privilegios de superusuario)
            try:
                await conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
                logger.info("PostGIS extension checked/enabled.")
            except Exception as pg_err:
                logger.warning(f"No se pudo crear la extensión PostGIS automáticamente: {pg_err}")
            
            # Crear tablas de forma asíncrona
            await conn.run_sync(Base.metadata.create_all)
            logger.info("Database tables created successfully.")
    except Exception as e:
        logger.error(f"Error initializing database: {e}")

if __name__ == "__main__":
    asyncio.run(init_db())
