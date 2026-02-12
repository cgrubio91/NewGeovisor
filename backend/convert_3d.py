import os
import shutil
import tempfile
import sys
import subprocess
import json
import logging
from pathlib import Path

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('3D_Converter')

def convert_point_cloud(input_path: str, output_dir: str):
    """
    Convierte archivos LAS/LAZ a 3D Tiles usando py3dtiles CLI.
    Genera un tileset.json y jerarquía de .pnts en output_dir.
    Optimizado para archivos grandes con mejor manejo de errores.
    """
    try:
        # Convertir a rutas absolutas (py3dtiles tiene problemas con rutas relativas en Windows)
        input_path = os.path.abspath(input_path)
        output_dir = os.path.abspath(output_dir)
        
        # Verificar que el archivo de entrada existe
        if not os.path.exists(input_path):
            logger.error(f"Archivo de entrada no encontrado: {input_path}")
            return False, f"Input file not found: {input_path}"
        
        file_size_mb = os.path.getsize(input_path) / (1024 * 1024)
        logger.info(f"Tamaño del archivo: {file_size_mb:.2f} MB")
        
        # Asegurar directorio de salida limpio
        if os.path.exists(output_dir):
            logger.info(f"Limpiando directorio existente: {output_dir}")
            shutil.rmtree(output_dir)
        
        # Crear directorio padre si no existe
        parent_dir = os.path.dirname(output_dir)
        if not os.path.exists(parent_dir):
            logger.info(f"Creando directorio padre: {parent_dir}")
            os.makedirs(parent_dir, exist_ok=True)
        
        logger.info(f"Iniciando conversión de nube de puntos: {input_path} -> {output_dir}")
        
        # Usar el comando py3dtiles con configuración optimizada para archivos grandes
        # En Windows, deshabilitamos el process pool para evitar errores de multiprocessing
        cmd = [
            'py3dtiles', 'convert',
            input_path,
            '--out', output_dir,
            '--overwrite',
            '--disable-processpool'  # Necesario en Windows para evitar OSError: handle is closed
        ]
        
        logger.info(f"Ejecutando comando: {' '.join(cmd)}")
        
        # Ejecutar conversión con timeout extendido para archivos grandes
        # 10 minutos base + 1 minuto por cada 50MB
        timeout_seconds = 600 + int(file_size_mb / 50) * 60
        logger.info(f"Timeout configurado: {timeout_seconds} segundos")
        
        try:
            result = subprocess.run(
                cmd, 
                capture_output=True, 
                text=True,
                timeout=timeout_seconds,
                cwd=os.path.dirname(input_path) or '.'
            )
        except subprocess.TimeoutExpired:
            logger.error(f"Conversión excedió el tiempo límite de {timeout_seconds}s")
            return False, f"Conversion timeout after {timeout_seconds}s"
        
        # Mostrar salida del comando para debugging
        if result.stdout:
            logger.info(f"STDOUT: {result.stdout[:1000]}")  # Primeros 1000 caracteres
        if result.stderr:
            logger.warning(f"STDERR: {result.stderr[:2000]}")  # Primeros 2000 caracteres para ver el error completo
        
        if result.returncode != 0:
            logger.error(f"Error al convertir LAS/LAZ (código {result.returncode})")
            error_msg = result.stderr or result.stdout or "Unknown error"
            return False, f"Conversion failed: {error_msg[:200]}"
            
        logger.info("Comando de conversión completado exitosamente.")
        
        # Verificar que se generó tileset.json
        tileset_path = os.path.join(output_dir, 'tileset.json')
        
        # Esperar un momento para que el sistema de archivos sincronice
        import time
        time.sleep(1)
        
        if not os.path.exists(tileset_path):
            logger.error(f"tileset.json no fue generado en {tileset_path}")
            # Listar contenido del directorio para debugging
            try:
                contents = os.listdir(output_dir)
                logger.error(f"Contenido de {output_dir}: {contents}")
            except:
                pass
            return False, "tileset.json not generated"
        
        # Verificar que el tileset.json es válido
        try:
            with open(tileset_path, 'r') as f:
                tileset_data = json.load(f)
            if 'root' not in tileset_data:
                logger.error("tileset.json inválido: falta nodo 'root'")
                return False, "Invalid tileset.json structure"
            logger.info(f"tileset.json válido generado: {tileset_path}")
        except json.JSONDecodeError as e:
            logger.error(f"tileset.json corrupto: {e}")
            return False, f"Corrupted tileset.json: {e}"
        
        return True, tileset_path
            
    except Exception as e:
        logger.error(f"Excepción en conversión Point Cloud: {e}", exc_info=True)
        return False, str(e)

def convert_obj_to_glb(input_path: str, output_path: str):
    """
    Convierte archivos .obj a .glb (glTF binario) usando trimesh.
    Ideal para visualización eficiente en Cesium.
    """
    try:
        import trimesh
        
        logger.info(f"Iniciando conversión de modelo 3D: {input_path} -> {output_path}")
        
        # Cargar malla
        mesh = trimesh.load(input_path)
        
        # Si la escena tiene múltiples geometrías, trimesh carga una Scene
        if isinstance(mesh, trimesh.Scene):
            # Exportar escena completa como GLB
            export = mesh.export(file_type='glb')
        else:
            # Exportar malla única como GLB
            export = mesh.export(file_type='glb')
            
        # Escribir archivo binario
        with open(output_path, 'wb') as f:
            f.write(export)
            
        logger.info("Conversión a GLB completada exitosamente.")
        return True, output_path
        
    except Exception as e:
        logger.error(f"Excepción en conversión OBJ -> GLB: {e}")
        return False, str(e)
