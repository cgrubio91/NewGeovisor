from database import Base, engine, SessionLocal
from models import User, Project
import crud, schemas
from sqlalchemy import text

def refresh_db():
    print("Dropping all tables...")
    with engine.connect() as conn:
        conn.execute(text("DROP TABLE IF EXISTS user_projects CASCADE;"))
        conn.execute(text("DROP TABLE IF EXISTS layers CASCADE;"))
        conn.execute(text("DROP TABLE IF EXISTS projects CASCADE;"))
        conn.execute(text("DROP TABLE IF EXISTS users CASCADE;"))
        conn.commit()

    print("Recreating tables...")
    Base.metadata.create_all(bind=engine)

    print("Seeding default data...")
    db = SessionLocal()
    try:
        # Create Admin
        admin_data = schemas.UserCreate(
            username="admin",
            email="admin@geovisor.com",
            password="admin", # Access code
            full_name="Administrador del Sistema"
        )
        admin = crud.create_user(db, admin_data)
        print(f"Admin created: {admin.username} (ID: {admin.id})")

        # Create a test project for the admin
        project_data = schemas.ProjectCreate(
            name="Proyecto Demo Bogota",
            description="Proyecto inicial de prueba con ortofotos y KML",
            contract_number="DEMO-2026-X",
            photo_url="https://images.unsplash.com/photo-1526772662000-3f88f10405ff?auto=format&fit=crop&q=80&w=400"
        )
        project = crud.create_project(db, project_data, user_id=admin.id)
        print(f"Project created: {project.name} (ID: {project.id})")

    finally:
        db.close()

if __name__ == "__main__":
    refresh_db()
