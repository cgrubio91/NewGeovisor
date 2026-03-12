#!/usr/bin/env python3
"""
Script CLI para ejecutar análisis geográfico de registros.
Interfaz de línea de comandos para generar reportes directamente.
"""

import sys
import os
from datetime import datetime
from pathlib import Path
import argparse

# Agregar el directorio actual al path para importar módulos locales
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Cargar variables de entorno
from dotenv import load_dotenv
load_dotenv()

from geographic_records import crear_analizador_desde_env


def obtener_fechas_interactivo():
    """Obtiene el rango de fechas de forma interactiva."""
    print("\n📅 INGRESA EL RANGO DE FECHAS PARA EL REPORTE")
    print("Formato: YYYY-MM-DD (ej: 2026-03-01)\n")
    
    while True:
        try:
            fecha_inicio_str = input("Fecha inicial: ").strip()
            fecha_inicio = datetime.strptime(fecha_inicio_str, '%Y-%m-%d')
            break
        except ValueError:
            print("❌ Formato inválido. Usa el formato YYYY-MM-DD")
    
    while True:
        try:
            fecha_fin_str = input("Fecha final: ").strip()
            fecha_fin = datetime.strptime(fecha_fin_str, '%Y-%m-%d')
            fecha_fin = fecha_fin.replace(hour=23, minute=59, second=59)
            
            if fecha_fin < fecha_inicio:
                print("❌ La fecha final no puede ser anterior a la fecha inicial")
                continue
            break
        except ValueError:
            print("❌ Formato inválido. Usa el formato YYYY-MM-DD")
    
    return fecha_inicio, fecha_fin


def obtener_filtros_interactivo():
    """Obtiene los filtros de forma interactiva."""
    print("\n🔍 FILTROS OPCIONALES (presiona Enter para omitir)")
    
    pid_filtro = input("PID del proyecto: ").strip() or None
    user_filtro = input("Email del usuario: ").strip() or None
    nombre_filtro = input("Nombre del proyecto (búsqueda): ").strip() or None
    
    return pid_filtro, user_filtro, nombre_filtro


def menu_principal():
    """Menú principal interactivo."""
    while True:
        print("\n" + "="*60)
        print("  SISTEMA DE ANÁLISIS GEOGRÁFICO DE REGISTROS")
        print("  Control Registros SEGMAB")
        print("="*60)
        print("\n1. 📊 Generar Reporte Global")
        print("   → Todos los registros en un rango de fechas")
        print("   → Salida: Excel con clasificación de ubicaciones\n")
        
        print("2. 🗺️  Generar Reporte Filtrado")
        print("   → Filtrar por proyecto, usuario o fecha")
        print("   → Salida: Excel con datos procesados\n")
        
        print("3. ⚙️  Información de Configuración")
        print("   → Verificar variables de entorno SSH y MongoDB\n")
        
        print("4. 🧹 Limpiar Carpeta de Reportes")
        print("   → Eliminar archivos anteriores\n")
        
        print("Q. Salir\n")
        
        opcion = input("Selecciona opción (1-4/Q): ").strip().upper()
        
        if opcion == "Q":
            print("\n👋 ¡Hasta luego!")
            break
        elif opcion == "1":
            ejecutar_reporte_global()
        elif opcion == "2":
            ejecutar_reporte_filtrado()
        elif opcion == "3":
            mostrar_configuracion()
        elif opcion == "4":
            limpiar_reportes()
        else:
            print("\n❌ Opción no reconocida")


def ejecutar_reporte_global():
    """Ejecuta un reporte global."""
    print("\n" + "="*60)
    print("  GENERADOR DE REPORTE GLOBAL")
    print("="*60)
    
    try:
        fecha_inicio, fecha_fin = obtener_fechas_interactivo()
        
        print("\n⏳ Conectando a MongoDB...")
        analizador = crear_analizador_desde_env(kml_base_path="uploads")
        
        print(f"📊 Generando reporte para {fecha_inicio.date()} - {fecha_fin.date()}...")
        df = analizador.generar_reporte(
            fecha_inicio=fecha_inicio,
            fecha_fin=fecha_fin
        )
        
        if len(df) == 0:
            print("❌ No se encontraron registros en el rango especificado")
            return
        
        # Crear directorio si no existe
        os.makedirs("report", exist_ok=True)
        
        # Generar nombre del archivo
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        nombre_archivo = f"Reporte_{timestamp}.xlsx"
        ruta_archivo = os.path.join("report", nombre_archivo)
        
        # Guardar Excel
        analizador.exportar_a_excel(df, ruta_archivo)
        
        # Mostrar estadísticas
        stats = {
            "EN OBRA": (df["Clasificación"] == "EN OBRA").sum(),
            "EN OFICINA": (df["Clasificación"] == "EN OFICINA").sum(),
            "UBICACIÓN EXTERNA": (df["Clasificación"] == "UBICACIÓN EXTERNA").sum()
        }
        
        print("\n✅ ¡REPORTE GENERADO EXITOSAMENTE!")
        print(f"📁 Archivo: {ruta_archivo}")
        print(f"📊 Total de registros: {len(df)}")
        print(f"\n📈 Estadísticas de clasificación:")
        for clave, valor in stats.items():
            print(f"   - {clave}: {valor}")
        
        # Limpiar
        analizador.limpiar_cache()
        
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()


def ejecutar_reporte_filtrado():
    """Ejecuta un reporte con filtros."""
    print("\n" + "="*60)
    print("  GENERADOR DE REPORTE FILTRADO")
    print("="*60)
    
    try:
        fecha_inicio, fecha_fin = obtener_fechas_interactivo()
        pid_filtro, user_filtro, nombre_filtro = obtener_filtros_interactivo()
        
        print("\n⏳ Conectando a MongoDB...")
        analizador = crear_analizador_desde_env(kml_base_path="uploads")
        
        print("📊 Generando reporte con filtros...")
        df = analizador.generar_reporte(
            fecha_inicio=fecha_inicio,
            fecha_fin=fecha_fin,
            pid_filtro=pid_filtro,
            user_filtro=user_filtro,
            nombre_proyecto_filtro=nombre_filtro
        )
        
        if len(df) == 0:
            print("❌ No se encontraron registros con los filtros especificados")
            return
        
        # Crear directorio si no existe
        os.makedirs("report", exist_ok=True)
        
        # Generar nombre del archivo
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        nombre_archivo = f"Reporte_Filtrado_{timestamp}.xlsx"
        ruta_archivo = os.path.join("report", nombre_archivo)
        
        # Guardar Excel
        analizador.exportar_a_excel(df, ruta_archivo)
        
        # Mostrar estadísticas
        stats = {
            "EN OBRA": (df["Clasificación"] == "EN OBRA").sum(),
            "EN OFICINA": (df["Clasificación"] == "EN OFICINA").sum(),
            "UBICACIÓN EXTERNA": (df["Clasificación"] == "UBICACIÓN EXTERNA").sum()
        }
        
        print("\n✅ ¡REPORTE GENERADO EXITOSAMENTE!")
        print(f"📁 Archivo: {ruta_archivo}")
        print(f"📊 Total de registros: {len(df)}")
        print(f"\n📈 Estadísticas de clasificación:")
        for clave, valor in stats.items():
            print(f"   - {clave}: {valor}")
        
        # Limpiar
        analizador.limpiar_cache()
        
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()


def mostrar_configuracion():
    """Muestra la configuración de variables de entorno."""
    print("\n" + "="*60)
    print("  INFORMACIÓN DE CONFIGURACIÓN")
    print("="*60)
    
    ssh_host = os.getenv("SSH_HOST", "❌ No configurado")
    ssh_user = os.getenv("SSH_USER", "❌ No configurado")
    ssh_key_path = os.getenv("SSH_KEY_PATH", "❌ No configurado")
    db_name = os.getenv("DB_NAME", "❌ No configurado")
    mongo_port = os.getenv("MONGO_PORT", "27017")
    
    print("\n🔒 Configuración SSH:")
    print(f"   SSH_HOST: {ssh_host}")
    print(f"   SSH_USER: {ssh_user}")
    print(f"   SSH_KEY_PATH: {ssh_key_path}")
    
    print("\n🗄️  Configuración MongoDB:")
    print(f"   MONGO_PORT: {mongo_port}")
    print(f"   DB_NAME: {db_name}")
    
    print("\n🗂️  Rutas:")
    print(f"   KML Base Path: uploads")
    print(f"   Reportes: report/")
    
    # Verificar existencia de archivo KML
    if os.path.isdir("uploads"):
        kml_files = list(Path("uploads").glob("*.kml")) + list(Path("uploads").glob("*.kmz"))
        print(f"\n   Archivos KML/KMZ encontrados: {len(kml_files)}")
        if len(kml_files) > 0:
            print(f"   Primeros 5: {', '.join([f.name for f in kml_files[:5]])}")
    else:
        print("\n   ⚠️  Carpeta 'uploads' no existe")


def limpiar_reportes():
    """Limpia la carpeta de reportes."""
    print("\n" + "="*60)
    print("  LIMPIAR CARPETA DE REPORTES")
    print("="*60)
    
    if not os.path.isdir("report"):
        print("\n✅ La carpeta de reportes no existe o está vacía")
        return
    
    archivos = list(Path("report").glob("*.xlsx"))
    
    if len(archivos) == 0:
        print("\n✅ No hay archivos Excel para eliminar")
        return
    
    print(f"\n📁 Se encontraron {len(archivos)} archivos Excel")
    print("\nArchivos a eliminar:")
    for archivo in archivos[:10]:
        print(f"   - {archivo.name}")
    
    if len(archivos) > 10:
        print(f"   ... y {len(archivos) - 10} más")
    
    confirmacion = input("\n¿Estás seguro de que deseas eliminarlos? (s/n): ").strip().lower()
    
    if confirmacion == "s":
        for archivo in archivos:
            try:
                archivo.unlink()
                print(f"✅ Eliminado: {archivo.name}")
            except Exception as e:
                print(f"❌ Error eliminando {archivo.name}: {str(e)}")
        print("\n✅ Limpieza completada")
    else:
        print("\n⚠️  Operación cancelada")


def main():
    """Función principal."""
    parser = argparse.ArgumentParser(
        description="Sistema de Análisis Geográfico de Registros SEGMAB",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
ejemplos:
  python %(prog)s                          # Menú interactivo
  python %(prog)s --global --inicio 2026-01-01 --fin 2026-03-31
  python %(prog)s --filtrado --pid 5f231f11682b965f9889826c --inicio 2026-01-01 --fin 2026-03-31
  python %(prog)s --info                   # Mostrar configuración
        """
    )
    
    parser.add_argument(
        "--global",
        dest="global_report",
        action="store_true",
        help="Generar reporte global"
    )
    
    parser.add_argument(
        "--filtrado",
        action="store_true",
        help="Generar reporte con filtros"
    )
    
    parser.add_argument(
        "--inicio",
        type=str,
        help="Fecha inicial (YYYY-MM-DD)"
    )
    
    parser.add_argument(
        "--fin",
        type=str,
        help="Fecha final (YYYY-MM-DD)"
    )
    
    parser.add_argument(
        "--pid",
        type=str,
        help="Filtrar por PID del proyecto"
    )
    
    parser.add_argument(
        "--usuario",
        type=str,
        help="Filtrar por email del usuario"
    )
    
    parser.add_argument(
        "--proyecto",
        type=str,
        help="Filtrar por nombre del proyecto"
    )
    
    parser.add_argument(
        "--info",
        action="store_true",
        help="Mostrar información de configuración"
    )
    
    args = parser.parse_args()
    
    # Si no hay argumentos, mostrar menú interactivo
    if not any([args.global_report, args.filtrado, args.info]):
        menu_principal()
    elif args.info:
        mostrar_configuracion()
    elif args.global_report:
        if not args.inicio or not args.fin:
            print("❌ Error: Debes proporcionar --inicio y --fin")
            sys.exit(1)
        
        try:
            fecha_inicio = datetime.strptime(args.inicio, '%Y-%m-%d')
            fecha_fin = datetime.strptime(args.fin, '%Y-%m-%d').replace(hour=23, minute=59, second=59)
            
            print(f"\n📊 Generando reporte global...")
            analizador = crear_analizador_desde_env(kml_base_path="uploads")
            df = analizador.generar_reporte(
                fecha_inicio=fecha_inicio,
                fecha_fin=fecha_fin
            )
            
            if len(df) == 0:
                print("❌ No se encontraron registros")
                sys.exit(1)
            
            os.makedirs("report", exist_ok=True)
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            ruta_archivo = os.path.join("report", f"Reporte_{timestamp}.xlsx")
            analizador.exportar_a_excel(df, ruta_archivo)
            
            print(f"✅ Reporte generado: {ruta_archivo}")
            print(f"📊 Total registros: {len(df)}")
            
        except ValueError as e:
            print(f"❌ Error de formato de fecha: {str(e)}")
            sys.exit(1)
        except Exception as e:
            print(f"❌ Error: {str(e)}")
            sys.exit(1)
    
    elif args.global_report:
        if not args.inicio or not args.fin:
            print("❌ Error: Debes proporcionar --inicio y --fin")
            sys.exit(1)
    
    elif args.filtrado:
        if not args.inicio or not args.fin:
            print("❌ Error: Debes proporcionar --inicio y --fin")
            sys.exit(1)
        
        try:
            fecha_inicio = datetime.strptime(args.inicio, '%Y-%m-%d')
            fecha_fin = datetime.strptime(args.fin, '%Y-%m-%d').replace(hour=23, minute=59, second=59)
            
            print(f"\n📊 Generando reporte filtrado...")
            analizador = crear_analizador_desde_env(kml_base_path="uploads")
            df = analizador.generar_reporte(
                fecha_inicio=fecha_inicio,
                fecha_fin=fecha_fin,
                pid_filtro=args.pid,
                user_filtro=args.usuario,
                nombre_proyecto_filtro=args.proyecto
            )
            
            if len(df) == 0:
                print("❌ No se encontraron registros")
                sys.exit(1)
            
            os.makedirs("report", exist_ok=True)
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            ruta_archivo = os.path.join("report", f"Reporte_Filtrado_{timestamp}.xlsx")
            analizador.exportar_a_excel(df, ruta_archivo)
            
            print(f"✅ Reporte generado: {ruta_archivo}")
            print(f"📊 Total registros: {len(df)}")
            
        except ValueError as e:
            print(f"❌ Error de formato de fecha: {str(e)}")
            sys.exit(1)
        except Exception as e:
            print(f"❌ Error: {str(e)}")
            sys.exit(1)


if __name__ == "__main__":
    main()
