"""
Script para corregir las rutas de capas KML de geocerca que apuntan a kml_proyectos/
y moverlas a uploads/ para que el frontend pueda accederlas.
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
import models
import os
import shutil

DATABASE_URL = "postgresql://postgres:1064112177@localhost:5432/geovisor_db"
engine = create_engine(DATABASE_URL)

UPLOAD_DIR = "uploads"
KML_PROYECTOS_DIR = "kml_proyectos"

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(KML_PROYECTOS_DIR, exist_ok=True)

with Session(engine) as session:
    # Buscar capas que tengan file_path en kml_proyectos/
    layers = session.query(models.Layer).filter(
        models.Layer.file_path.like('%kml_proyectos%')
    ).all()
    
    print(f"Capas en kml_proyectos/ encontradas: {len(layers)}")
    
    for l in layers:
        original_path = l.file_path
        filename = os.path.basename(original_path)
        new_path = os.path.normpath(os.path.join(UPLOAD_DIR, filename))
        
        print(f"\nCapa ID={l.id} | {l.name}")
        print(f"  Path actual: {original_path}")
        print(f"  Nuevo path:  {new_path}")
        
        # Si el archivo existe en kml_proyectos, copiarlo a uploads
        if os.path.exists(original_path):
            shutil.copy2(original_path, new_path)
            print(f"  ✅ Archivo copiado a uploads/")
        elif os.path.exists(new_path):
            print(f"  ℹ️  El archivo ya existe en uploads/")
        else:
            print(f"  ❌ Archivo no encontrado en ninguna ubicación: {original_path}")
        
        # Actualizar el path en la DB
        l.file_path = new_path
        session.add(l)
        print(f"  ✅ Path actualizado en BD")
    
    # También buscar capas que tengan solo el nombre del archivo (como "153.kml")
    # sin directorio - estos también pueden estar mal
    all_layers = session.query(models.Layer).filter(
        models.Layer.layer_type == 'kml'
    ).all()
    
    print(f"\n--- Capas KML totales: {len(all_layers)} ---")
    for l in all_layers:
        fp = l.file_path or ''
        if not fp.startswith('uploads') and not fp.startswith('kml_proyectos') and not os.path.isabs(fp):
            print(f"Path sospechoso en capa {l.id} ({l.name}): {fp}")
    
    session.commit()
    print("\n✅ Migración completada")
