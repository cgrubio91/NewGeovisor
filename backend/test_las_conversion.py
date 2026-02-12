"""
Script de prueba para verificar la conversión de archivos LAS
"""
import os
import sys

# Añadir el directorio actual al path para importar convert_3d
sys.path.insert(0, os.path.dirname(__file__))

from convert_3d import convert_point_cloud

def test_conversion():
    input_file = "uploads/points_2.las"
    output_dir = "uploads/test_conversion"
    
    print(f"🔍 Probando conversión de: {input_file}")
    print(f"📁 Salida en: {output_dir}")
    print("-" * 60)
    
    if not os.path.exists(input_file):
        print(f"❌ ERROR: Archivo no encontrado: {input_file}")
        return False
    
    file_size_mb = os.path.getsize(input_file) / (1024 * 1024)
    print(f"📊 Tamaño del archivo: {file_size_mb:.2f} MB")
    print(f"⏱️  Tiempo estimado: {int(file_size_mb / 10)} - {int(file_size_mb / 5)} minutos")
    print("-" * 60)
    
    success, result = convert_point_cloud(input_file, output_dir)
    
    print("-" * 60)
    if success:
        print(f"✅ ÉXITO: Conversión completada")
        print(f"📄 Archivo generado: {result}")
        
        # Verificar contenido
        if os.path.exists(output_dir):
            contents = os.listdir(output_dir)
            print(f"📂 Contenido del directorio:")
            for item in contents:
                item_path = os.path.join(output_dir, item)
                if os.path.isfile(item_path):
                    size = os.path.getsize(item_path)
                    print(f"   - {item} ({size:,} bytes)")
                else:
                    print(f"   - {item}/ (directorio)")
        return True
    else:
        print(f"❌ ERROR: {result}")
        return False

if __name__ == "__main__":
    test_conversion()
