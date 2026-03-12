from crud import get_user_by_username
from database import SessionLocal

session = SessionLocal()
user = get_user_by_username(session, 'admin')
if user:
    print(f"Usuario admin existe: {user.username}")
else:
    print("Usuario admin no existe, necesita ser creado")
session.close()
