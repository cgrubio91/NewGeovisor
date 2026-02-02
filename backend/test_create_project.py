import sys
import os
from datetime import datetime

# Agregar el directorio actual al path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal
import models
import crud
import schemas

def test_creation():
    print("🧪 Probando creación de proyecto en BD reparada...")
    db = SessionLocal()
    try:
        # 1. Obtener o crear un usuario de prueba
        user = db.query(models.User).filter(models.User.username == "test_user_fix").first()
        if not user:
            user = models.User(
                username="test_user_fix",
                email="test_fix@example.com",
                hashed_password="fakehash",
                full_name="Test Fix User"
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            print(f"   👤 Usuario de prueba creado: {user.id}")
        else:
            print(f"   👤 Usuario de prueba existente: {user.id}")

        # 2. Intentar crear proyecto (Lo que fallaba antes)
        project_in = schemas.ProjectCreate(
            name=f"Proyecto Test {datetime.now().strftime('%H:%M:%S')}",
            description="Test de verificación de esquema",
            contract_number="123",
            start_date=datetime.now(),
            end_date=datetime.now()
        )
        
        print("   🏗️ Intentando crear proyecto...")
        project = crud.create_project(db, project_in, user.id)
        print(f"   ✅ PROYECTO CREADO EXITOSAMENTE: ID {project.id}")
        
        # 3. Intentar leerlo de vuelta (Verificar mapeo de campos de lectura)
        # Esto verifica que al hacer SELECT no falle por columnas faltantes al leer
        p_read = db.query(models.Project).filter(models.Project.id == project.id).first()
        print(f"   📖 Proyecto leído: '{p_read.name}' (Updated At: {p_read.updated_at})")
        
        if p_read.updated_at is None:
            print("   ⚠️ ADVERTENCIA: updated_at es None (no crítico pero debería tener valor)")
        else:
            print("   ✅ updated_at tiene valor correcto")

        # 4. Limpieza
        db.delete(project)
        db.commit()
        print("   🧹 Proyecto de prueba eliminado")
        
    except Exception as e:
        print(f"\n❌ PREUBA FALLIDA: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    test_creation()
