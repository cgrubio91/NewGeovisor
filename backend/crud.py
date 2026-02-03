from sqlalchemy.orm import Session
from sqlalchemy import func, or_, text
from models import User, Project, Layer, Folder
from schemas import UserCreate, ProjectCreate, LayerCreate, FolderCreate
from passlib.context import CryptContext
import os
import logging

# Configurar logging para ver errores detallados en la terminal del usuario
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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
    """
    Obtiene proyectos donde el usuario es dueño o está asignado.
    Usamos una consulta optimizada para evitar problemas de carga de relaciones.
    """
    try:
        return db.query(Project).filter(
            or_(
                Project.owner_id == user_id,
                Project.assigned_users.any(id=user_id)
            )
        ).all()
    except Exception as e:
        logger.error(f"Error en get_projects: {e}")
        # Fallback: solo proyectos propios si la relación Many-to-Many falla
        return db.query(Project).filter(Project.owner_id == user_id).all()

def create_project(db: Session, project: ProjectCreate, user_id: int):
    """
    Crea un proyecto asegurando compatibilidad con PostgreSQL y SQLite.
    """
    try:
        # Convertir esquema Pydantic a diccionario
        project_data = project.dict()
        
        # Limpiar datos para evitar errores de tipos en SQLAlchemy/PostgreSQL
        # Especialmente con fechas y campos opcionales
        db_project = Project(
            name=project_data.get("name"),
            description=project_data.get("description"),
            contract_number=project_data.get("contract_number"),
            photo_url=project_data.get("photo_url"),
            start_date=project_data.get("start_date"),
            end_date=project_data.get("end_date"),
            owner_id=user_id
        )
        
        db.add(db_project)
        db.commit()
        db.refresh(db_project)
        logger.info(f"Proyecto '{db_project.name}' creado exitosamente para el usuario {user_id}")
        return db_project
    except Exception as e:
        db.rollback()
        logger.error(f"Error crítico al crear proyecto: {str(e)}")
        raise e

def update_project(db: Session, project_id: int, project_data: dict):
    db_project = db.query(Project).filter(Project.id == project_id).first()
    if db_project:
        for key, value in project_data.items():
            if hasattr(db_project, key):
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
    try:
        layer_data = layer.dict()
        # Asegurar que settings sea un dict válido para JSON en DB
        if layer_data.get("settings") is None:
            layer_data["settings"] = {}
            
        db_layer = Layer(**layer_data)
        db.add(db_layer)
        db.commit()
        db.refresh(db_layer)
        return db_layer
    except Exception as e:
        db.rollback()
        logger.error(f"Error al crear capa: {e}")
        raise e

def update_layer(db: Session, layer_id: int, layer_data: dict):
    db_layer = db.query(Layer).filter(Layer.id == layer_id).first()
    if db_layer:
        for key, value in layer_data.items():
            if hasattr(db_layer, key):
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

def get_dashboard_stats(db: Session, user_id: int = None, is_admin: bool = False):
    query_projects = db.query(Project)
    query_layers = db.query(Layer)
    
    if user_id and not is_admin:
        query_projects = query_projects.filter(Project.owner_id == user_id)
        query_layers = query_layers.join(Project).filter(Project.owner_id == user_id)
    
    user_count = db.query(User).count() if is_admin else 1
    project_count = query_projects.count()
    layer_count = query_layers.count()
    
    top_projects = query_projects.order_by(Project.visit_count.desc()).limit(5).all()
    
    top_users = []
    if is_admin:
        top_users_raw = db.query(User.username, User.login_count).order_by(User.login_count.desc()).limit(5).all()
        top_users = [{"name": u[0], "logins": u[1]} for u in top_users_raw]
        
    db_size = "N/A"
    try:
        size_query = db.execute(text("SELECT pg_size_pretty(pg_database_size('geovisor_db'))"))
        db_size = size_query.scalar() or "N/A"
    except:
        pass

    return {
        "users": user_count,
        "projects": project_count,
        "layers": layer_count,
        "db_size": db_size,
        "top_projects": [{"name": p.name, "visits": p.visit_count or 0} for p in top_projects],
        "top_users": top_users
    }
