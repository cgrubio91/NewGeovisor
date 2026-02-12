
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Layer
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)

def check_one():
    db = SessionLocal()
    l = db.query(Layer).filter(Layer.id == 298).first()
    if l:
        print(f"ID: {l.id}")
        print(f"Status: {l.processing_status}")
        print(f"Path: {l.file_path}")
    else:
        print("Layer 298 not found")
    db.close()

if __name__ == "__main__":
    check_one()
