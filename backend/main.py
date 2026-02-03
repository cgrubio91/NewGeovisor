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

from fastapi import FastAPI, UploadFile, File, HTTPException, Form, Depends, status
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

# Importaciones locales
import crud, models, schemas
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

# Directorio para archivos cargados
UPLOAD_DIR = "uploads"
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)

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
    return user

# --- ENDPOINTS ---

@app.get("/")
async def root():
    """Endpoint raíz para verificar el estado del servidor"""
    return {"message": "GIS Geovisor API is running", "status": "healthy"}

# --- AUTH ENDPOINTS ---
@app.post("/token", response_model=schemas.Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = crud.get_user_by_username(db, username=form_data.username)
    if not user or not crud.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
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
def read_users(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # if not current_user.is_superuser:
    #      raise HTTPException(status_code=403, detail="Not enough permissions")
    return crud.get_users(db, skip=skip, limit=limit)

@app.post("/users/", response_model=schemas.UserRead)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = crud.get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    db_username = crud.get_user_by_username(db, username=user.username)
    if db_username:
        raise HTTPException(status_code=400, detail="Username already taken")
    return crud.create_user(db=db, user=user)

@app.delete("/users/{user_id}", response_model=schemas.UserRead)
def delete_user(user_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if not current_user.is_superuser and current_user.id != user_id:
         raise HTTPException(status_code=403, detail="Not enough permissions to delete this user")
    return crud.delete_user(db, user_id)

# --- PROJECT ENDPOINTS ---
@app.post("/projects/", response_model=schemas.ProjectRead)
def create_project(project: schemas.ProjectCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return crud.create_project(db=db, project=project, user_id=current_user.id)

@app.get("/projects/", response_model=List[schemas.ProjectRead])
def read_projects(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return crud.get_projects(db, user_id=current_user.id)

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
def assign_project(assignment: schemas.ProjectAssign, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Asignar un usuario a un proyecto"""
    project = db.query(models.Project).filter(models.Project.id == assignment.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    # Solo el dueño puede asignar o un admin
    if project.owner_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Only owner or admin can assign users")
        
    crud.assign_user_to_project(db, assignment.user_id, assignment.project_id)
    return {"message": "User assigned to project successfully"}

@app.delete("/projects/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
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
    return crud.get_dashboard_stats(db, user_id=current_user.id, is_admin=current_user.is_superuser)

# --- FOLDER ENDPOINTS ---
@app.post("/folders/", response_model=schemas.FolderRead)
def create_folder(folder: schemas.FolderCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
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

# --- UPLOAD ENDPOINT ---
@app.post("/upload")
async def upload_files(
    files: List[UploadFile] = File(...), 
    project_id: int = Form(...),
    folder_id: Optional[int] = Form(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
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
                settings=metadata
            )
            crud.create_layer(db=db, layer=layer_in)
            
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
def delete_layer(layer_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
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
    current_user: models.User = Depends(get_current_user)
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

# --- TILING SERVICE ---
@app.get("/tiles/{filename}/{z}/{x}/{y}.png")
async def get_tile(filename: str, z: int, x: int, y: int):
    file_path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
    
    try:
        with rasterio.env.Env(PROJ_LIB=os.environ.get('PROJ_LIB')):
            with rasterio.open(file_path) as src:
                from rasterio.warp import reproject, Resampling
                from rasterio.transform import from_bounds
                
                # Coordenadas del tile en EPSG:3857
                size = 20037508.34 * 2
                res = size / (2**z)
                left = -20037508.34 + x * res
                top = 20037508.34 - y * res
                right = left + res
                bottom = top - res
                
                # 1. Definir transformación destino (el tile de 256x256)
                dst_transform = from_bounds(left, bottom, right, top, 256, 256)
                dst_crs = 'EPSG:3857'
                
                # 2. Preparar arrays destino
                data = np.zeros((src.count, 256, 256), dtype=src.dtypes[0])
                # Máscara para transparencia
                mask = np.zeros((256, 256), dtype=np.uint8)
                
                # 3. Reproyectar datos
                reproject(
                    source=rasterio.band(src, list(range(1, src.count + 1))),
                    destination=data,
                    src_transform=src.transform,
                    src_crs=src.crs,
                    dst_transform=dst_transform,
                    dst_crs=dst_crs,
                    resampling=Resampling.bilinear
                )
                
                # 4. Reproyectar máscara original del archivo (para transparencia perfecta)
                reproject(
                    source=src.read_masks(1),
                    destination=mask,
                    src_transform=src.transform,
                    src_crs=src.crs,
                    dst_transform=dst_transform,
                    dst_crs=dst_crs,
                    resampling=Resampling.nearest
                )
                
                data = np.nan_to_num(data)
                
                # Normalización simple pero efectiva
                if data.dtype != np.uint8:
                    d_min, d_max = data.min(), data.max()
                    if d_max > d_min:
                        data = ((data - d_min) / (d_max - d_min) * 255).astype(np.uint8)
                    else:
                        data = data.astype(np.uint8)
                
                # Crear imagen PIL
                if src.count >= 3:
                    img_data = np.transpose(data[:3], (1, 2, 0))
                    img = Image.fromarray(img_data, mode='RGB')
                else:
                    img = Image.fromarray(data[0], mode='L')
                
                # Aplicar la máscara de transparencia
                img.putalpha(Image.fromarray(mask, mode='L'))
                
                buf = io.BytesIO()
                img.save(buf, format="PNG")
                return Response(content=buf.getvalue(), media_type="image/png")
                
    except Exception as e:
        print(f"Error generando tile para {filename}: {e}")
        img = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return Response(content=buf.getvalue(), media_type="image/png")

@app.get("/files/{filename:path}")
async def get_file(filename: str):
    file_path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
    return FileResponse(file_path)

if __name__ == "__main__":
    import uvicorn
    # En producción, esto se manejará vía Gunicorn/Docker
    uvicorn.run(app, host="0.0.0.0", port=8000)
