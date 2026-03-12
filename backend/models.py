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
    role = Column(String, default="usuario") # administrador, director, usuario
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Nuevos campos para métricas
    login_count = Column(Integer, default=0)
    last_login = Column(DateTime(timezone=True), nullable=True)
    
    # Referencia a MongoDB
    mongodb_id = Column(String, unique=True, index=True, nullable=True)

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
    
    # Nuevo campo para métricas
    visit_count = Column(Integer, default=0)
    
    # Referencia a MongoDB
    mongodb_id = Column(String, unique=True, index=True, nullable=True)
    
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relaciones
    owner = relationship("User", back_populates="owned_projects")
    assigned_users = relationship("User", secondary=user_projects, back_populates="assigned_projects")
    layers = relationship("Layer", back_populates="project", cascade="all, delete-orphan")
    folders = relationship("Folder", back_populates="project", cascade="all, delete-orphan")
    measurements = relationship("Measurement", back_populates="project", cascade="all, delete-orphan")

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
    measurements = relationship("Measurement", back_populates="folder")
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
    
    # Estado de procesamiento para ortofotos
    # pending, processing, completed, failed
    processing_status = Column(String, default="completed", nullable=True)
    # Porcentaje 0-100
    processing_progress = Column(Integer, default=100, nullable=True)

    # Tipo de geocerca: 'intervencion', 'oficina', 'ninguno'
    geofence_type = Column(String, default="ninguno", nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relaciones
    project = relationship("Project", back_populates="layers")
    folder = relationship("Folder", back_populates="layers")

class Measurement(Base):
    __tablename__ = "measurements"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    folder_id = Column(Integer, ForeignKey("folders.id", ondelete="SET NULL"), nullable=True)
    
    # 'length', 'area' or 'point'
    measurement_type = Column(String, nullable=False)
    
    # Optional comment or notes
    description = Column(String, nullable=True)
    
    # Optional URL link
    link = Column(String, nullable=True)
    
    # Optional icon name
    icon = Column(String, nullable=True)
    
    # Geometry in GeoJSON format or similar, stored as Geometry for PostGIS
    geometry = Column(Geometry(srid=4326), nullable=False)
    
    # Numerical value and unit: { "value": 150.5, "unit": "m" }
    measurement_data = Column(JSON, nullable=True)
    
    # Styling: { "color": "#ff0000", "stroke_width": 2, "line_dash": [5, 5], "fill_color": "rgba(255,0,0,0.2)", "filled": true }
    style = Column(JSON, nullable=True)
    
    visible = Column(Boolean, default=True, nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relaciones
    project = relationship("Project", back_populates="measurements")
    folder = relationship("Folder", back_populates="measurements")
