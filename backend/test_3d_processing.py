
import os
import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Layer, Project, Base
from database import SessionLocal
from file_processor import file_processor
from main import process_3d_pipeline
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('Test3D')

def test_3d():
    db = SessionLocal()
    try:
        project_id = 9
        filename = "scene_mesh_textured.obj"
        file_path = os.path.join("uploads", filename)
        abs_path = os.path.abspath(os.path.join(os.getcwd(), file_path))
        
        if not os.path.exists(abs_path):
            print(f"File not found: {abs_path}")
            return

        print(f"Processing file: {abs_path}")
        
        # 1. Detect info
        info = file_processor.process_file(abs_path)
        print(f"Info detected: {info}")
        
        # 2. Check if already exists
        eb_layer = db.query(Layer).filter(Layer.file_path == abs_path).first()
        if eb_layer:
            print(f"Layer already exists with ID: {eb_layer.id}")
            layer_id = eb_layer.id
        else:
            # Create layer
            new_layer = Layer(
                name="Scene Mesh Test",
                layer_type=info['layer_type'],
                file_format=info['file_format'],
                file_path=abs_path,
                project_id=project_id,
                visible=True,
                opacity=100,
                z_index=10,
                metadata=info['metadata'],
                processing_status="pending"
            )
            db.add(new_layer)
            db.commit()
            db.refresh(new_layer)
            print(f"Created layer with ID: {new_layer.id}")
            layer_id = new_layer.id
        
        # 3. Trigger pipeline
        print("Starting 3D pipeline...")
        process_3d_pipeline(abs_path, layer_id)
        
        # 4. Verify result
        db.refresh(db.query(Layer).get(layer_id))
        layer = db.query(Layer).get(layer_id)
        print(f"Final status: {layer.processing_status}")
        print(f"Final path: {layer.file_path}")
        
    finally:
        db.close()

if __name__ == "__main__":
    test_3d()
