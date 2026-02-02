import sys
import os
from sqlalchemy import create_engine, text, inspect

# Agregar el directorio actual al path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import settings, engine
from models import Base

def fix_database():
    print("🔧 Iniciando reparación de base de datos...")
    
    # 1. Asegurar que todas las tablas nuevas (como folders) existan
    print("   Creando tablas faltantes...")
    Base.metadata.create_all(bind=engine)
    
    # 2. Actualizar tabla layers si existen pero le faltan columnas
    with engine.connect() as connection:
        # Aceptar transacciones automáticamente
        connection.execution_options(isolation_level="AUTOCOMMIT")
        
        inspector = inspect(engine)
        columns = [col['name'] for col in inspector.get_columns("layers")]
        
        print(f"   Columnas actuales en layers: {columns}")
        
        # Lista de columnas a añadir con su definición
        updates = [
            ("file_format", "VARCHAR"),
            ("folder_id", "INTEGER REFERENCES folders(id) ON DELETE SET NULL"),
            ("visible", "BOOLEAN DEFAULT TRUE NOT NULL"),
            ("opacity", "INTEGER DEFAULT 100 NOT NULL"),
            ("z_index", "INTEGER DEFAULT 0 NOT NULL"),
            ("settings", "JSON DEFAULT '{}'")
        ]
        
        for col_name, col_def in updates:
            if col_name not in columns:
                print(f"   ➕ Añadiendo columna: {col_name}")
                try:
                    stmt = text(f"ALTER TABLE layers ADD COLUMN {col_name} {col_def}")
                    connection.execute(stmt)
                    connection.commit() # Asegurar commit
                except Exception as e:
                    print(f"     ⚠️ Error añadiendo {col_name}: {e}")
                    # Puede fallar si hay transacciones pendientes, intentamos rollback explícito
                    connection.rollback()
            else:
                print(f"   ✅ Columna {col_name} ya existe")
                
    print("\n✨ Reparación completada.")

if __name__ == "__main__":
    fix_database()
