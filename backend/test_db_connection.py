import sys
import os
from sqlalchemy import text

# Agregar el directorio actual al path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from database import engine, settings
    print(f"📡 Intentando conectar a: {settings.DATABASE_URL.split('@')[1] if '@' in settings.DATABASE_URL else '...'}")
    
    with engine.connect() as connection:
        result = connection.execute(text("SELECT version();"))
        version = result.fetchone()[0]
        print("✅ CONEXIÓN EXITOSA")
        print(f"📊 Versión de Base de Datos: {version}")
        
except Exception as e:
    print("❌ ERROR DE CONEXIÓN")
    print(f"Error: {str(e)}")
    sys.exit(1)
