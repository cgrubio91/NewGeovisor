from sqlalchemy import create_engine
from sqlalchemy.orm import Session
import models

DATABASE_URL = "postgresql://postgres:1064112177@localhost:5432/geovisor_db"
engine = create_engine(DATABASE_URL)

with Session(engine) as session:
    layers = session.query(models.Layer).filter(models.Layer.name.like('%OBRA%')).all()
    print("LAYERS WITH 'OBRA':")
    for l in layers:
        print(f"ID: {l.id} | Name: {l.name} | Project: {l.project_id}")
    
    layers = session.query(models.Layer).filter(models.Layer.name.like('%oficina%')).all()
    print("LAYERS WITH 'oficina':")
    for l in layers:
        print(f"ID: {l.id} | Name: {l.name} | Project: {l.project_id}")
