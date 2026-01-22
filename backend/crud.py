from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from models import User, Project, Layer, Folder
from schemas import UserCreate, ProjectCreate, LayerCreate, FolderCreate
from passlib.context import CryptContext
import os

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password):
    return pwd_context.hash(password)

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

# --- USER CRUD ---
def get_users(db: Session, skip: int = 0, limit: int = 100):
    return db.query(User).offset(skip).limit(limit).all()

def get_user_by_email(db: Session, email: str):
    return db.query(User).filter(User.email == email).first()

def get_user_by_username(db: Session, username: str):
    return db.query(User).filter(User.username == username).first()

def get_user(db: Session, user_id: int):
    return db.query(User).filter(User.id == user_id).first()

def create_user(db: Session, user: UserCreate):
    hashed_password = get_password_hash(user.password)
    user_data = user.dict(exclude={"password"})
    db_user = User(**user_data, hashed_password=hashed_password)

    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def delete_user(db: Session, user_id: int):
    db_user = get_user(db, user_id)
    if db_user:
        db.delete(db_user)
        db.commit()
    return db_user

# --- PROJECT CRUD ---
def get_projects(db: Session, user_id: int):
    # Simplificamos la consulta para evitar errores de relación si no hay usuarios asignados
    # Obtenemos proyectos donde el usuario es dueño
    owned = db.query(Project).filter(Project.owner_id == user_id).all()
    
    # Obtenemos proyectos donde el usuario está asignado (usando la tabla de asociación directamente si es necesario)
    # Pero por ahora, para asegurar que funcione, devolvemos al menos los propios
    return owned

def create_project(db: Session, project: ProjectCreate, user_id: int):
    try:
        data = project.dict()
        # Aseguramos que el owner_id esté presente
        db_project = Project(**data, owner_id=user_id)
        db.add(db_project)
        db.commit()
        db.refresh(db_project)
        return db_project
    except Exception as e:
        db.rollback()
        print(f"Error en create_project: {e}")
        raise e

def update_project(db: Session, project_id: int, project_data: dict):
    db_project = db.query(Project).filter(Project.id == project_id).first()
    if db_project:
        for key, value in project_data.items():
            setattr(db_project, key, value)
        db.commit()
        db.refresh(db_project)
    return db_project

def delete_project(db: Session, project_id: int):
    db_project = db.query(Project).filter(Project.id == project_id).first()
    if db_project:
        db.delete(db_project)
        db.commit()
    return db_project

def assign_user_to_project(db: Session, user_id: int, project_id: int):
    user = get_user(db, user_id)
    project = db.query(Project).filter(Project.id == project_id).first()
    if user and project:
        # Verificamos si la relación existe antes de añadir
        if user not in project.assigned_users:
            project.assigned_users.append(user)
            db.commit()
            db.refresh(project)
    return project

# --- FOLDER CRUD ---
def create_folder(db: Session, folder: FolderCreate):
    db_folder = Folder(**folder.dict())
    db.add(db_folder)
    db.commit()
    db.refresh(db_folder)
    return db_folder

def get_folders_by_project(db: Session, project_id: int):
    return db.query(Folder).filter(Folder.project_id == project_id).all()

def delete_folder(db: Session, folder_id: int):
    db_folder = db.query(Folder).filter(Folder.id == folder_id).first()
    if db_folder:
        db.query(Layer).filter(Layer.folder_id == folder_id).update({Layer.folder_id: None})
        db.delete(db_folder)
        db.commit()
    return db_folder

# --- LAYER CRUD ---
def create_layer(db: Session, layer: LayerCreate):
    db_layer = Layer(**layer.dict())
    db.add(db_layer)
    db.commit()
    db.refresh(db_layer)
    return db_layer

def update_layer(db: Session, layer_id: int, layer_data: dict):
    db_layer = db.query(Layer).filter(Layer.id == layer_id).first()
    if db_layer:
        for key, value in layer_data.items():
            setattr(db_layer, key, value)
        db.commit()
        db.refresh(db_layer)
    return db_layer

def delete_layer(db: Session, layer_id: int):
    db_layer = db.query(Layer).filter(Layer.id == layer_id).first()
    if db_layer:
        if db_layer.file_path and os.path.exists(db_layer.file_path):
            try:
                os.remove(db_layer.file_path)
            except: pass
        db.delete(db_layer)
        db.commit()
    return db_layer
