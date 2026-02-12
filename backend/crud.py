from sqlalchemy.orm import Session, joinedload, selectinload
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

def update_user(db: Session, user_id: int, user_update: dict):
    db_user = get_user(db, user_id)
    if not db_user:
        return None
    
    if "password" in user_update and user_update["password"]:
        user_update["hashed_password"] = get_password_hash(user_update.pop("password"))
    
    for key, value in user_update.items():
        if hasattr(db_user, key) and value is not None:
            setattr(db_user, key, value)
            
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
def get_projects(db: Session, user_id: int, is_admin: bool = False):
    """
    Obtiene proyectos donde el usuario es dueño o está asignado.
    Si es admin, devuelve todos los proyectos con usuarios precargados.
    """
    try:
        # Usamos selectinload para relaciones Muchos-a-Muchos por ser más eficiente y evitar duplicados
        query = db.query(Project).options(selectinload(Project.assigned_users))
        
        if is_admin:
            return query.all()
            
        return query.filter(
            or_(
                Project.owner_id == user_id,
                Project.assigned_users.any(id=user_id)
            )
        ).all()
    except Exception as e:
        logger.error(f"Error en get_projects: {e}")
        return db.query(Project).filter(Project.owner_id == user_id).all()

def create_project(db: Session, project: ProjectCreate, user_id: int):
    """
    Crea un proyecto y asigna usuarios iniciales si se proporcionan.
    """
    try:
        data = project.model_dump()
        user_ids = data.pop("assigned_user_ids", [])
        
        db_project = Project(**data, owner_id=user_id)
        
        if user_ids:
            logger.info(f"Creando proyecto con usuarios: {user_ids}")
            users = db.query(User).filter(User.id.in_(user_ids)).all()
            db_project.assigned_users = users
            
        db.add(db_project)
        db.commit()
        
        # Recargar con relaciones para la respuesta
        return db.query(Project).options(
            joinedload(Project.assigned_users),
            joinedload(Project.layers),
            joinedload(Project.folders)
        ).filter(Project.id == db_project.id).first()
    except Exception as e:
        db.rollback()
        logger.error(f"Error en create_project: {str(e)}")
        raise e

def update_project(db: Session, project_id: int, project_data: dict):
    """
    Actualiza proyecto y su lista de usuarios asignados.
    """
    db_project = db.query(Project).filter(Project.id == project_id).first()
    if not db_project:
        return None
        
    try:
        # 1. Tratar usuarios asignados si vienen en la data
        if "assigned_user_ids" in project_data:
            user_ids = project_data.pop("assigned_user_ids")
            
            # Limpiar colección actual
            db_project.assigned_users.clear()
            
            if user_ids:
                clean_ids = [int(x) for x in user_ids if x is not None]
                users_to_add = db.query(User).filter(User.id.in_(clean_ids)).all()
                
                # Agregar nuevos usuarios
                for u in users_to_add:
                    db_project.assigned_users.append(u)
            
            db.flush()
        
        # 2. Actualizar otros campos (nombre, descripción, etc.)
        for key, value in project_data.items():
            if hasattr(db_project, key):
                setattr(db_project, key, value)
        
        db.commit()
        
        # 3. Respuesta final con relaciones cargadas
        return db.query(Project).options(
            joinedload(Project.assigned_users),
            joinedload(Project.layers),
            joinedload(Project.folders)
        ).filter(Project.id == project_id).first()
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error al actualizar proyecto {project_id}: {str(e)}")
        raise e

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

def remove_user_from_project(db: Session, user_id: int, project_id: int):
    user = get_user(db, user_id)
    project = db.query(Project).filter(Project.id == project_id).first()
    if user and project:
        if user in project.assigned_users:
            project.assigned_users.remove(user)
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
def get_layer(db: Session, layer_id: int):
    return db.query(Layer).filter(Layer.id == layer_id).first()

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
        from database import settings
        size_query = db.execute(text(f"SELECT pg_size_pretty(pg_database_size('{settings.POSTGRES_DB}'))"))
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
