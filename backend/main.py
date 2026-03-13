import os
import sys
import shutil
import io
import numpy as np
import pandas as pd
from typing import List, Optional
from datetime import datetime, timedelta, date
from dotenv import load_dotenv

# --- LOAD ENVIRONMENT VARIABLES ---
load_dotenv()

# --- ENVIRONMENT FIX FOR PROJ (MUST BE AT THE VERY TOP) ---
try:
    import pyproj
    proj_path = pyproj.datadir.get_data_dir()
    os.environ['PROJ_LIB'] = proj_path
    os.environ['PROJ_DATA'] = proj_path
    print(f"PROJ_LIB set to: {proj_path}")
except Exception:
    pass

from fastapi import FastAPI, Depends, HTTPException, File, UploadFile, Form, BackgroundTasks, Response, Query, status
from convert_cogs import convert_to_cog
from convert_3d import convert_point_cloud, convert_obj_to_glb
from fastapi.responses import Response, FileResponse, JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from jose import JWTError, jwt
from PIL import Image
import rasterio
from rasterio.windows import from_bounds
from rasterio.vrt import WarpedVRT
from rasterio.enums import Resampling
import logging

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Importaciones locales
import crud, models, schemas
import warnings
from rasterio.errors import NodataShadowWarning

# Suppress specific rasterio warning
warnings.filterwarnings("ignore", category=NodataShadowWarning)

from database import engine, get_db, settings, SessionLocal
from gis_service import gis_service

# --- AUTH CONFIG ---
# Ahora usamos los valores centralizados en database.py (settings)
SECRET_KEY = settings.SECRET_KEY
ALGORITHM = settings.ALGORITHM
ACCESS_TOKEN_EXPIRE_MINUTES = settings.ACCESS_TOKEN_EXPIRE_MINUTES

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# Create tables
models.Base.metadata.create_all(bind=engine)

# Inicializar aplicación FastAPI
app = FastAPI(
    title="GIS Geovisor API",
    description="API para la gestión y visualización de datos geoespaciales",
    version="1.0.0"
)

# Configuración de CORS - Refactorizada para producción
allowed_origins = settings.ALLOWED_ORIGINS.split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from shared import UPLOAD_DIR, tile_cache

# Middleware para Cache-Control en archivos estáticos
@app.middleware("http")
async def add_cache_control_header(request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/uploads/3d_tiles_") and response.status_code == 200:
        # Cachear archivos 3D Tiles por 1 año (son inmutables)
        response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
    return response

# Mount static files using shared UPLOAD_DIR
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# --- AUTH UTILS ---
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = schemas.TokenData(email=username)
    except JWTError:
        raise credentials_exception
    user = crud.get_user_by_username(db, username=token_data.email)
    if user is None:
        raise credentials_exception
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cuenta desactivada. Contacte a soporte@mabtec.com.co"
        )
    return user

def check_role(required_roles: list):
    """
    Dependencia para verificar si el usuario tiene uno de los roles requeridos.
    Roles: administrador, director, usuario
    """
    def role_checker(current_user: models.User = Depends(get_current_user)):
        # El superuser siempre tiene acceso a todo
        if getattr(current_user, 'is_superuser', False) or current_user.role == 'administrador':
            return current_user
            
        if current_user.role not in required_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"El rol '{current_user.role}' no tiene permisos para esta acción. Se requiere: {required_roles}"
            )
        return current_user
    return role_checker

# --- ENDPOINTS ---

@app.get("/")
async def root():
    """Endpoint raíz para verificar el estado del servidor"""
    return {"message": "GIS Geovisor API is running", "status": "healthy"}

# --- AUTH ENDPOINTS ---
@app.post("/token", response_model=schemas.Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # Permitir login por username o por email
    user = crud.get_user_by_username(db, username=form_data.username)
    if not user:
        user = crud.get_user_by_email(db, email=form_data.username)

    if not user or not crud.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username, email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Verificar si el usuario está activo
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Su usuario está desactivado. Contacte a soporte en soporte@mabtec.com.co para restaurar su acceso."
        )
    # Actualizar contador de inicios de sesión
    user.login_count = (user.login_count or 0) + 1
    user.last_login = datetime.utcnow()
    db.commit()

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/users/me", response_model=schemas.UserRead)
async def read_users_me(current_user: models.User = Depends(get_current_user)):
    return current_user

# --- USER ENDPOINTS ---
@app.get("/users/", response_model=List[schemas.UserRead])
def read_users(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: models.User = Depends(check_role(['administrador']))):
    # if not current_user.is_superuser:
    #      raise HTTPException(status_code=403, detail="Not enough permissions")
    return crud.get_users(db, skip=skip, limit=limit)

@app.post("/users/", response_model=schemas.UserRead)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db), current_user: models.User = Depends(check_role(['administrador']))):
    db_user = crud.get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    db_username = crud.get_user_by_username(db, username=user.username)
    if db_username:
        raise HTTPException(status_code=400, detail="Username already taken")
    return crud.create_user(db=db, user=user)

@app.patch("/users/{user_id}", response_model=schemas.UserRead)
def update_user(user_id: int, user_update: schemas.UserUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(check_role(["administrador"]))):
    db_user = crud.update_user(db, user_id, user_update.model_dump(exclude_unset=True))
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    return db_user

@app.delete("/users/{user_id}", response_model=schemas.UserRead)
def delete_user(user_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(check_role(['administrador']))):
    if not current_user.is_superuser and current_user.id != user_id:
         raise HTTPException(status_code=403, detail="Not enough permissions to delete this user")
    return crud.delete_user(db, user_id)

# --- PROJECT ENDPOINTS ---
@app.post("/projects/", response_model=schemas.ProjectRead)
def create_project(project: schemas.ProjectCreate, db: Session = Depends(get_db), current_user: models.User = Depends(check_role(['administrador']))):
    return crud.create_project(db=db, project=project, user_id=current_user.id)

@app.patch("/projects/{project_id}", response_model=schemas.ProjectRead)
def update_project(project_id: int, project_update: schemas.ProjectUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(check_role(['administrador']))):
    db_project = crud.update_project(db, project_id, project_update.model_dump(exclude_unset=True))
    if not db_project:
        raise HTTPException(status_code=404, detail="Project not found")
    return db_project

@app.get("/projects/", response_model=List[schemas.ProjectRead])
def read_projects(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    is_admin = current_user.role == "administrador" or current_user.is_superuser
    return crud.get_projects(db, user_id=current_user.id, is_admin=is_admin)

@app.get("/projects/by-id/{project_id}", response_model=schemas.ProjectRead)
def read_project(project_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.owner_id != current_user.id and current_user not in project.assigned_users:
        raise HTTPException(status_code=403, detail="Access denied")
    # Incrementar contador de visitas
    project.visit_count = (project.visit_count or 0) + 1
    db.commit()
    db.refresh(project)
    
    return project

@app.post("/projects/assign")
def assign_project(assignment: schemas.ProjectAssign, db: Session = Depends(get_db), current_user: models.User = Depends(check_role(['administrador']))):
    """Asignar un usuario a un proyecto"""
    project = db.query(models.Project).filter(models.Project.id == assignment.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    # Solo el dueño puede asignar o un admin
    if project.owner_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Only owner or admin can assign users")
        
    crud.assign_user_to_project(db, assignment.user_id, assignment.project_id)
    return {"message": "User assigned to project successfully"}

@app.post("/projects/unassign")
def unassign_project(assignment: schemas.ProjectAssign, db: Session = Depends(get_db), current_user: models.User = Depends(check_role(['administrador']))):
    """Quitar un usuario de un proyecto"""
    project = db.query(models.Project).filter(models.Project.id == assignment.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    if project.owner_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Only owner or admin can unassign users")
        
    crud.remove_user_from_project(db, assignment.user_id, assignment.project_id)
    return {"message": "User removed from project successfully"}

@app.delete("/projects/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(check_role(['administrador']))):
    # Buscar solo el ID y owner_id para el chequeo de permisos minimizando carga de relaciones
    project_data = db.query(models.Project.id, models.Project.owner_id).filter(models.Project.id == project_id).first()
    
    if not project_data:
        raise HTTPException(status_code=404, detail="Project not found")
        
    if project_data.owner_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Only owner or admin can delete project")
        
    crud.delete_project(db, project_id)
    return {"message": "Project deleted successfully"}

# --- MEASUREMENT ENDPOINTS ---
@app.get("/projects/{project_id}/measurements", response_model=List[schemas.MeasurementRead])
def get_project_measurements(project_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Obtener todas las medidas de un proyecto"""
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.owner_id != current_user.id and current_user not in project.assigned_users:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return crud.get_measurements_by_project(db, project_id)

@app.post("/measurements", response_model=schemas.MeasurementRead)
def create_measurement(measurement: schemas.MeasurementCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Crear una nueva medida"""
    project = db.query(models.Project).filter(models.Project.id == measurement.project_id).first()
    if not project:
         raise HTTPException(status_code=404, detail="Project not found")
    if project.owner_id != current_user.id and current_user not in project.assigned_users:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return crud.create_measurement(db, measurement)

@app.patch("/measurements/{measurement_id}", response_model=schemas.MeasurementRead)
def update_measurement(measurement_id: int, measurement_update: schemas.MeasurementUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Actualizar una medida"""
    db_measurement = db.query(models.Measurement).filter(models.Measurement.id == measurement_id).first()
    if not db_measurement:
        raise HTTPException(status_code=404, detail="Measurement not found")
    
    project = db_measurement.project
    if project.owner_id != current_user.id and current_user not in project.assigned_users:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return crud.update_measurement(db, measurement_id, measurement_update)

@app.delete("/measurements/{measurement_id}")
def delete_measurement(measurement_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Eliminar una medida"""
    db_measurement = db.query(models.Measurement).filter(models.Measurement.id == measurement_id).first()
    if not db_measurement:
        raise HTTPException(status_code=404, detail="Measurement not found")
    
    project = db_measurement.project
    if project.owner_id != current_user.id and current_user not in project.assigned_users:
        raise HTTPException(status_code=403, detail="Access denied")
    
    crud.delete_measurement(db, measurement_id)
    return {"message": "Measurement deleted successfully"}

@app.get("/projects/{project_id}/measurements/export/kmz")
def export_measurements_kmz(
    project_id: int, 
    measurement_ids: Optional[str] = Query(None),
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_user)
):
    """Exportar medidas de un proyecto a formato KMZ"""
    try:
        from fastkml import kml
        from shapely.geometry import shape
        import zipfile
        import json
        from sqlalchemy.sql import func
        
        project = db.query(models.Project).filter(models.Project.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        if project.owner_id != current_user.id and current_user not in project.assigned_users:
            raise HTTPException(status_code=403, detail="Access denied")

        query = db.query(models.Measurement).filter(models.Measurement.project_id == project_id)
        
        if measurement_ids:
            ids = [int(x) for x in measurement_ids.split(',')]
            query = query.filter(models.Measurement.id.in_(ids))
            
        measurements = query.all()
        
        k = kml.KML()
        ns = '{http://www.opengis.net/kml/2.2}'
        d = kml.Document(ns, 'docid', project.name, 'Medidas del proyecto')
        k.add_element(d)
        
        for m in measurements:
            p = kml.Placemark(ns, str(m.id), m.name, f"Tipo: {m.measurement_type}")
            # Convertir geometría de PostGIS a GeoJSON dict
            geom_json = json.loads(db.scalar(func.ST_AsGeoJSON(m.geometry)))
            geom = shape(geom_json)
            p.geometry = geom
            d.add_element(p)
        
        kml_str = k.to_string(prettyprint=True)
        
        # Crear ZIP (KMZ es un ZIP con un doc.kml)
        kmz_io = io.BytesIO()
        with zipfile.ZipFile(kmz_io, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            zip_file.writestr('doc.kml', kml_str)
        
        kmz_io.seek(0)
        
        filename = f"medidas_{project.name.replace(' ', '_')}.kmz"
        
        logging.info(f"KMZ exported successfully for project {project_id}")
        
        return StreamingResponse(
            kmz_io,
            media_type="application/vnd.google-earth.kmz",
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "Access-Control-Expose-Headers": "Content-Disposition",
                "Access-Control-Allow-Origin": "http://localhost:4200",
                "Access-Control-Allow-Credentials": "true"
            }
        )
    except Exception as e:
        import traceback
        logging.error(f"Error exporting KMZ: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/dashboard/stats")
def get_stats(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Obtener estadísticas reales para el dashboard"""
    is_admin = current_user.role == "administrador" or current_user.is_superuser
    return crud.get_dashboard_stats(db, user_id=current_user.id, is_admin=is_admin)

# --- FOLDER ENDPOINTS ---
@app.post("/folders/", response_model=schemas.FolderRead)
def create_folder(folder: schemas.FolderCreate, db: Session = Depends(get_db), current_user: models.User = Depends(check_role(['administrador', 'director']))):
    project = db.query(models.Project).filter(models.Project.id == folder.project_id).first()
    if not project or (project.owner_id != current_user.id and current_user not in project.assigned_users):
         raise HTTPException(status_code=403, detail="Access denied to project")
    return crud.create_folder(db, folder)

@app.get("/projects/{project_id}/folders", response_model=List[schemas.FolderRead])
def read_folders(project_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return crud.get_folders_by_project(db, project_id)

@app.delete("/folders/{folder_id}")
def delete_folder(folder_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    crud.delete_folder(db, folder_id)
    return {"message": "Folder deleted successfully", "id": folder_id}

@app.patch("/folders/{folder_id}", response_model=schemas.FolderRead)
def update_folder(folder_id: int, folder_update: schemas.FolderUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    db_folder = db.query(models.Folder).filter(models.Folder.id == folder_id).first()
    if not db_folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    
    project = db_folder.project
    if project.owner_id != current_user.id and current_user not in project.assigned_users:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return crud.update_folder(db, folder_id, folder_update.model_dump(exclude_unset=True))

from cache_seeder import seed_cache_for_layer

def process_raster_pipeline(file_path: str, layer_id: int):
    """
    Combined pipeline:
    1. Convert to COG
    2. Seed disk cache
    """
    # 1. Optimize
    success = convert_to_cog(file_path, layer_id)
    
    if success:
        # 2. Seed (warm up) cache for common zoom levels
        seed_cache_for_layer(file_path, layer_id)

def process_3d_pipeline(file_path: str, layer_id: int):
    """
    Pipeline para procesar archivos 3D en segundo plano.
    Convierte LAS/LAZ -> 3D Tiles
    Convierte OBJ -> GLB
    Actualiza la BD con la nueva ruta.
    """
    db = SessionLocal()
    print(f"DEBUG 3D: Starting pipeline for layer_id={layer_id}, file={file_path}")
    
    try:
        layer = db.query(models.Layer).filter(models.Layer.id == layer_id).first()
        if not layer:
            print(f"DEBUG 3D: Layer {layer_id} not found in DB")
            return

        # Verificar que el archivo existe
        if not os.path.exists(file_path):
            print(f"DEBUG 3D: ERROR - File not found: {file_path}")
            layer.processing_status = "failed"
            layer.processing_progress = 0
            db.commit()
            return

        ext = os.path.splitext(file_path)[1].lower()
        print(f"DEBUG 3D: Extension detected: {ext}")
        
        # Mostrar tamaño del archivo
        file_size_mb = os.path.getsize(file_path) / (1024 * 1024)
        print(f"DEBUG 3D: File size: {file_size_mb:.2f} MB")
        
        success = False
        new_path = None
        
        if ext in ['.las', '.laz']:
            output_dir = os.path.join(os.path.dirname(file_path), f"3d_tiles_{layer_id}")
            print(f"DEBUG 3D: Converting Point Cloud to {output_dir}")
            print(f"DEBUG 3D: This may take several minutes for large files...")
            
            success, result = convert_point_cloud(file_path, output_dir)
            
            if success:
                new_path = result
                print(f"DEBUG 3D: Point Cloud SUCCESS. New path: {new_path}")
            else:
                print(f"DEBUG 3D: Point Cloud FAILED. Error: {result}")
                
        elif ext == '.obj':
            output_path = os.path.splitext(file_path)[0] + ".glb"
            print(f"DEBUG 3D: Converting OBJ to {output_path}")
            
            success, result = convert_obj_to_glb(file_path, output_path)
            
            if success:
                new_path = result
                print(f"DEBUG 3D: OBJ SUCCESS. New path: {new_path}")
            else:
                print(f"DEBUG 3D: OBJ FAILED. Error: {result}")

        if success and new_path and os.path.exists(new_path):
            print(f"DEBUG 3D: Updating DB for layer {layer_id}. Path: {new_path}")
            normalized_path = os.path.normpath(new_path)
            
            # Asegurar que guardamos la ruta relativa a la carpeta de uploads para el frontend
            # Si new_path es absoluta, la convertimos a relativa a UPLOAD_DIR
            if os.path.isabs(normalized_path):
                rel_path = os.path.relpath(normalized_path, start=os.getcwd())
                layer.file_path = rel_path
            else:
                layer.file_path = normalized_path

            layer.processing_status = "completed"
            layer.processing_progress = 100
            
            current_settings = layer.settings or {}
            layer.settings = {
                **current_settings, 
                "optimized": True, 
                "original_path": file_path
            }
            
            db.commit()
            print(f"DEBUG 3D: ✅ DATABASE UPDATED for layer {layer_id}. Final Path: {layer.file_path}")
        else:
            error_detail = result if not success else "File not found after conversion"
            print(f"DEBUG 3D: ❌ Conversion failed for layer {layer_id}. Reason: {error_detail}")
            layer.processing_status = "failed"
            layer.processing_progress = 0
            db.commit()
            
    except Exception as e:
        print(f"DEBUG 3D: ❌ EXCEPTION in pipeline for layer {layer_id}: {e}")
        import traceback
        traceback.print_exc()
        try:
            layer = db.query(models.Layer).filter(models.Layer.id == layer_id).first()
            if layer:
                layer.processing_status = "failed"
                layer.processing_progress = 0
                layer.metadata = {**(layer.metadata or {}), "error": str(e)}
                db.commit()
        except:
            pass
    finally:
        db.close()

# --- UPLOAD ENDPOINT ---
@app.post("/upload")
async def upload_files(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...), 
    project_id: int = Form(...),
    folder_id: Optional[int] = Form(None),
    geofence_type: Optional[str] = Form("ninguno"), # 'intervencion', 'oficina', 'ninguno'
    db: Session = Depends(get_db),
    current_user: models.User = Depends(check_role(['administrador', 'director']))
):
    """
    Endpoint para subir archivos geoespaciales de múltiples formatos.
    """
    from file_processor import file_processor
    
    db_project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not db_project:
        raise HTTPException(status_code=404, detail=f"Project with ID {project_id} not found")
    
    if db_project.owner_id != current_user.id and current_user not in db_project.assigned_users:
        raise HTTPException(status_code=403, detail="Access denied to this project")

    # Obtener el pid de MongoDB para el nombre del archivo si es geocerca
    # Si no tiene mongo_id, usamos el ID de postgres como fallback
    mongo_pid = db_project.mongodb_id or str(db_project.id)
    
    uploaded_files = []
    for file in files:
        filename = file.filename
        ext = os.path.splitext(filename)[1].lower()
        
        # Lógica especial para Geocercas (KML/KMZ)
        if geofence_type in ["intervencion", "oficina"] and ext in [".kml", ".kmz"]:
            suffix = "_oficina" if geofence_type == "oficina" else ""
            filename = f"{mongo_pid}{suffix}{ext}"
            # Guardar EN UPLOADS para que el frontend pueda acceder vía HTTP,
            # y TAMBIÉN copiar a kml_proyectos/ para el análisis geográfico
            save_dir = UPLOAD_DIR
            kml_proyectos_dir = "kml_proyectos"
            os.makedirs(kml_proyectos_dir, exist_ok=True)
        else:
            save_dir = UPLOAD_DIR
        
        file_path = os.path.normpath(os.path.join(save_dir, filename))
        
        # Evitar sobrescribir archivos existentes (usar save_dir, no UPLOAD_DIR)
        counter = 1
        name_base, ext_orig = os.path.splitext(filename)
        while os.path.exists(file_path):
            filename = f"{name_base}_{counter}{ext_orig}"
            file_path = os.path.normpath(os.path.join(save_dir, filename))
            counter += 1

        # Guardar archivo
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Si es geocerca, también copiar a kml_proyectos/ para el análisis geográfico retrocompatible
        if geofence_type in ["intervencion", "oficina"] and ext in [".kml", ".kmz"]:
            try:
                kml_copy_path = os.path.join(kml_proyectos_dir, os.path.basename(file_path))
                shutil.copy2(file_path, kml_copy_path)
                logger.info(f"Geocerca copiada también a: {kml_copy_path}")
            except Exception as e:
                logger.warning(f"No se pudo copiar geocerca a kml_proyectos: {e}")
        
        # Si es KMZ, descomprimir para obtener el KML y usar ese archivo en su lugar
        if filename.lower().endswith('.kmz'):
            import zipfile
            old_file_path = file_path
            extraction_success = False
            try:
                print(f"DEBUG: Attempting to unzip KMZ with FULL EXTRACTION: {old_file_path}")
                
                import time
                import uuid
                safe_dirname = f"kmz_{int(time.time())}_{str(uuid.uuid4())[:8]}"
                extract_dir = os.path.join(UPLOAD_DIR, safe_dirname)
                os.makedirs(extract_dir, exist_ok=True)
                
                print(f"DEBUG: Extraction directory: {extract_dir}")
                
                with zipfile.ZipFile(old_file_path, 'r') as zip_ref:
                    zip_ref.extractall(extract_dir)
                    kml_files = [f for f in zip_ref.namelist() if f.lower().endswith('.kml')]
                
                # Bloque with cerrado, archivo liberado
                
                if kml_files:
                    kml_file_in_zip = next((f for f in kml_files if f.lower() == 'doc.kml'), kml_files[0])
                    kml_path = os.path.join(extract_dir, kml_file_in_zip)
                    kml_path = os.path.normpath(kml_path)
                    
                    file_path = kml_path
                    filename = kml_file_in_zip
                    extraction_success = True
                    print(f"DEBUG: Extraction SUCCESS. Target: {kml_path}")
                else:
                    print(f"DEBUG: No KML found inside KMZ.")
                    try:
                        shutil.rmtree(extract_dir)
                    except:
                        pass
                    raise Exception("No KML file found")

            except Exception as e:
                print(f"ERROR: General KMZ processing error: {e}")
                import traceback
                traceback.print_exc()
                # Si falló la extracción, no podemos continuar con este archivo
                if os.path.exists(old_file_path):
                    try: os.remove(old_file_path)
                    except: pass
                continue

            # Cleanup NO CRÍTICO fuera del bloque principal de error
            if extraction_success:
                try:
                    import time
                    time.sleep(0.5) # Wait for handles to release
                    if os.path.exists(old_file_path):
                        os.remove(old_file_path)
                        print("DEBUG: Original KMZ removed.")
                except Exception as e:
                    print(f"WARNING: Could not remove original KMZ (non-fatal): {e}")
        
        # Procesar archivo con el nuevo file_processor
        try:
            file_info = file_processor.process_file(file_path)
            layer_type = file_info.get('layer_type', 'unknown')
            file_format = file_info.get('file_format', 'unknown')
            metadata = file_info.get('metadata', {})
            
            # Extraer CRS si está disponible
            crs = None
            if 'crs' in metadata:
                crs = metadata['crs']
            
            uploaded_files.append({
                "filename": filename, 
                "path": file_path,
                "layer_type": layer_type,
                "file_format": file_format,
                "metadata": metadata
            })

            # Nombre visible para la capa
            if geofence_type in ["intervencion", "oficina"] and ext in [".kml", ".kmz"]:
                layer_display_name = "Zona de Intervención" if geofence_type == "intervencion" else "Zona de Oficina"
            else:
                # El nombre se calcula DESPUES de resolver el filename final
                layer_display_name = os.path.splitext(os.path.basename(file_path))[0]

            # Crear capa en la base de datos
            layer_in = schemas.LayerCreate(
                name=layer_display_name,
                layer_type=layer_type,
                file_format=file_format,
                file_path=file_path,
                crs=crs,
                project_id=project_id,
                folder_id=folder_id,
                visible=True,
                opacity=100,
                z_index=0,
                geofence_type=geofence_type if geofence_type in ["intervencion", "oficina"] else "ninguno",
                settings={**metadata, "original_path": file_path},
                processing_status="processing" if layer_type in ['point_cloud', '3d_model'] else ("pending" if layer_type == 'raster' else "completed"),
                processing_progress=0 if layer_type in ['point_cloud', '3d_model', 'raster'] else 100
            )
            created_layer = crud.create_layer(db=db, layer=layer_in)
            
            # Iniciar optimización en segundo plano
            if layer_type == 'raster':
                background_tasks.add_task(process_raster_pipeline, file_path, created_layer.id)
            elif layer_type == 'point_cloud' or (layer_type == '3d_model' and file_format == 'obj'):
                background_tasks.add_task(process_3d_pipeline, file_path, created_layer.id)
                
        except Exception as e:
            print(f"Error processing file {filename}: {e}")
            uploaded_files.append({
                "filename": filename,
                "path": file_path,
                "error": str(e)
            })
            
    return {"uploaded": uploaded_files}

# --- LAYER CRUD ENDPOINTS ---
@app.get("/projects/{project_id}/layers", response_model=List[schemas.LayerRead])
def get_project_layers(
    project_id: int, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_user)
):
    """Obtener todas las capas de un proyecto"""
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.owner_id != current_user.id and current_user not in project.assigned_users:
        raise HTTPException(status_code=403, detail="Access denied")
    
    layers = db.query(models.Layer).filter(models.Layer.project_id == project_id).order_by(models.Layer.z_index).all()
    return layers

@app.delete("/layers/{layer_id}")
def delete_layer(layer_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(check_role(['administrador', 'director']))):
    """Eliminar una capa"""
    layer = db.query(models.Layer).filter(models.Layer.id == layer_id).first()
    if not layer:
        raise HTTPException(status_code=404, detail="Layer not found")
    project = layer.project
    if project.owner_id != current_user.id and current_user not in project.assigned_users:
        raise HTTPException(status_code=403, detail="Access denied")
    crud.delete_layer(db, layer_id)
    return {"message": "Layer deleted successfully", "id": layer_id}

@app.patch("/layers/{layer_id}", response_model=schemas.LayerRead)
def update_layer(
    layer_id: int, 
    layer_update: schemas.LayerUpdate, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(check_role(['administrador', 'director']))
):
    """
    Actualizar propiedades de una capa (visibilidad, opacidad, z-index, etc.)
    """
    layer = db.query(models.Layer).filter(models.Layer.id == layer_id).first()
    if not layer:
        raise HTTPException(status_code=404, detail="Layer not found")
    
    project = layer.project
    if project.owner_id != current_user.id and current_user not in project.assigned_users:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Actualizar campos
    update_data = layer_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(layer, field, value)
    
    db.commit()
    db.refresh(layer)
    return layer

@app.post("/layers/{layer_id}/toggle-visibility")
def toggle_layer_visibility(
    layer_id: int, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_user)
):
    """Alternar visibilidad de una capa"""
    layer = db.query(models.Layer).filter(models.Layer.id == layer_id).first()
    if not layer:
        raise HTTPException(status_code=404, detail="Layer not found")
    
    layer.visible = not layer.visible
    db.commit()
    return {"layer_id": layer_id, "visible": layer.visible}

@app.post("/layers/{layer_id}/set-opacity")
def set_layer_opacity(
    layer_id: int, 
    opacity: int, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_user)
):
    """Establecer opacidad de una capa (0-100)"""
    if opacity < 0 or opacity > 100:
        raise HTTPException(status_code=400, detail="Opacity must be between 0 and 100")
    
    layer = db.query(models.Layer).filter(models.Layer.id == layer_id).first()
    if not layer:
        raise HTTPException(status_code=404, detail="Layer not found")
    
    layer.opacity = opacity
    db.commit()
    return {"layer_id": layer_id, "opacity": opacity}


# --- TILING SERVICE (High-Performance VRT-based) ---
from tile_renderer import tile_renderer, EMPTY_TILE_BYTES, EMPTY_TILE_PNG

@app.get("/tiles/{filename}/{z}/{x}/{y}.png")
async def get_tile(filename: str, z: int, x: int, y: int):
    """
    High-performance tile endpoint.
    Uses WarpedVRT + COG overviews for instant tile reads.
    Output format: WEBP (smaller than PNG, faster to transfer).
    Falls back to cached PNG tiles from older cache if present.
    """
    # 1. Check disk cache first
    cache_key = f"{filename}-{z}-{x}-{y}"
    cached_tile = tile_cache.get(cache_key)
    if cached_tile:
        # Detect format from cached data (old cache may have PNG)
        if cached_tile[:4] == b'RIFF':
            media = "image/webp"
        else:
            media = "image/png"
        return Response(
            content=cached_tile, 
            media_type=media, 
            headers={"Cache-Control": "public, max-age=31536000"}
        )

    # 2. Locate the raster file
    file_path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
    
    # 3. Render the tile using VRT (reads from COG overviews automatically)
    try:
        tile_bytes = tile_renderer.render_tile(file_path, z, x, y)
    except Exception as e:
        logger.error(f"Tile render error {filename}/{z}/{x}/{y}: {e}")
        tile_bytes = None
    
    if tile_bytes is None:
        # Empty/out-of-bounds tile — return transparent, don't cache
        return Response(
            content=EMPTY_TILE_BYTES,
            media_type="image/webp",
            headers={"Cache-Control": "public, max-age=86400"}
        )
    
    # 4. Cache the rendered tile for 30 days
    tile_cache.set(cache_key, tile_bytes, expire=86400 * 30)
    
    return Response(
        content=tile_bytes,
        media_type="image/webp",
        headers={"Cache-Control": "public, max-age=31536000"}
    )

@app.get("/files/{filename:path}")
async def get_file(filename: str):
    file_path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
    return FileResponse(file_path)

@app.get("/dashboard/processing-status")
def get_processing_status(db: Session = Depends(get_db)):
    """
    Returns list of layers currently being processed (pending or processing)
    """
    layers = db.query(models.Layer).filter(
        models.Layer.processing_status.in_(['pending', 'processing', 'processing_overviews', 'paused'])
    ).all()
    
    return [
        {
            "id": l.id,
            "name": l.name,
            "status": l.processing_status,
            "progress": l.processing_progress,
            "project_id": l.project_id
        }
        for l in layers
    ]


# --- PROCESS MANAGEMENT ENDPOINTS ---

@app.post("/layers/{layer_id}/pause")
async def pause_layer_processing(layer_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Pause a running processing task"""
    layer = crud.get_layer(db, layer_id)
    if not layer:
        raise HTTPException(status_code=404, detail="Layer not found")
    
    if layer.processing_status in ["processing", "processing_overviews"]:
        layer.processing_status = "paused"
        db.commit()
        logger.info(f"Layer {layer_id} paused by user {current_user.username}")
    
    return {"status": layer.processing_status}

@app.post("/layers/{layer_id}/resume")
async def resume_layer_processing(layer_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Resume a paused processing task"""
    layer = crud.get_layer(db, layer_id)
    if not layer:
        raise HTTPException(status_code=404, detail="Layer not found")
    
    if layer.processing_status == "paused":
        layer.processing_status = "processing"
        db.commit()
        logger.info(f"Layer {layer_id} resumed by user {current_user.username}")
    
    return {"status": layer.processing_status}

@app.delete("/layers/{layer_id}/process")
async def cancel_layer_processing(layer_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Cancel a running processing task"""
    layer = crud.get_layer(db, layer_id)
    if not layer:
        raise HTTPException(status_code=404, detail="Layer not found")
    
    # Allow cancelling only if actively running or paused
    if layer.processing_status in ["processing", "processing_overviews", "paused", "pending"]:
        layer.processing_status = "cancelled"
        db.commit()
        logger.info(f"Layer {layer_id} cancelled by user {current_user.username}")
    
    return {"status": "cancelled"}

@app.get("/layers/{layer_id}/download")
async def download_layer_file(layer_id: int, db: Session = Depends(get_db)):
    """Download the original layer file"""
    layer = crud.get_layer(db, layer_id)
    if not layer:
        raise HTTPException(status_code=404, detail="Layer not found")
    
    # Priorizar el archivo original si existe en settings
    # (Para nubes de puntos, file_path apunta al tileset.json, pero original_path tiene el .las)
    settings_data = layer.settings or {}
    original_path = settings_data.get("original_path")
    
    file_path = layer.file_path
    if original_path:
        # Verificar si original_path es absoluto o relativo
        if os.path.isabs(original_path) and os.path.exists(original_path):
            file_path = original_path
        else:
            # Probar relativo a UPLOAD_DIR
            potential_path = os.path.join(UPLOAD_DIR, os.path.basename(original_path))
            if os.path.exists(potential_path):
                file_path = potential_path
            elif os.path.exists(os.path.abspath(original_path)):
                file_path = os.path.abspath(original_path)
    
    # Ensure absolute path
    if not os.path.isabs(file_path):
       file_path = os.path.abspath(os.path.join(UPLOAD_DIR, file_path))
    
    if not os.path.exists(file_path):
         # Try just filename in upload directory as fallback
         alt_path = os.path.join(UPLOAD_DIR, os.path.basename(file_path))
         if os.path.exists(alt_path):
             file_path = alt_path
         else:
             logger.error(f"Download failed: File {file_path} not found (tried {alt_path})")
             raise HTTPException(status_code=404, detail="File not found on server")
         
    return FileResponse(
        path=file_path, 
        filename=os.path.basename(file_path),
        media_type='application/octet-stream'
    )


# ============================================================================
# ENDPOINTS: ANÁLISIS GEOGRÁFICO DE REGISTROS
# ============================================================================

from geographic_records import crear_analizador_desde_env
from pydantic import BaseModel
from datetime import date

class GenerarReporteRequest(BaseModel):
    """Request para generar reporte geográfico de registros"""
    fecha_inicio: date
    fecha_fin: date
    pid_filtro: Optional[str] = None
    user_filtro: Optional[str] = None
    nombre_proyecto_filtro: Optional[str] = None


@app.post("/api/v1/geographic-records/generar-reporte")
async def generar_reporte_registros(
    request: GenerarReporteRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Genera un reporte de registros con análisis geográfico.
    
    Consulta MongoDB a través de túnel SSH, clasifica registros por ubicación
    (EN OBRA, EN OFICINA, UBICACIÓN EXTERNA) usando geocercas en formato KML/KMZ,
    y retorna los datos para descarga o visualización.
    
    **Parámetros:**
    - `fecha_inicio`: Inicio del rango de fechas (YYYY-MM-DD)
    - `fecha_fin`: Fin del rango de fechas (YYYY-MM-DD)
    - `pid_filtro`: (Opcional) Filtrar por ID de proyecto (PostgreSQL ID)
    - `user_filtro`: (Opcional) Filtrar por email del usuario
    - `nombre_proyecto_filtro`: (Opcional) Filtrar por nombre de proyecto (regex)
    
    **Criterios de clasificación:**
    - Carga polígonos de obra: `{pid}.kml` o `{pid}.kmz`
    - Carga polígonos de oficina: `{pid}_oficina.kml` o `{pid}_oficina.kmz`
    - Usa distancia de punto-en-polígono (Shapely) para clasificar
    
    **Retorna:**
    - `status`: success/processing/error
    - `mensaje`: Descripción del estado
    - `archivo`: Ruta donde está el archivo (si se completó)
    - `total_registros`: Cantidad de registros procesados
    - `records`: Lista de registros (para visualización en mapa)
    - `url_descarga`: URL para descargar el Excel (si se completó)
    """
    try:
        # Convertir date a datetime
        fecha_inicio = datetime.combine(request.fecha_inicio, datetime.min.time())
        fecha_fin = datetime.combine(request.fecha_fin, datetime.min.time())
        
        logger.info(f"Generando reporte: {fecha_inicio} - {fecha_fin} (usuario: {current_user.username})")
        
        # 1. Resolver Proyecto en PostgreSQL para obtener geocercas
        db_project = None
        mongo_pid = None
        nombre_proyecto_filtro = request.nombre_proyecto_filtro
        
        if request.pid_filtro:
            pid_str = str(request.pid_filtro)
            if pid_str.isdigit():
                db_project = db.query(models.Project).filter(models.Project.id == int(pid_str)).first()
            else:
                db_project = db.query(models.Project).filter(models.Project.mongodb_id == pid_str).first()
        
        if db_project:
            nombre_proyecto_filtro = db_project.name
            mongo_pid = db_project.mongodb_id
            logger.info(f"Proyecto identificado: {db_project.name} (DB ID: {db_project.id}, Mongo ID: {mongo_pid})")

        # Crear analizador
        analizador = crear_analizador_desde_env(kml_base_path="kml_proyectos")
        
        # --- CARGAR GEOCERCAS DINÁMICAS DESDE LA DB ---
        p_obra = None
        p_ofi = None
        
        if db_project:
            # Buscar capas marcadas como intervención u oficina para este proyecto
            layers_geofence = db.query(models.Layer).filter(
                models.Layer.project_id == db_project.id,
                models.Layer.geofence_type.in_(['intervencion', 'oficina'])
            ).all()
            
            for l in layers_geofence:
                # Buscar archivo en kml_proyectos o uploads
                posibles_rutas = [
                    os.path.join("kml_proyectos", l.file_path),
                    os.path.join("uploads", l.file_path),
                    l.file_path # Ruta absoluta si existe
                ]
                
                poly = None
                for ruta in posibles_rutas:
                    if os.path.exists(ruta):
                        poly = analizador.cargar_poligono_geocerca(ruta)
                        if poly: break
                
                if poly:
                    if l.geofence_type == 'intervencion':
                        p_obra = poly
                        logger.info(f"Geocerca de OBRA cargada desde capa: {l.name}")
                    elif l.geofence_type == 'oficina':
                        p_ofi = poly
                        logger.info(f"Geocerca de OFICINA cargada desde capa: {l.name}")
        
        # Si no se encontró proyecto en DB pero se tiene un ID directo (fallback)
        if not mongo_pid and request.pid_filtro and not str(request.pid_filtro).isdigit():
            mongo_pid = request.pid_filtro

        # Generar reporte con polígonos explícitos (si se encontraron)
        df = analizador.generar_reporte(
            fecha_inicio=fecha_inicio,
            fecha_fin=fecha_fin,
            pid_filtro=mongo_pid,
            user_filtro=request.user_filtro,
            nombre_proyecto_filtro=nombre_proyecto_filtro,
            p_obra_explicit=p_obra,
            p_ofi_explicit=p_ofi
        )
        
        if len(df) == 0:
            return {
                "status": "sin_datos",
                "mensaje": "No se encontraron registros para los criterios especificados",
                "total_registros": 0,
                "records": []
            }
        
        # Generar nombre de archivo
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        nombre_archivo = f"Reporte_Registros_{timestamp}.xlsx"
        ruta_archivo = os.path.join("report", nombre_archivo)
        
        # Guardar Excel
        analizador.exportar_a_excel(df, ruta_archivo)
        
        # Generar estadísticas rápidas
        stats = {
            "EN OBRA": int((df["Clasificación"] == "EN OBRA").sum()),
            "EN OFICINA": int((df["Clasificación"] == "EN OFICINA").sum()),
            "UBICACIÓN EXTERNA": int((df["Clasificación"] == "UBICACIÓN EXTERNA").sum())
        }
        
        # Convertir DataFrame a registros para el frontend
        records = []
        for _, row in df.iterrows():
            record = {}
            # Primero pasar todos los campos originales del DF
            for col in df.columns:
                value = row[col]
                if pd.isna(value):
                    record[col] = None
                elif isinstance(value, (datetime, pd.Timestamp)):
                    record[col] = value.strftime("%Y-%m-%d %H:%M:%S")
                elif isinstance(value, (int, float)):
                    record[col] = float(value)
                else:
                    record[col] = str(value)
            
            # Especiales para el mapeo geoespacial del frontend
            # Si tiene Coordenadas_Google, intentamos crear el objeto coords
            if "Coordenadas_Google" in record and record["Coordenadas_Google"]:
                try:
                    parts = record["Coordenadas_Google"].split(",")
                    record["coords"] = {
                        "lat": float(parts[0].strip()),
                        "lon": float(parts[1].strip())
                    }
                except:
                    pass
            
            # Asegurar que project_id y _id estén presentes para el link
            if "project_id" in record:
                record["project_id"] = record["project_id"]
            if "id" in record:
                record["_id"] = record["id"] # El frontend usa _id a veces
                
            records.append(record)
        
        # Limpiar cache
        analizador.limpiar_cache()
        
        return {
            "status": "success",
            "mensaje": f"Reporte generado exitosamente con {len(df)} registros",
            "archivo": ruta_archivo,
            "total_registros": len(df),
            "estadisticas": stats,
            "records": records,
            "url_descarga": f"/files/{nombre_archivo}",
            "timestamp": timestamp
        }
    
    except Exception as e:
        logger.error(f"Error generando reporte: {str(e)}", exc_info=True)
        return {
            "status": "error",
            "mensaje": f"Error al generar reporte: {str(e)}",
            "records": []
        }


@app.get("/api/v1/geographic-records/descargar/{filename}")
async def descargar_reporte(
    filename: str,
    current_user: models.User = Depends(get_current_user)
):
    """
    Descarga un archivo de reporte generado.
    
    **Seguridad:** Solo archivos en la carpeta `/report/` son accesibles.
    
    Args:
        filename: Nombre del archivo Excel
        
    Returns:
        El archivo Excel para descarga
    """
    # Validar que el archivo esté en la carpeta de reportes
    ruta_archivo = os.path.join("report", filename)
    ruta_absoluta = os.path.abspath(ruta_archivo)
    ruta_reportes = os.path.abspath("report")
    
    # Prevenir path traversal
    if not ruta_absoluta.startswith(ruta_reportes):
        raise HTTPException(status_code=403, detail="Acceso denegado")
    
    if not os.path.exists(ruta_absoluta):
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
    
    return FileResponse(
        path=ruta_absoluta,
        filename=filename,
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )


@app.get("/api/v1/geographic-records/info")
async def obtener_info_analizador():
    """
    Retorna información sobre la configuración del analizador geográfico.
    
    Útil para verificar que las credenciales SSH y MongoDB estén configuradas
    correctamente en las variables de entorno.
    """
    try:
        ssh_host = os.getenv("SSH_HOST", "No configurado")
        ssh_user = os.getenv("SSH_USER", "No configurado")
        db_name = os.getenv("DB_NAME", "No configurado")
        mongo_port = os.getenv("MONGO_PORT", 27017)
        
        return {
            "status": "configurado",
            "ssh_host": ssh_host,
            "ssh_user": ssh_user,
            "db_name": db_name,
            "mongo_port": mongo_port,
            "kml_base_path": "uploads",
            "mensaje": "Sistema de análisis geográfico configurado"
        }
    except Exception as e:
        return {
            "status": "error",
            "mensaje": f"Error obteniendo información: {str(e)}"
        }

@app.get("/api/v1/geographic-records/mongodb-projects")
async def get_mongodb_projects(
    current_user: models.User = Depends(get_current_user)
):
    """Obtiene la lista de proyectos directamente de MongoDB (Segmab)"""
    try:
        analizador = crear_analizador_desde_env()
        projects = analizador.obtener_proyectos_mongodb()
        return projects
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/geographic-records/sync-mongodb-data")
async def sync_mongodb_data(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(check_role(['administrador']))
):
    """
    Sincroniza proyectos y usuarios de MongoDB a PostgreSQL (Geovisor).
    Crea los proyectos si no existen e importa los usuarios asignándoles acceso.
    Utiliza mongodb_id para evitar duplicados.
    """
    try:
        analizador = crear_analizador_desde_env()
        
        # 1. Obtener datos de MongoDB
        mongo_projects = analizador.obtener_proyectos_mongodb()
        mongo_users = analizador.obtener_usuarios_y_proyectos()
        
        results = {
            "projects_created": 0,
            "projects_updated": 0,
            "users_created": 0,
            "users_updated": 0,
            "assignments_created": 0,
            "errors": []
        }
        
        # Map to store mongo_project_id -> postgres_project_id
        project_map = {}
        
        # 2. Sincronizar Proyectos y sus Usuarios internos
        for m_proy in mongo_projects:
            m_id = str(m_proy["_id"])
            name = m_proy.get("name", "Sin nombre")
            description = m_proy.get("description", "")
            m_users = m_proy.get("users", []) # Lista de usuarios dentro del proyecto
            
            # Buscar por mongodb_id preferiblemente, luego por nombre (migración)
            db_proy = db.query(models.Project).filter(
                (models.Project.mongodb_id == m_id) | (models.Project.name == name)
            ).first()
            
            if not db_proy:
                # Crear proyecto
                new_proy = models.Project(
                    name=name,
                    description=description,
                    owner_id=current_user.id,
                    mongodb_id=m_id
                )
                db.add(new_proy)
                db.flush() 
                db_proy = new_proy
                results["projects_created"] += 1
            else:
                # Actualizar si ya existe
                db_proy.mongodb_id = m_id
                if not db_proy.description:
                    db_proy.description = description
                results["projects_updated"] += 1
            
            project_map[m_id] = db_proy.id

            # Sincronizar usuarios LISTADOS DENTRO del proyecto
            for m_u in m_users:
                u_email = m_u.get("email")
                if not u_email: continue
                
                u_email = u_email.strip().lower()
                if not u_email or '@' not in u_email: continue

                # Buscar por email primero
                db_user = db.query(models.User).filter(models.User.email == u_email).first()
                if not db_user:
                    # Si no existe por email, verificar si el username está tomado
                    base_username = u_email.split('@')[0]
                    u_count = 0
                    final_username = base_username
                    while db.query(models.User).filter(models.User.username == final_username).first():
                        u_count += 1
                        final_username = f"{base_username}{u_count}"
                    
                    import uuid
                    user_in = schemas.UserCreate(
                        email=u_email,
                        username=final_username,
                        full_name=base_username,
                        password=str(uuid.uuid4())[:12],
                        role="usuario"
                    )
                    db_user = crud.create_user(db, user_in)
                    results["users_created"] += 1
                
                # Asignar al proyecto si no está
                is_assigned = db.query(models.user_projects).filter(
                    models.user_projects.c.user_id == db_user.id,
                    models.user_projects.c.project_id == db_proy.id
                ).first()
                
                if not is_assigned:
                    crud.assign_user_to_project(db, db_user.id, db_proy.id)
                    results["assignments_created"] += 1

        # 3. Sincronizar resto de Usuarios desde la colección users (Opcional, para asegurar perfiles completos)
        for m_user in mongo_users:
            email = m_user.get("email")
            display_name = m_user.get("displayName", "")
            m_projects = m_user.get("projects", [])
            m_u_id = str(m_user.get("_id", ""))
            
            if not email: continue
            email = email.strip().lower()
            if not email or '@' not in email: continue
                
            db_user = db.query(models.User).filter(
                (models.User.mongodb_id == m_u_id) | (models.User.email == email)
            ).first()
            
            if db_user:
                db_user.mongodb_id = m_u_id
                if not db_user.full_name or db_user.full_name == db_user.username:
                    db_user.full_name = display_name
                
                # También asignar proyectos que el usuario diga tener
                for m_pid in m_projects:
                    m_pid_str = str(m_pid)
                    if m_pid_str in project_map:
                        p_id = project_map[m_pid_str]
                        is_assigned = db.query(models.user_projects).filter(
                            models.user_projects.c.user_id == db_user.id,
                            models.user_projects.c.project_id == p_id
                        ).first()
                        if not is_assigned:
                            crud.assign_user_to_project(db, db_user.id, p_id)
                            results["assignments_created"] += 1
        
        db.commit()
        return {
            "status": "success",
            "message": "Sincronización completada exitosamente",
            "results": results
        }
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error en sincronización: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    # Desactivamos reload para evitar reinicios constantes durante el procesamiento de tiles/uploads
    # que interrumpen la experiencia del usuario y el login.
    uvicorn.run(
        "main:app", 
        host="0.0.0.0", 
        port=8000, 
        reload=True
    )
