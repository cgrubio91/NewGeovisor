"""
Script de migración para actualizar la base de datos con los nuevos campos de Layer
Ejecutar después de actualizar los modelos
"""

from sqlalchemy import create_engine, text
from database import settings
import sys

def migrate_database():
    """Migrar base de datos añadiendo nuevos campos a la tabla layers"""
    
    try:
        # Crear conexión
        engine = create_engine(settings.DATABASE_URL)
        
        print("🔄 Iniciando migración de base de datos...")
        
        with engine.connect() as conn:
            # Iniciar transacción
            trans = conn.begin()
            
            try:
                # Verificar si las columnas ya existen
                check_query = text("""
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name = 'layers' 
                    AND column_name IN ('file_format', 'visible', 'opacity', 'z_index', 'updated_at')
                """)
                
                existing_columns = [row[0] for row in conn.execute(check_query)]
                
                # Añadir file_format si no existe
                if 'file_format' not in existing_columns:
                    print("  ➕ Añadiendo columna 'file_format'...")
                    conn.execute(text("""
                        ALTER TABLE layers 
                        ADD COLUMN file_format VARCHAR
                    """))
                    print("  ✅ Columna 'file_format' añadida")
                else:
                    print("  ℹ️  Columna 'file_format' ya existe")
                
                # Añadir visible si no existe
                if 'visible' not in existing_columns:
                    print("  ➕ Añadiendo columna 'visible'...")
                    conn.execute(text("""
                        ALTER TABLE layers 
                        ADD COLUMN visible BOOLEAN NOT NULL DEFAULT TRUE
                    """))
                    print("  ✅ Columna 'visible' añadida")
                else:
                    print("  ℹ️  Columna 'visible' ya existe")
                
                # Añadir opacity si no existe
                if 'opacity' not in existing_columns:
                    print("  ➕ Añadiendo columna 'opacity'...")
                    conn.execute(text("""
                        ALTER TABLE layers 
                        ADD COLUMN opacity INTEGER NOT NULL DEFAULT 100
                    """))
                    print("  ✅ Columna 'opacity' añadida")
                else:
                    print("  ℹ️  Columna 'opacity' ya existe")
                
                # Añadir z_index si no existe
                if 'z_index' not in existing_columns:
                    print("  ➕ Añadiendo columna 'z_index'...")
                    conn.execute(text("""
                        ALTER TABLE layers 
                        ADD COLUMN z_index INTEGER NOT NULL DEFAULT 0
                    """))
                    print("  ✅ Columna 'z_index' añadida")
                else:
                    print("  ℹ️  Columna 'z_index' ya existe")
                
                # Añadir updated_at si no existe
                if 'updated_at' not in existing_columns:
                    print("  ➕ Añadiendo columna 'updated_at'...")
                    conn.execute(text("""
                        ALTER TABLE layers 
                        ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                    """))
                    print("  ✅ Columna 'updated_at' añadida")
                else:
                    print("  ℹ️  Columna 'updated_at' ya existe")
                
                # Actualizar file_format basado en layer_type para capas existentes
                print("  🔄 Actualizando file_format para capas existentes...")
                conn.execute(text("""
                    UPDATE layers 
                    SET file_format = CASE
                        WHEN layer_type = 'raster' AND file_path LIKE '%.tif%' THEN 'tiff'
                        WHEN layer_type = 'raster' AND file_path LIKE '%.geotiff%' THEN 'geotiff'
                        WHEN layer_type = 'vector' AND file_path LIKE '%.shp%' THEN 'shapefile'
                        WHEN layer_type = 'vector' AND file_path LIKE '%.geojson%' THEN 'geojson'
                        WHEN layer_type = 'vector' AND file_path LIKE '%.json%' THEN 'geojson'
                        WHEN layer_type = '3d_model' AND file_path LIKE '%.obj%' THEN 'obj'
                        WHEN layer_type = '3d_model' AND file_path LIKE '%.gltf%' THEN 'gltf'
                        WHEN layer_type = '3d_model' AND file_path LIKE '%.glb%' THEN 'glb'
                        WHEN file_path LIKE '%.kml%' THEN 'kml'
                        WHEN file_path LIKE '%.kmz%' THEN 'kmz'
                        WHEN file_path LIKE '%.las%' THEN 'las'
                        WHEN file_path LIKE '%.laz%' THEN 'laz'
                        WHEN file_path LIKE '%.dxf%' THEN 'dxf'
                        WHEN file_path LIKE '%.dwg%' THEN 'dwg'
                        ELSE layer_type
                    END
                    WHERE file_format IS NULL
                """))
                print("  ✅ file_format actualizado")
                
                # Commit de la transacción
                trans.commit()
                print("✅ Migración completada exitosamente!")
                
                # Mostrar resumen
                result = conn.execute(text("SELECT COUNT(*) FROM layers"))
                count = result.scalar()
                print(f"\n📊 Total de capas en la base de datos: {count}")
                
                return True
                
            except Exception as e:
                trans.rollback()
                print(f"❌ Error durante la migración: {e}")
                return False
                
    except Exception as e:
        print(f"❌ Error conectando a la base de datos: {e}")
        return False

def verify_migration():
    """Verificar que la migración se realizó correctamente"""
    
    try:
        engine = create_engine(settings.DATABASE_URL)
        
        print("\n🔍 Verificando migración...")
        
        with engine.connect() as conn:
            # Verificar estructura de la tabla
            result = conn.execute(text("""
                SELECT column_name, data_type, column_default
                FROM information_schema.columns
                WHERE table_name = 'layers'
                ORDER BY ordinal_position
            """))
            
            print("\n📋 Estructura de la tabla 'layers':")
            print("-" * 80)
            print(f"{'Columna':<20} {'Tipo':<30} {'Default':<30}")
            print("-" * 80)
            
            for row in result:
                column_name, data_type, column_default = row
                default_str = str(column_default)[:28] if column_default else 'NULL'
                print(f"{column_name:<20} {data_type:<30} {default_str:<30}")
            
            print("-" * 80)
            
            # Verificar que los nuevos campos existen
            required_columns = ['file_format', 'visible', 'opacity', 'z_index', 'updated_at']
            result = conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'layers' 
                AND column_name = ANY(:columns)
            """), {"columns": required_columns})
            
            found_columns = [row[0] for row in result]
            
            print("\n✅ Verificación de nuevas columnas:")
            for col in required_columns:
                status = "✅" if col in found_columns else "❌"
                print(f"  {status} {col}")
            
            all_present = all(col in found_columns for col in required_columns)
            
            if all_present:
                print("\n✅ Todas las columnas requeridas están presentes!")
                return True
            else:
                print("\n❌ Faltan algunas columnas requeridas")
                return False
                
    except Exception as e:
        print(f"❌ Error verificando migración: {e}")
        return False

if __name__ == "__main__":
    print("=" * 80)
    print("🗄️  MIGRACIÓN DE BASE DE DATOS - GEOVISOR PRO v2.0")
    print("=" * 80)
    print()
    
    # Ejecutar migración
    success = migrate_database()
    
    if success:
        # Verificar migración
        verify_migration()
        print("\n✅ Proceso completado exitosamente!")
        sys.exit(0)
    else:
        print("\n❌ La migración falló. Revisa los errores anteriores.")
        sys.exit(1)
