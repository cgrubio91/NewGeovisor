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
    """
    try:
        # Asegurar directorio de salida limpio
        if os.path.exists(output_dir):
            shutil.rmtree(output_dir)
        os.makedirs(output_dir, exist_ok=True)
        
        logger.info(f"Iniciando conversión de nube de puntos: {input_path} -> {output_dir}")
        
        # Usar el comando py3dtiles directamente
        cmd = [
            'py3dtiles', 'convert',
            input_path,
            '--out', output_dir,
            '--overwrite'
        ]
        
        # Ejecutar conversión
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode != 0:
            logger.error(f"Error al convertir LAS/LAZ: {result.stderr}")
            return False, f"Conversion failed: {result.stderr}"
            
        logger.info("Conversión completada exitosamente.")
        
        # Verificar que se generó tileset.json
        tileset_path = os.path.join(output_dir, 'tileset.json')
        if os.path.exists(tileset_path):
            return True, tileset_path
        else:
            return False, "tileset.json not generated"
            
    except Exception as e:
        logger.error(f"Excepción en conversión Point Cloud: {e}")
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
