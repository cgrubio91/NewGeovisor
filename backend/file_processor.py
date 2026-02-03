"""
Servicio para procesar diferentes formatos de archivos geoespaciales
Soporta: TIFF, GeoTIFF, LAS, LAZ, OBJ, DWG, DXF, KMZ, KML, SHP, y más
"""

import os
import sys
from typing import Dict, Any, Optional, Tuple
from pathlib import Path
import json

# --- ENVIRONMENT FIX FOR PROJ ---
try:
    import pyproj
    os.environ['PROJ_LIB'] = pyproj.datadir.get_data_dir()
    os.environ['PROJ_DATA'] = pyproj.datadir.get_data_dir()
except Exception:
    pass


class FileProcessor:
    """Procesador de archivos geoespaciales multi-formato"""
    
    # Mapeo de extensiones a tipos y formatos
    EXTENSION_MAP = {
        # Raster
        '.tif': ('raster', 'tiff'),
        '.tiff': ('raster', 'tiff'),
        '.geotiff': ('raster', 'geotiff'),
        '.jpg': ('raster', 'jpeg'),
        '.jpeg': ('raster', 'jpeg'),
        '.png': ('raster', 'png'),
        
        # Vector
        '.shp': ('vector', 'shapefile'),
        '.geojson': ('vector', 'geojson'),
        '.json': ('vector', 'geojson'),
        '.gpkg': ('vector', 'geopackage'),
        
        # KML/KMZ
        '.kml': ('kml', 'kml'),
        '.kmz': ('kml', 'kmz'),
        
        # Point Cloud
        '.las': ('point_cloud', 'las'),
        '.laz': ('point_cloud', 'laz'),
        '.xyz': ('point_cloud', 'xyz'),
        '.ply': ('point_cloud', 'ply'),
        
        # 3D Models
        '.obj': ('3d_model', 'obj'),
        '.gltf': ('3d_model', 'gltf'),
        '.glb': ('3d_model', 'glb'),
        '.fbx': ('3d_model', 'fbx'),
        '.dae': ('3d_model', 'collada'),
        
        # CAD
        '.dwg': ('cad', 'dwg'),
        '.dxf': ('cad', 'dxf'),
    }
    
    @staticmethod
    def detect_file_type(file_path: str) -> Tuple[str, str]:
        """
        Detecta el tipo y formato de archivo basado en la extensión
        
        Returns:
            Tuple[layer_type, file_format]
        """
        ext = Path(file_path).suffix.lower()
        return FileProcessor.EXTENSION_MAP.get(ext, ('unknown', 'unknown'))
    
    @staticmethod
    def process_raster(file_path: str) -> Dict[str, Any]:
        """Procesa archivos raster (TIFF, GeoTIFF, etc.)"""
        try:
            import rasterio
            from rasterio.warp import calculate_default_transform, reproject, Resampling
            
            with rasterio.open(file_path) as src:
                # Información básica
                info = {
                    'width': src.width,
                    'height': src.height,
                    'count': src.count,
                    'dtype': str(src.dtypes[0]),
                    'crs': str(src.crs) if src.crs else None,
                    'bounds': src.bounds._asdict() if src.bounds else None,
                    'transform': list(src.transform)[:6] if src.transform else None,
                }
                
                # Calcular bounds en WGS84 para PostGIS
                if src.crs and src.bounds:
                    from rasterio.warp import transform_bounds
                    bounds_4326 = transform_bounds(src.crs, 'EPSG:4326', *src.bounds)
                    info['bounds_wgs84'] = {
                        'minx': bounds_4326[0],
                        'miny': bounds_4326[1],
                        'maxx': bounds_4326[2],
                        'maxy': bounds_4326[3]
                    }
                
                return info
                
        except Exception as e:
            return {'error': str(e)}
    
    @staticmethod
    def process_vector(file_path: str) -> Dict[str, Any]:
        """Procesa archivos vectoriales (SHP, GeoJSON, etc.)"""
        try:
            import fiona
            
            with fiona.open(file_path) as src:
                info = {
                    'crs': str(src.crs) if src.crs else None,
                    'bounds': src.bounds,
                    'schema': dict(src.schema),
                    'count': len(src),
                    'driver': src.driver
                }
                
                # Calcular bounds en WGS84
                if src.crs and src.bounds:
                    from fiona.transform import transform_bounds
                    bounds_4326 = transform_bounds(src.crs, 'EPSG:4326', *src.bounds)
                    info['bounds_wgs84'] = {
                        'minx': bounds_4326[0],
                        'miny': bounds_4326[1],
                        'maxx': bounds_4326[2],
                        'maxy': bounds_4326[3]
                    }
                
                return info
                
        except Exception as e:
            return {'error': str(e)}
    
    @staticmethod
    def process_kml(file_path: str) -> Dict[str, Any]:
        """Procesa archivos KML/KMZ"""
        try:
            from fastkml import kml
            import zipfile
            
            # Si es KMZ, extraer primero
            if file_path.lower().endswith('.kmz'):
                with zipfile.ZipFile(file_path, 'r') as kmz:
                    kml_files = [f for f in kmz.namelist() if f.lower().endswith('.kml')]
                    if kml_files:
                        kml_content = kmz.read(kml_files[0])
                    else:
                        return {'error': 'No KML file found in KMZ'}
            else:
                with open(file_path, 'rb') as f:
                    kml_content = f.read()
            
            k = kml.KML()
            k.from_string(kml_content)
            
            # Extraer información básica
            features = list(k.features())
            
            info = {
                'feature_count': len(features),
                'has_placemarks': any('Placemark' in str(type(f)) for f in features),
                'format': 'kmz' if file_path.lower().endswith('.kmz') else 'kml'
            }
            
            return info
            
        except Exception as e:
            print(f"ERROR: process_kml failed with fastkml: {e}")
            try:
                # Fallback: Basic parsing attempt
                if 'kml_content' in locals():
                    content_str = str(kml_content)
                    return {
                        'feature_count': content_str.count('<Placemark>'),
                        'has_placemarks': '<Placemark>' in content_str,
                        'format': 'kml',
                        'note': f'Metadata extracted via basic fallback due to: {str(e)}'
                    }
                else:
                    return {'error': str(e)} 
            except Exception as e2:
                return {'error': f"Processing failed: {str(e)}. Fallback failed: {str(e2)}"}
    
    @staticmethod
    def process_point_cloud(file_path: str) -> Dict[str, Any]:
        """Procesa archivos de nubes de puntos (LAS, LAZ)"""
        try:
            import laspy
            
            with laspy.open(file_path) as las_file:
                las = las_file.read()
                
                info = {
                    'point_count': len(las.points),
                    'point_format': las.point_format.id,
                    'version': f"{las.header.version.major}.{las.header.version.minor}",
                    'crs': str(las.header.parse_crs()) if hasattr(las.header, 'parse_crs') else None,
                    'bounds': {
                        'minx': float(las.header.x_min),
                        'miny': float(las.header.y_min),
                        'minz': float(las.header.z_min),
                        'maxx': float(las.header.x_max),
                        'maxy': float(las.header.y_max),
                        'maxz': float(las.header.z_max),
                    },
                    'has_color': 'red' in las.point_format.dimension_names,
                    'has_classification': 'classification' in las.point_format.dimension_names,
                }
                
                return info
                
        except Exception as e:
            return {'error': str(e)}
    
    @staticmethod
    def process_3d_model(file_path: str) -> Dict[str, Any]:
        """Procesa modelos 3D (OBJ, GLTF, etc.)"""
        try:
            file_size = os.path.getsize(file_path)
            ext = Path(file_path).suffix.lower()
            
            info = {
                'file_size': file_size,
                'format': ext[1:],  # Remove the dot
            }
            
            # Para OBJ, podemos extraer información básica
            if ext == '.obj':
                vertex_count = 0
                face_count = 0
                with open(file_path, 'r') as f:
                    for line in f:
                        if line.startswith('v '):
                            vertex_count += 1
                        elif line.startswith('f '):
                            face_count += 1
                
                info['vertex_count'] = vertex_count
                info['face_count'] = face_count
            
            return info
            
        except Exception as e:
            return {'error': str(e)}
    
    @staticmethod
    def process_cad(file_path: str) -> Dict[str, Any]:
        """Procesa archivos CAD (DWG, DXF)"""
        try:
            import ezdxf
            
            ext = Path(file_path).suffix.lower()
            
            if ext == '.dxf':
                doc = ezdxf.readfile(file_path)
                
                info = {
                    'format': 'dxf',
                    'version': doc.dxfversion,
                    'layer_count': len(doc.layers),
                    'entity_count': sum(1 for _ in doc.modelspace()),
                }
                
                return info
            else:
                # DWG requiere conversión o bibliotecas especiales
                return {
                    'format': 'dwg',
                    'note': 'DWG files require conversion to DXF for processing'
                }
                
        except Exception as e:
            return {'error': str(e)}
    
    @staticmethod
    def process_file(file_path: str) -> Dict[str, Any]:
        """
        Procesa cualquier archivo geoespacial y extrae metadatos
        
        Args:
            file_path: Ruta al archivo
            
        Returns:
            Diccionario con metadatos del archivo
        """
        layer_type, file_format = FileProcessor.detect_file_type(file_path)
        
        result = {
            'layer_type': layer_type,
            'file_format': file_format,
            'file_name': Path(file_path).name,
            'file_size': os.path.getsize(file_path) if os.path.exists(file_path) else 0,
        }
        
        # Procesar según el tipo
        if layer_type == 'raster':
            result['metadata'] = FileProcessor.process_raster(file_path)
        elif layer_type == 'vector':
            result['metadata'] = FileProcessor.process_vector(file_path)
        elif layer_type == 'kml':
            result['metadata'] = FileProcessor.process_kml(file_path)
        elif layer_type == 'point_cloud':
            result['metadata'] = FileProcessor.process_point_cloud(file_path)
        elif layer_type == '3d_model':
            result['metadata'] = FileProcessor.process_3d_model(file_path)
        elif layer_type == 'cad':
            result['metadata'] = FileProcessor.process_cad(file_path)
        else:
            result['metadata'] = {'error': 'Unsupported file type'}
        
        return result


# Instancia singleton
file_processor = FileProcessor()
