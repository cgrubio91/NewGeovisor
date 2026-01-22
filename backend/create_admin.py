from database import SessionLocal, engine
import models
from passlib.context import CryptContext
import getpass
from sqlalchemy.orm import Session

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def create_admin():
    print("--- Creador de Usuario Administrador para NewGeovisor ---")
    username = input("Nombre de usuario: ")
    email = input("Email: ")
    full_name = input("Nombre completo: ")
    password = getpass.getpass("Contraseña: ")
    
    db: Session = SessionLocal()
    try:
        # Verificar si ya existe
        existing_user = db.query(models.User).filter(models.User.username == username).first()
        if existing_user:
            print(f"Error: El usuario '{username}' ya existe.")
            return

        hashed_password = pwd_context.hash(password)
        new_user = models.User(
            username=username,
            email=email,
            full_name=full_name,
            hashed_password=hashed_password,
            is_active=True
        )
        db.add(new_user)
        db.commit()
        print(f"\n¡Éxito! Usuario '{username}' creado correctamente.")
    except Exception as e:
        db.rollback()
        print(f"Error al crear el usuario: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    create_admin()
