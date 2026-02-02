from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, Table, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from geoalchemy2 import Geometry
from database import Base

# Tabla de asociación para la relación Muchos-a-Muchos entre Usuarios y Proyectos
user_projects = Table(
    "user_projects",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("project_id", Integer, ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True)
)

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=True)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relaciones
    owned_projects = relationship("Project", back_populates="owner", cascade="all, delete-orphan")
    assigned_projects = relationship("Project", secondary=user_projects, back_populates="assigned_users")

class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    description = Column(String, nullable=True)
    contract_number = Column(String, nullable=True)
    start_date = Column(DateTime(timezone=True), nullable=True)
    end_date = Column(DateTime(timezone=True), nullable=True)
    photo_url = Column(String, nullable=True)
    
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relaciones
    owner = relationship("User", back_populates="owned_projects")
    assigned_users = relationship("User", secondary=user_projects, back_populates="assigned_projects")
    layers = relationship("Layer", back_populates="project", cascade="all, delete-orphan")
    folders = relationship("Folder", back_populates="project", cascade="all, delete-orphan")

class Folder(Base):
    __tablename__ = "folders"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    parent_id = Column(Integer, ForeignKey("folders.id", ondelete="CASCADE"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relaciones
    project = relationship("Project", back_populates="folders")
    layers = relationship("Layer", back_populates="folder")
    subfolders = relationship("Folder", backref="parent", remote_side=[id])

class Layer(Base):
    __tablename__ = "layers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    
    # Tipos soportados: 'raster', 'vector', '3d_model', 'point_cloud', 'cad', 'kml'
    layer_type = Column(String, nullable=False)
    
    # Formato específico del archivo: 'tiff', 'geotiff', 'las', 'laz', 'obj', 'dwg', 'dxf', 'kmz', 'kml', 'shp', etc.
    file_format = Column(String, nullable=True)
    
    file_path = Column(String, nullable=False)
    crs = Column(String, nullable=True)
    
    # Geometría para PostGIS
    bounds = Column(Geometry('POLYGON', srid=4326), nullable=True)
    
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    folder_id = Column(Integer, ForeignKey("folders.id", ondelete="SET NULL"), nullable=True)
    
    # Control de visualización
    visible = Column(Boolean, default=True, nullable=False)
    opacity = Column(Integer, default=100, nullable=False)  # 0-100
    z_index = Column(Integer, default=0, nullable=False)  # Orden de las capas
    
    # Configuraciones adicionales en formato JSON
    # Puede incluir: estilo, filtros, configuraciones específicas del formato, etc.
    settings = Column(JSON, nullable=True, default={}) 
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relaciones
    project = relationship("Project", back_populates="layers")
    folder = relationship("Folder", back_populates="layers")
