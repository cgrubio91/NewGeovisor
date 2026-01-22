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
    if not current_user.is_superuser:
         raise HTTPException(status_code=403, detail="Not enough permissions")
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

@app.delete("/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if not current_user.is_superuser and current_user.id != user_id:
         raise HTTPException(status_code=403, detail="Not enough permissions")
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
    return project

@app.delete("/projects/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only owner can delete project")
    return crud.delete_project(db, project_id)

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
    return crud.delete_folder(db, folder_id)

# --- UPLOAD ENDPOINT ---
@app.post("/upload")
async def upload_files(
    files: List[UploadFile] = File(...), 
    project_id: int = Form(...),
    folder_id: Optional[int] = Form(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    db_project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not db_project:
        raise HTTPException(status_code=404, detail=f"Project with ID {project_id} not found")
    
    if db_project.owner_id != current_user.id and current_user not in db_project.assigned_users:
        raise HTTPException(status_code=403, detail="Access denied to this project")

    uploaded_files = []
    for file in files:
        filename = file.filename
        file_path = os.path.join(UPLOAD_DIR, filename)
        
        counter = 1
        name, ext_orig = os.path.splitext(filename)
        while os.path.exists(file_path):
            filename = f"{name}_{counter}{ext_orig}"
            file_path = os.path.join(UPLOAD_DIR, filename)
            counter += 1

        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        metadata = {}
        ext = filename.lower()
        
        try:
            if ext.endswith(('.tif', '.geotiff', 'tiff', '.ecw', '.jp2')):
                metadata = gis_service.get_raster_info(file_path)
            elif ext.endswith('.kml'):
                metadata = gis_service.kml_to_geojson(file_path)
            elif ext.endswith('.kmz'):
                metadata = gis_service.process_kmz(file_path)
            elif ext.endswith(('.obj', '.gltf', '.glb', '.ply')) or filename.lower() == 'tileset.json':
                metadata = gis_service.get_3d_info(file_path)
        except Exception as e:
            metadata = {"error": str(e)}

        uploaded_files.append({
            "filename": filename, 
            "path": file_path,
            "metadata": metadata
        })

        try:
            layer_type = "vector"
            if ext.endswith(('.tif', '.geotiff', 'tiff', '.ecw', '.jp2')):
                layer_type = "raster"
            elif ext.endswith(('.obj', '.gltf', '.glb', '.ply')):
                layer_type = "3d_model"
            
            layer_in = schemas.LayerCreate(
                name=filename,
                layer_type=layer_type,
                file_path=file_path,
                project_id=project_id,
                folder_id=folder_id,
                settings=metadata
            )
            crud.create_layer(db=db, layer=layer_in)
        except Exception as e:
            print(f"Error saving layer to DB: {e}")
            
    return {"uploaded": uploaded_files}

# --- LAYER CRUD ENDPOINTS ---
@app.delete("/layers/{layer_id}")
def delete_layer(layer_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    layer = db.query(models.Layer).filter(models.Layer.id == layer_id).first()
    if not layer:
        raise HTTPException(status_code=404, detail="Layer not found")
    project = layer.project
    if project.owner_id != current_user.id and current_user not in project.assigned_users:
        raise HTTPException(status_code=403, detail="Access denied")
    return crud.delete_layer(db, layer_id)

@app.patch("/layers/{layer_id}")
def update_layer(layer_id: int, layer_data: dict, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    layer = db.query(models.Layer).filter(models.Layer.id == layer_id).first()
    if not layer:
        raise HTTPException(status_code=404, detail="Layer not found")
    return crud.update_layer(db, layer_id, layer_data)

# --- TILING SERVICE ---
@app.get("/tiles/{filename}/{z}/{x}/{y}.png")
async def get_tile(filename: str, z: int, x: int, y: int):
    file_path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
    
    try:
        with rasterio.env.Env(PROJ_LIB=os.environ.get('PROJ_LIB')):
            with rasterio.open(file_path) as src:
                with WarpedVRT(src, crs='EPSG:3857', resampling=Resampling.bilinear) as vrt:
                    size = 20037508.34 * 2
                    res = size / (2**z)
                    left = -20037508.34 + x * res
                    top = 20037508.34 - y * res
                    right = left + res
                    bottom = top - res
                    
                    window = from_bounds(left, bottom, right, top, vrt.transform)
                    data = vrt.read(window=window, out_shape=(src.count, 256, 256), boundless=True)
                    data = np.nan_to_num(data)
                    
                    if data.max() > 0:
                        if data.dtype != np.uint8:
                            data = ((data - data.min()) / (data.max() - data.min() + 1e-6) * 255).astype(np.uint8)
                    else:
                        data = data.astype(np.uint8)
                        
                    if src.count >= 3:
                        img_data = np.transpose(data[:3], (1, 2, 0))
                        img = Image.fromarray(img_data, mode='RGB')
                    else:
                        img = Image.fromarray(data[0], mode='L')
                    
                    buf = io.BytesIO()
                    img.save(buf, format="PNG")
                    return Response(content=buf.getvalue(), media_type="image/png")
                
    except Exception as e:
        print(f"Error generando tile para {filename}: {e}")
        img = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return Response(content=buf.getvalue(), media_type="image/png")

if __name__ == "__main__":
    import uvicorn
    # En producción, esto se manejará vía Gunicorn/Docker
    uvicorn.run(app, host="0.0.0.0", port=8000)
