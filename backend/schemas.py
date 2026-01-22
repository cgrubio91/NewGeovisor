from pydantic import BaseModel, EmailStr
from typing import List, Optional, Any
from datetime import datetime

# Token Schemas
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

# User Schemas
class UserBase(BaseModel):
    username: str
    email: EmailStr
    full_name: Optional[str] = None
    is_active: Optional[bool] = True
    is_superuser: Optional[bool] = False

class UserCreate(UserBase):
    password: str # This will be the access code

class UserRead(UserBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

# Layer Schemas
class LayerBase(BaseModel):
    name: str
    layer_type: str
    file_path: str
    crs: Optional[str] = None
    metadata: Optional[Any] = None
    # We might handle geometry input/output differently
    
class LayerCreate(LayerBase):
    project_id: int
    # Bound/Geometry handling usually needs a separate serializer/deserializer 
    # or we extract it from the file server-side

class LayerRead(LayerBase):
    id: int
    project_id: int
    folder_id: Optional[int] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

# Folder Schemas
class FolderBase(BaseModel):
    name: str
    project_id: int
    parent_id: Optional[int] = None

class FolderCreate(FolderBase):
    pass

class FolderRead(FolderBase):
    id: int
    created_at: datetime
    layers: List[LayerRead] = []
    # subfolders: List['FolderRead'] = [] # Pydantic v2 might need forward refs

    class Config:
        from_attributes = True

# Project Schemas
class ProjectBase(BaseModel):
    name: str
    description: Optional[str] = None
    contract_number: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    photo_url: Optional[str] = None

class ProjectCreate(ProjectBase):
    pass

class ProjectRead(ProjectBase):
    id: int
    owner_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    layers: List[LayerRead] = []
    folders: List[FolderRead] = []
    assigned_users: List[UserRead] = []

    class Config:
        from_attributes = True

class ProjectAssign(BaseModel):
    user_id: int
    project_id: int
