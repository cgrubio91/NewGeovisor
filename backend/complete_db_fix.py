import sys
import os
from sqlalchemy import create_engine, text, inspect
from sqlalchemy.orm import sessionmaker

# Agregar el directorio actual al path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import settings, engine
import models

def fix_all_database_discrepancies():
    print("🔧 Iniciando reparación exhaustiva de base de datos...")
    
    inspector = inspect(engine)
    
    # 1. Tablas y columnas esperadas según models.py (simplificado)
    # Definimos manualmente lo que sabemos que debe existir para ir a la fija
    schema_expectations = {
        "layers": {
            "updated_at": "TIMESTAMP WITH TIME ZONE DEFAULT NOW()",
            "created_at": "TIMESTAMP WITH TIME ZONE DEFAULT NOW()",
            "file_format": "VARCHAR",
            "folder_id": "INTEGER REFERENCES folders(id) ON DELETE SET NULL",
            "visible": "BOOLEAN DEFAULT TRUE NOT NULL",
            "opacity": "INTEGER DEFAULT 100 NOT NULL",
            "z_index": "INTEGER DEFAULT 0 NOT NULL",
            "settings": "JSON DEFAULT '{}'",
            "bounds": "GEOMETRY(POLYGON, 4326)"
        },
        "projects": {
            "updated_at": "TIMESTAMP WITH TIME ZONE DEFAULT NOW()",
            "created_at": "TIMESTAMP WITH TIME ZONE DEFAULT NOW()",
            "owner_id": "INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE",
            "photo_url": "VARCHAR"
        },
        "folders": {
            "created_at": "TIMESTAMP WITH TIME ZONE DEFAULT NOW()",
            "parent_id": "INTEGER REFERENCES folders(id) ON DELETE CASCADE"
        },
        "users": {
             "created_at": "TIMESTAMP WITH TIME ZONE DEFAULT NOW()"
        }
    }
    
    with engine.connect() as connection:
        connection.execution_options(isolation_level="AUTOCOMMIT")
        
        for table_name, expected_columns in schema_expectations.items():
            if not inspector.has_table(table_name):
                print(f"⚠️ La tabla '{table_name}' no existe. Se intentará crear con create_all().")
                continue
                
            print(f"\n🔍 Verificando tabla '{table_name}'...")
            existing_columns = [col['name'] for col in inspector.get_columns(table_name)]
            
            for col_name, col_def in expected_columns.items():
                if col_name not in existing_columns:
                    print(f"   ➕ FALTABA: {col_name}. Añadiendo...")
                    try:
                        # Para bounds/PostGIS puede ser especial
                        if col_name == "bounds":
                            stmt = text(f"SELECT AddGeometryColumn('{table_name}', 'bounds', 4326, 'POLYGON', 2);")
                        else:
                            stmt = text(f"ALTER TABLE {table_name} ADD COLUMN {col_name} {col_def}")
                        
                        connection.execute(stmt)
                        connection.commit()
                        print(f"   ✅ {col_name} añadida correctamente.")
                    except Exception as e:
                        print(f"   ❌ Error añadiendo {col_name}: {e}")
                else:
                    print(f"   ok: {col_name}")

    print("\n✨ Reparación completada.")

if __name__ == "__main__":
    try:
        # Primero asegurar que tablas básicas existen
        models.Base.metadata.create_all(bind=engine)
        fix_all_database_discrepancies()
    except Exception as e:
        print(f"❌ Error crítico: {e}")
