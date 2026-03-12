"""
Script para crear/resetear el usuario administrador.
Uso: python setup_admin.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal, engine
import models
from passlib.context import CryptContext

models.Base.metadata.create_all(bind=engine)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ─── CONFIGURA AQUÍ TUS CREDENCIALES ───────────────────────────────────────────
ADMIN_USERNAME  = "admin"
ADMIN_EMAIL     = "admin@geovisor.com"
ADMIN_FULL_NAME = "Administrador"
ADMIN_PASSWORD  = "admin123"
ADMIN_ROLE      = "administrador"
# ───────────────────────────────────────────────────────────────────────────────

db = SessionLocal()
try:
    existing = db.query(models.User).filter(models.User.username == ADMIN_USERNAME).first()
    if existing:
        # Resetear contraseña
        existing.hashed_password = pwd_context.hash(ADMIN_PASSWORD)
        existing.is_active       = True
        existing.role            = ADMIN_ROLE
        existing.is_superuser    = True
        db.commit()
        print(f"✅ Contraseña reseteada para el usuario '{ADMIN_USERNAME}'.")
    else:
        new_user = models.User(
            username        = ADMIN_USERNAME,
            email           = ADMIN_EMAIL,
            full_name       = ADMIN_FULL_NAME,
            hashed_password = pwd_context.hash(ADMIN_PASSWORD),
            is_active       = True,
            is_superuser    = True,
            role            = ADMIN_ROLE,
        )
        db.add(new_user)
        db.commit()
        print(f"✅ Usuario '{ADMIN_USERNAME}' creado correctamente.")

    print(f"\n   Email    : {ADMIN_EMAIL}")
    print(f"   Contraseña: {ADMIN_PASSWORD}")
    print(f"   Rol       : {ADMIN_ROLE}")
except Exception as e:
    db.rollback()
    print(f"❌ Error: {e}")
finally:
    db.close()
