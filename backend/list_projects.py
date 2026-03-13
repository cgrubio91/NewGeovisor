from sqlalchemy import create_engine
from sqlalchemy.orm import Session
import models

DATABASE_URL = "postgresql://postgres:1064112177@localhost:5432/geovisor_db"
engine = create_engine(DATABASE_URL)

with Session(engine) as session:
    projects = session.query(models.Project).all()
    print("PROJECTS:")
    for p in projects:
        print(f"ID: {p.id} | Name: {p.name}")
