import os
from dotenv import load_dotenv
import psycopg2

load_dotenv()

# Configuración de la base de datos
DB_USER = "postgres"
DB_PASS = "1064112177"
DB_HOST = "localhost"
DB_PORT = "5432"
DB_NAME = "geovisor_db"

def migrate():
    try:
        conn = psycopg2.connect(
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASS,
            host=DB_HOST,
            port=DB_PORT
        )
        cur = conn.cursor()
        
        print("🚀 Iniciando migración de columnas...")
        
        # Agregar mongodb_id a users
        cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS mongodb_id VARCHAR;")
        cur.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_mongodb_id ON users(mongodb_id) WHERE mongodb_id IS NOT NULL;")
        print("✅ Columna mongodb_id agregada a 'users'")
        
        # Agregar mongodb_id a projects
        cur.execute("ALTER TABLE projects ADD COLUMN IF NOT EXISTS mongodb_id VARCHAR;")
        cur.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_mongodb_id ON projects(mongodb_id) WHERE mongodb_id IS NOT NULL;")
        print("✅ Columna mongodb_id agregada a 'projects'")
        
        # Agregar geofence_type a layers
        cur.execute("ALTER TABLE layers ADD COLUMN IF NOT EXISTS geofence_type VARCHAR DEFAULT 'ninguno';")
        print("✅ Columna geofence_type agregada a 'layers'")
        
        conn.commit()
        print("🎉 Migración completada exitosamente.")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"❌ Error durante la migración: {e}")

if __name__ == "__main__":
    migrate()
