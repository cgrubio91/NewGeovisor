from sqlalchemy import create_engine
from sqlalchemy.orm import Session
import models

DATABASE_URL = "postgresql://postgres:1064112177@localhost:5432/geovisor_db"
engine = create_engine(DATABASE_URL)

with Session(engine) as session:
    count = session.query(models.Layer).count()
    print(f"TOTAL LAYERS: {count}")
    
    # Check if 324, 325, 326 exist
    for i in [324, 325, 326]:
        l = session.query(models.Layer).filter(models.Layer.id == i).first()
        if l:
            print(f"LAYER {i} EXISTS: Name={l.name}, Project={l.project_id}")
        else:
            print(f"LAYER {i} DOES NOT EXIST")
