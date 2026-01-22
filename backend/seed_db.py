from sqlalchemy.orm import Session
from database import SessionLocal, engine
import models
import crud
import schemas

def seed_db():
    db = SessionLocal()
    try:
        # Verificar si existe el usuario con ID 1
        user = crud.get_user(db, user_id=1)
        if not user:
            print("Creando usuario por defecto (ID 1)...")
            default_user = schemas.UserCreate(
                email="admin@gmab.com",
                password="admin",
                full_name="Administrador",
                is_active=True,
                is_superuser=True
            )
            crud.create_user(db, default_user)
            print("Usuario creado exitosamente.")
        else:
            print("El usuario por defecto ya existe.")
    except Exception as e:
        print(f"Error al sembrar la base de datos: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_db()
