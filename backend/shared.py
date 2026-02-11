import os
from diskcache import Cache

# Directorio base de subidas
UPLOAD_DIR = "uploads"

# Asegurar que existe
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)

# Directorio de backup (usado en convert_cogs)
BACKUP_DIR = "uploads_backup"

# Cache de tiles en disco
tile_cache = Cache("tile_cache")
