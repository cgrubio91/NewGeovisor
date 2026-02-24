from database import engine
from sqlalchemy import text

print("Actualizando tabla measurements...")
with engine.connect() as conn:
    try:
        conn.execute(text("ALTER TABLE measurements ADD COLUMN folder_id INTEGER REFERENCES folders(id) ON DELETE SET NULL"))
        print("Columna folder_id añadida.")
    except Exception as e:
        print(f"folder_id ya podría existir o error: {e}")

    try:
        conn.execute(text("ALTER TABLE measurements ADD COLUMN visible BOOLEAN DEFAULT TRUE NOT NULL"))
        print("Columna visible añadida.")
    except Exception as e:
        print(f"visible ya podría existir o error: {e}")
    
    conn.commit()
print("Sincronización finalizada.")
