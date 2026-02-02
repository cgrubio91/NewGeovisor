"""
Script de prueba para validar la configuración del archivo .env
"""
import sys
import os

# Agregar el directorio backend al path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import settings

def test_env_loading():
    """Prueba que las variables del .env se carguen correctamente"""
    print("=" * 60)
    print("🔍 PRUEBA DE CARGA DE VARIABLES DE ENTORNO")
    print("=" * 60)
    
    # Variables críticas
    tests = {
        "DATABASE_URL": settings.DATABASE_URL,
        "SECRET_KEY": settings.SECRET_KEY,
        "ALGORITHM": settings.ALGORITHM,
        "ACCESS_TOKEN_EXPIRE_MINUTES": settings.ACCESS_TOKEN_EXPIRE_MINUTES,
        "ENV": settings.ENV,
        "ALLOWED_ORIGINS": settings.ALLOWED_ORIGINS
    }
    
    all_passed = True
    
    for key, value in tests.items():
        status = "✅" if value else "❌"
        print(f"\n{status} {key}")
        
        # Mostrar valor (ocultar parcialmente datos sensibles)
        if key in ["SECRET_KEY", "DATABASE_URL"]:
            if "postgresql" in str(value):
                # Ocultar password en DATABASE_URL
                display_value = str(value).split("@")[0].split(":")[0:2]
                display_value = ":".join(display_value) + ":***@" + str(value).split("@")[1] if "@" in str(value) else "***"
            else:
                display_value = str(value)[:20] + "..." if len(str(value)) > 20 else str(value)
        else:
            display_value = value
            
        print(f"   Valor: {display_value}")
        
        # Validaciones específicas
        if key == "DATABASE_URL":
            if "postgresql" in str(value):
                print("   ✅ Usando PostgreSQL/PostGIS")
            elif "sqlite" in str(value):
                print("   ⚠️  Usando SQLite (solo para desarrollo)")
            else:
                print("   ❌ URL de base de datos no reconocida")
                all_passed = False
                
        elif key == "SECRET_KEY":
            if value == "DEVELOPMENT_SECRET_KEY_CHANGE_ME":
                print("   ⚠️  Usando clave por defecto (cambiar en producción)")
            elif len(str(value)) < 32:
                print("   ⚠️  Clave muy corta (recomendado: 64+ caracteres)")
            else:
                print("   ✅ Clave personalizada detectada")
                
        elif key == "ENV":
            if value in ["development", "production"]:
                print(f"   ✅ Entorno válido: {value}")
            else:
                print(f"   ⚠️  Entorno no estándar: {value}")
    
    print("\n" + "=" * 60)
    if all_passed:
        print("✅ TODAS LAS PRUEBAS PASARON")
    else:
        print("⚠️  ALGUNAS PRUEBAS FALLARON - Revisar configuración")
    print("=" * 60)
    
    return all_passed

if __name__ == "__main__":
    try:
        success = test_env_loading()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n❌ ERROR AL CARGAR CONFIGURACIÓN:")
        print(f"   {str(e)}")
        print("\n💡 Asegúrate de que:")
        print("   1. El archivo backend/.env existe")
        print("   2. Las variables están correctamente definidas")
        print("   3. No hay errores de sintaxis en el .env")
        sys.exit(1)
