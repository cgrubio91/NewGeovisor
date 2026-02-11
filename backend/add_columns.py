from sqlalchemy import create_engine, text
from database import settings

# This script adds 'processing_status' and 'processing_progress' columns to the 'layers' table
# if they do not already exist.

def upgrade_db():
    try:
        connection_string = settings.DATABASE_URL
        engine = create_engine(connection_string)
        
        with engine.connect() as conn:
            conn.execution_options(isolation_level="AUTOCOMMIT")
            
            # Check if columns exist
            try:
                # Intenta seleccionar para ver si fallas
                conn.execute(text("SELECT processing_status FROM layers LIMIT 1"))
                print("Column 'processing_status' already exists.")
            except Exception:
                print("Adding 'processing_status' column...")
                conn.execute(text("ALTER TABLE layers ADD COLUMN processing_status VARCHAR DEFAULT 'completed'"))
                
            try:
                conn.execute(text("SELECT processing_progress FROM layers LIMIT 1"))
                print("Column 'processing_progress' already exists.")
            except Exception:
                print("Adding 'processing_progress' column...")
                conn.execute(text("ALTER TABLE layers ADD COLUMN processing_progress INTEGER DEFAULT 100"))

        print("Database upgrade completed successfully.")
        
    except Exception as e:
        print(f"Error upgrading database: {e}")

if __name__ == "__main__":
    upgrade_db()
