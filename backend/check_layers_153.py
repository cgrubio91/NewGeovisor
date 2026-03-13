from sqlalchemy import create_engine
from sqlalchemy.orm import Session
import models

DATABASE_URL = "postgresql://postgres:1064112177@localhost:5432/geovisor_db"
engine = create_engine(DATABASE_URL)

with Session(engine) as session:
    layers = session.query(models.Layer).filter(models.Layer.project_id == 153).all()
    print(f"LAYERS FOR PROJECT 153 (Total: {len(layers)}):")
    for l in layers:
        print(f"ID: {l.id} | Name: {l.name}")
