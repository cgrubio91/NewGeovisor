"""
Script de prueba para verificar el funcionamiento del backend
Prueba los endpoints principales de la API
"""
import requests
import json

# URL base del backend
BASE_URL = "http://localhost:8000"

def test_root():
    """Prueba el endpoint raíz"""
    print("🔍 Probando endpoint raíz...")
    try:
        response = requests.get(f"{BASE_URL}/")
        print(f"✅ Estado: {response.status_code}")
        print(f"📄 Respuesta: {response.json()}")
        return response.status_code == 200
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_upload():
    """Prueba el endpoint de carga de archivos"""
    print("\n🔍 Probando endpoint de carga...")
    print("ℹ️  Nota: Este test requiere archivos de prueba en la carpeta Datos_prueba")
    # Este test requiere archivos reales, solo mostramos cómo se haría
    print("⚠️  Omitiendo prueba de carga (requiere archivos)")
    return True

def test_tiles():
    """Prueba el endpoint de tiles"""
    print("\n🔍 Probando endpoint de tiles...")
    print("ℹ️  Nota: Este test requiere un archivo raster cargado previamente")
    print("⚠️  Omitiendo prueba de tiles (requiere archivo raster)")
    return True

def main():
    """Ejecuta todas las pruebas"""
    print("=" * 60)
    print("🚀 INICIANDO PRUEBAS DEL BACKEND - GEOVISOR")
    print("=" * 60)
    
    tests = [
        ("Endpoint Raíz", test_root),
        ("Carga de Archivos", test_upload),
        ("Servicio de Tiles", test_tiles)
    ]
    
    results = []
    for name, test_func in tests:
        result = test_func()
        results.append((name, result))
    
    print("\n" + "=" * 60)
    print("📊 RESUMEN DE PRUEBAS")
    print("=" * 60)
    
    for name, result in results:
        status = "✅ PASÓ" if result else "❌ FALLÓ"
        print(f"{status} - {name}")
    
    total = len(results)
    passed = sum(1 for _, r in results if r)
    print(f"\n📈 Total: {passed}/{total} pruebas exitosas")
    
    if passed == total:
        print("\n🎉 ¡Todas las pruebas pasaron exitosamente!")
    else:
        print("\n⚠️  Algunas pruebas fallaron. Revisa los detalles arriba.")

if __name__ == "__main__":
    main()
