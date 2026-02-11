import os
import sys
import shutil
import io
import numpy as np
from typing import List, Optional
from datetime import datetime, timedelta

# --- ENVIRONMENT FIX FOR PROJ (MUST BE AT THE VERY TOP) ---
try:
    import pyproj
    proj_path = pyproj.datadir.get_data_dir()
    os.environ['PROJ_LIB'] = proj_path
    os.environ['PROJ_DATA'] = proj_path
    print(f"PROJ_LIB set to: {proj_path}")
except Exception:
    pass

from fastapi import FastAPI, UploadFile, File, HTTPException, Form, Depends, status, BackgroundTasks
from convert_cogs import convert_to_cog
from fastapi.responses import Response, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
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

from database import engine, get_db, settings
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

# --- UPLOAD ENDPOINT ---
@app.post("/upload")
async def upload_files(
    files: List[UploadFile] = File(...), 
    project_id: int = Form(...),
    folder_id: Optional[int] = Form(None),
    background_tasks: BackgroundTasks = None, ### Add optional to avoid required arg issues if not provided by client? No, FastAPI injects it.
    db: Session = Depends(get_db),
    current_user: models.User = Depends(check_role(['administrador', 'director']))
):
    """
    Endpoint para subir archivos geoespaciales de múltiples formatos.
    Soporta: TIFF, GeoTIFF, LAS, LAZ, OBJ, DWG, DXF, KMZ, KML, SHP, y más.
    """
    from file_processor import file_processor
    
    db_project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not db_project:
        raise HTTPException(status_code=404, detail=f"Project with ID {project_id} not found")
    
    if db_project.owner_id != current_user.id and current_user not in db_project.assigned_users:
        raise HTTPException(status_code=403, detail="Access denied to this project")

    uploaded_files = []
    for file in files:
        filename = file.filename
        file_path = os.path.join(UPLOAD_DIR, filename)
        
        # Evitar sobrescribir archivos existentes
        counter = 1
        name, ext_orig = os.path.splitext(filename)
        while os.path.exists(file_path):
            filename = f"{name}_{counter}{ext_orig}"
            file_path = os.path.join(UPLOAD_DIR, filename)
            counter += 1

        # Guardar archivo
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
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

            # Crear capa en la base de datos
            layer_in = schemas.LayerCreate(
                name=name,  # Nombre sin extensión
                layer_type=layer_type,
                file_format=file_format,
                file_path=file_path,
                crs=crs,
                project_id=project_id,
                folder_id=folder_id,
                visible=True,
                opacity=100,
                z_index=0,
                settings=metadata,
                processing_status="pending" if layer_type == 'raster' else "completed",
                processing_progress=0 if layer_type == 'raster' else 100
            )
            created_layer = crud.create_layer(db=db, layer=layer_in)
            
            # Start background optimization for rasters
            if layer_type == 'raster' and background_tasks:
                background_tasks.add_task(process_raster_pipeline, file_path, created_layer.id)
            
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
        models.Layer.processing_status.in_(['pending', 'processing', 'processing_overviews'])
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

if __name__ == "__main__":
    import uvicorn
    # Desactivamos reload para evitar reinicios constantes durante el procesamiento de tiles/uploads
    # que interrumpen la experiencia del usuario y el login.
    uvicorn.run(
        "main:app", 
        host="0.0.0.0", 
        port=8000, 
        reload=False
    )
