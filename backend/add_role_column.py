from database import engine
from sqlalchemy import text

def update_db():
    print("Iniciando actualización de base de datos...")
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR DEFAULT 'usuario'"))
            conn.execute(text("UPDATE users SET role = 'administrador' WHERE is_superuser = true"))
            conn.commit()
            print("Columna 'role' añadida y valores actualizados.")
        except Exception as e:
            print(f"Error al actualizar: {e}")

if __name__ == "__main__":
    update_db()
