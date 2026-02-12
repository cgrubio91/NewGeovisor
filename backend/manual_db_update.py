
import os
import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Layer, Project, Base
import logging
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
print(f"Connecting to: {DATABASE_URL}")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)

def manual_update():
    db = SessionLocal()
    # Check layer 298
    layer = db.query(Layer).filter(Layer.id == 298).first()
    if not layer:
        print("Layer 298 not found")
        return
    
    print(f"Current Path: {layer.file_path}")
    print(f"Current Status: {layer.processing_status}")
    
    # Try manual update
    new_path = "uploads/scene_mesh_textured.glb"
    abs_new_path = os.path.abspath(os.path.join(os.getcwd(), new_path))
    
    print(f"Updating to: {abs_new_path}")
    layer.file_path = abs_new_path
    layer.processing_status = "completed"
    layer.processing_progress = 100
    
    db.commit()
    print("Commit successful")
    
    db.refresh(layer)
    print(f"After refresh path: {layer.file_path}")
    print(f"After refresh status: {layer.processing_status}")
    db.close()

if __name__ == "__main__":
    manual_update()
