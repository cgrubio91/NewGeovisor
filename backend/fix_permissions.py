from sqlalchemy.orm import Session
from database import SessionLocal
import models

def make_admin(username: str):
    db = SessionLocal()
    try:
        user = db.query(models.User).filter(models.User.username == username).first()
        if user:
            user.is_superuser = True
            db.commit()
            print(f"User {username} is now a superuser.")
        else:
            print(f"User {username} not found.")
    finally:
        db.close()

if __name__ == "__main__":
    # Intentar con nombres comunes
    make_admin("admin")
    make_admin("cgrubio")
    # Hacer superusuarios a todos por ahora para que el usuario pueda trabajar sin bloqueos de permisos
    db = SessionLocal()
    users = db.query(models.User).all()
    for u in users:
        u.is_superuser = True
    db.commit()
    db.close()
    print("All users updated to superusers for development.")
