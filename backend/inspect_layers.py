import sys
import os
from sqlalchemy import create_engine, inspect

# Agregar el directorio actual al path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import settings

def inspect_db():
    print(f"📡 Inspeccionando BD: {settings.DATABASE_URL.split('@')[1] if '@' in settings.DATABASE_URL else '...'}")
    
    engine = create_engine(settings.DATABASE_URL)
    inspector = inspect(engine)
    
    if "layers" in inspector.get_table_names():
        columns = inspector.get_columns("layers")
        print("\n📋 Columnas en tabla 'layers':")
        col_names = [col['name'] for col in columns]
        for col in columns:
            print(f"   - {col['name']} ({col['type']})")
            
        print("\n🔍 Verificando columnas faltantes:")
        expected_cols = ["file_format", "folder_id", "visible", "opacity", "z_index", "settings"]
        missing = [col for col in expected_cols if col not in col_names]
        
        if missing:
            print(f"❌ FALTAN COLUMNAS: {missing}")
            return list(missing)
        else:
            print("✅ Todas las columnas esperadas existen.")
            return []
    else:
        print("❌ La tabla 'layers' NO existe.")
        return None

if __name__ == "__main__":
    inspect_db()
