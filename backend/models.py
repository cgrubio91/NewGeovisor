from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, Float, Table, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from geoalchemy2 import Geometry
from database import Base

# Association table for User-Project Many-to-Many relationship
user_projects = Table(
    "user_projects",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id"), primary_key=True),
    Column("project_id", Integer, ForeignKey("projects.id"), primary_key=True)
)

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    full_name = Column(String, nullable=True)
    hashed_password = Column(String) # This will store the "access code"
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Many-to-many relationship with projects
    assigned_projects = relationship("Project", secondary=user_projects, back_populates="assigned_users")
    # For projects they own
    owned_projects = relationship("Project", back_populates="owner")

class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    description = Column(String, nullable=True)
    contract_number = Column(String, nullable=True)
    start_date = Column(DateTime(timezone=True), nullable=True)
    end_date = Column(DateTime(timezone=True), nullable=True)
    photo_url = Column(String, nullable=True) # Project "profile" photo
    
    owner_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=True)

    owner = relationship("User", back_populates="owned_projects")
    assigned_users = relationship("User", secondary=user_projects, back_populates="assigned_projects")
    layers = relationship("Layer", back_populates="project")
    folders = relationship("Folder", back_populates="project")

class Folder(Base):
    __tablename__ = "folders"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    parent_id = Column(Integer, ForeignKey("folders.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    project = relationship("Project", back_populates="folders")
    layers = relationship("Layer", back_populates="folder")
    subfolders = relationship("Folder", backref="parent", remote_side=[id])

class Layer(Base):
    __tablename__ = "layers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    layer_type = Column(String)  # 'raster', 'vector', '3d_model'
    file_path = Column(String)
    crs = Column(String, nullable=True) # e.g., 'EPSG:4326'
    
    # Store the bounding box or geometry of the layer
    bounds = Column(Geometry('POLYGON', srid=4326), nullable=True)
    
    project_id = Column(Integer, ForeignKey("projects.id"))
    folder_id = Column(Integer, ForeignKey("folders.id"), nullable=True)
    
    # CAMBIO AQUÍ: metadata -> settings o extra_info
    settings = Column(JSON, nullable=True, default={}) 
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    project = relationship("Project", back_populates="layers")
    folder = relationship("Folder", back_populates="layers")
