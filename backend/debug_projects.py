from database import SessionLocal
import models

def list_projects():
    db = SessionLocal()
    try:
        projects = db.query(models.Project).all()
        print(f"Total projects in DB: {len(projects)}")
        for p in projects:
            print(f"ID: {p.id}, Name: {p.name}, Owner: {p.owner_id}")
    finally:
        db.close()

if __name__ == "__main__":
    list_projects()
