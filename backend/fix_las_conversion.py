
import os
import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Layer
from convert_3d import convert_point_cloud
from database import SessionLocal
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('FixLAS')

def fix_layer_300():
    db = SessionLocal()
    try:
        layer_id = 300
        layer = db.query(Layer).filter(Layer.id == layer_id).first()
        if not layer:
            print(f"Layer {layer_id} not found")
            return

        input_path = layer.file_path
        # Asegurar ruta absoluta si es relativa
        if not os.path.isabs(input_path):
            input_path = os.path.abspath(os.path.join("uploads", os.path.basename(input_path)))
        
        print(f"Reprocesando LAS: {input_path}")
        
        output_dir = os.path.join(os.path.dirname(input_path), f"3d_tiles_{layer_id}")
        
        success, result = convert_point_cloud(input_path, output_dir)
        
        if success:
            print(f"CONVERSIÓN EXITOSA: {result}")
            layer.file_path = result
            layer.processing_status = "completed"
            layer.processing_progress = 100
            db.commit()
            print("Base de datos actualizada.")
        else:
            print(f"Error en conversión: {result}")
            layer.processing_status = "failed"
            db.commit()
            
    finally:
        db.close()

if __name__ == "__main__":
    fix_layer_300()
