from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from pydantic_settings import BaseSettings
from typing import Optional
import os

class Settings(BaseSettings):
    # Valores por defecto para desarrollo, pero obligatorios en producción
    DATABASE_URL: str = "sqlite:///./test.db"
    SECRET_KEY: str = "DEVELOPMENT_SECRET_KEY_CHANGE_ME"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    ALLOWED_ORIGINS: str = "*"
    ENV: str = "development"

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore" # Esto permite que haya variables en el .env que no estén aquí sin dar error

settings = Settings()

# Configuración del motor de base de datos
connect_args = {}

# Verificación de seguridad para asegurar el uso de PostGIS en producción/desarrollo avanzado
if settings.DATABASE_URL.startswith("sqlite"):
    print("⚠️ ADVERTENCIA: Usando SQLite. Las funciones de PostGIS no estarán disponibles.")
    connect_args = {"check_same_thread": False}
elif settings.DATABASE_URL.startswith("postgresql"):
    print("✅ Conectando a PostgreSQL/PostGIS...")

engine = create_engine(
    settings.DATABASE_URL, 
    connect_args=connect_args,
    pool_pre_ping=True # Ayuda a mantener la conexión viva
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependencia para obtener la sesión de DB
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
