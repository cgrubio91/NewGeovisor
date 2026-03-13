"""
Fix definitivo: encontrar el KML correcto (667c6d8e9cc7451eb715f425.kml) 
y actualizar la capa de intervención para que apunte al archivo correcto en uploads/
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

with Session(engine) as session:
    # Ver estado actual de capas KML del proyecto 153
    layers = session.query(models.Layer).filter(
        models.Layer.project_id == 153,
        models.Layer.layer_type == 'kml'
    ).all()
    
    print("CAPAS KML DEL PROYECTO 153:")
    for l in layers:
        print(f"  ID={l.id} | {l.name} | geofence={l.geofence_type} | path={l.file_path}")
        # Verificar si el archivo existe
        exists_in_uploads = os.path.exists(os.path.join(UPLOAD_DIR, os.path.basename(l.file_path or '')))
        exists_at_path = os.path.exists(l.file_path or '')
        print(f"    Existe en ruta actual: {exists_at_path} | Existe en uploads/basename: {exists_in_uploads}")
    
    # Buscar el archivo correcto en kml_proyectos
    print("\nARCHIVOS EN kml_proyectos/:")
    for f in os.listdir(KML_PROYECTOS_DIR):
        full = os.path.join(KML_PROYECTOS_DIR, f)
        size = os.path.getsize(full)
        print(f"  {f} ({size} bytes)")
    
    # Copiar 667c6d8e9cc7451eb715f425.kml a uploads si existe
    mongo_kml = os.path.join(KML_PROYECTOS_DIR, "667c6d8e9cc7451eb715f425.kml")
    if os.path.exists(mongo_kml):
        dest = os.path.join(UPLOAD_DIR, "667c6d8e9cc7451eb715f425.kml")
        shutil.copy2(mongo_kml, dest)
        print(f"\n✅ Copiado: {mongo_kml} -> {dest}")
        
        # Actualizar la capa de intervención en la DB
        intervencion_layer = session.query(models.Layer).filter(
            models.Layer.project_id == 153,
            models.Layer.geofence_type == 'intervencion'
        ).first()
        
        if intervencion_layer:
            intervencion_layer.file_path = dest
            session.add(intervencion_layer)
            session.commit()
            print(f"✅ Capa ID={intervencion_layer.id} actualizada: file_path = {dest}")
        else:
            print("❌ No se encontró capa de tipo 'intervencion' para proyecto 153")
    else:
        print(f"\n❌ No existe: {mongo_kml}")
        # Mostrar qué archivos hay
        print("Intentando buscar archivos relacionados con 667...")
        for f in os.listdir(KML_PROYECTOS_DIR):
            if '667' in f:
                print(f"  Encontrado: {f}")
