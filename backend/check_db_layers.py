
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Layer, Base
import os
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/geovisor")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def check_layers():
    db = SessionLocal()
    try:
        layers = db.query(Layer).order_by(Layer.id.desc()).limit(20).all()
        print(f"Total layers: {len(layers)}")
        with open("layers_full_dump.txt", "w", encoding="utf-8") as f:
            for l in layers:
                f.write(f"ID: {l.id}, Name: {l.name}, Type: {l.layer_type}, Status: {l.processing_status}, Path: {l.file_path}\n")
        print("Done writing to layers_full_dump.txt")
    finally:
        db.close()

if __name__ == "__main__":
    check_layers()
