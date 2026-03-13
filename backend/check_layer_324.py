from sqlalchemy import create_engine
from sqlalchemy.orm import Session
import models

DATABASE_URL = "postgresql://postgres:1064112177@localhost:5432/geovisor_db"
engine = create_engine(DATABASE_URL)

with Session(engine) as session:
    l = session.query(models.Layer).filter(models.Layer.id == 324).first()
    if l:
        print(f"FOUND: ID={l.id}, Name={l.name}, ProjectID={l.project_id}")
    else:
        print("NOT FOUND IN DB")
