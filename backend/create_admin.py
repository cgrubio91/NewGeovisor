import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from database import SessionLocal, engine
import models
from passlib.context import CryptContext
import getpass

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def create_admin():
    print("--- Creador de Usuario Administrador para NewGeovisor ---")
    username = input("Nombre de usuario: ")
    email = input("Email: ")
    full_name = input("Nombre completo: ")
    password = getpass.getpass("Contraseña: ")
    
    async with SessionLocal() as session:
        async with session.begin():
            # Verificar si ya existe
            from sqlalchemy import select
            result = await session.execute(select(models.User).filter(models.User.username == username))
            if result.scalars().first():
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
            session.add(new_user)
        print(f"\n¡Éxito! Usuario '{username}' creado correctamente.")

if __name__ == "__main__":
    asyncio.run(create_admin())
