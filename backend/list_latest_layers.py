from sqlalchemy import create_engine
from sqlalchemy.orm import Session
import models

DATABASE_URL = "postgresql://postgres:1064112177@localhost:5432/geovisor_db"
engine = create_engine(DATABASE_URL)

with Session(engine) as session:
    layers = session.query(models.Layer).order_by(models.Layer.id.desc()).limit(10).all()
    print("ULTIMAS 10 CAPAS:")
    for l in layers:
        print(f"ID: {l.id} | Name: {l.name} | Project: {l.project_id}")
