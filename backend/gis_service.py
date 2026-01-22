import os
import sys

# --- ENVIRONMENT FIX FOR PROJ ---
try:
    import pyproj
    os.environ['PROJ_LIB'] = pyproj.datadir.get_data_dir()
    os.environ['PROJ_DATA'] = pyproj.datadir.get_data_dir()
except Exception:
    pass

import rasterio
from fastkml import kml
from typing import Dict, Any
import os
import json
import zipfile
import tempfile
import shutil
from pathlib import Path

class GISService:
    """Clase para manejar operaciones GIS"""
    
    @staticmethod
    def get_raster_info(file_path: str) -> Dict[str, Any]:
        """
        Extrae información de un archivo raster (GeoTIFF)
        
        Args:
            file_path: Ruta al archivo raster
            
        Returns:
            Diccionario con metadatos del raster (CRS, dimensiones, límites, bandas)
        """
        with rasterio.open(file_path) as src:
            bounds = src.bounds
            crs = str(src.crs)
            
            # Transformar bounds a EPSG:4326 para que el frontend no tenga que adivinar
            # aunque el frontend tenga proj4, es más robusto enviarlo en WGS84
            # Transformar bounds a EPSG:4326
            from pyproj import Transformer
            
            wgs84_bounds = [bounds.left, bounds.bottom, bounds.right, bounds.top]
            if src.crs and src.crs.to_string() != 'EPSG:4326':
                print(f"DEBUG: Transformando CRS nativo: {src.crs.to_string()}")
                try:
                    # Estrategia 1: Usar WKT2 (el más moderno y robusto)
                    transformer = Transformer.from_crs(src.crs.to_wkt(), "EPSG:4326", always_xy=True)
                    lon1, lat1 = transformer.transform(bounds.left, bounds.bottom)
                    lon2, lat2 = transformer.transform(bounds.right, bounds.top)
                    wgs84_bounds = [lon1, lat1, lon2, lat2]
                    print("DEBUG: Transformación exitosa vía WKT")
                except Exception as e1:
                    print(f"DEBUG: Falló WKT ({e1}). Intentando con PROJ4...")
                    try:
                        # Estrategia 2: PROJ4 string
                        transformer = Transformer.from_crs(src.crs.to_proj4(), "EPSG:4326", always_xy=True)
                        lon1, lat1 = transformer.transform(bounds.left, bounds.bottom)
                        lon2, lat2 = transformer.transform(bounds.right, bounds.top)
                        wgs84_bounds = [lon1, lat1, lon2, lat2]
                        print("DEBUG: Transformación exitosa vía PROJ4")
                    except Exception as e2:
                        print(f"DEBUG: Falló PROJ4 ({e2}). Intentando con EPSG Code...")
                        try:
                            # Estrategia 3: Código EPSG directo
                            try:
                                epsg_code = src.crs.to_epsg()
                                if epsg_code:
                                    transformer = Transformer.from_crs(f"EPSG:{epsg_code}", "EPSG:4326", always_xy=True)
                                    lon1, lat1 = transformer.transform(bounds.left, bounds.bottom)
                                    lon2, lat2 = transformer.transform(bounds.right, bounds.top)
                                    wgs84_bounds = [lon1, lat1, lon2, lat2]
                                    print(f"DEBUG: Transformación exitosa vía EPSG:{epsg_code}")
                                else:
                                    print(f"DEBUG: El CRS no tiene código EPSG numérico (Local CRS detectado: {src.crs.to_string()})")
                            except Exception as inner_e:
                                print(f"DEBUG: Intento EPSG falló: {inner_e}")
                        except Exception as e3:
                             print(f"DEBUG: Fallo total de transformación para {file_path}. Usando bounds nativos como fallback. (Error: {e3})")

            return {
                "crs": crs,
                "width": src.width,
                "height": src.height,
                "bounds": wgs84_bounds, # Estos ya están en 4326
                "native_bounds": [bounds.left, bounds.bottom, bounds.right, bounds.top],
                "bands": src.count,
                "driver": src.driver
            }

    @staticmethod
    def process_kmz(file_path: str) -> Dict[str, Any]:
        """
        Procesa archivo KMZ (Wrapper de kml_to_geojson que maneja zips)
        """
        return GISService.kml_to_geojson(file_path)

    @staticmethod
    def get_3d_info(file_path: str) -> Dict[str, Any]:
        """
        Extrae metadatos básicos de archivos 3D (OBJ, GLTF, etc)
        """
        try:
            file_size = os.path.getsize(file_path)
            ext = os.path.splitext(file_path)[1].lower()
            return {
                "type": "3d_model",
                "format": ext,
                "size_bytes": file_size,
                "message": "Archivo 3D listo para visualización"
            }
        except Exception as e:
            return {"error": f"Error leyendo archivo 3D: {str(e)}"}

    @staticmethod
    def kml_to_geojson(file_path: str) -> Dict[str, Any]:
        """
        Convierte un archivo KML o KMZ a GeoJSON con máxima compatibilidad (Google Earth clone)
        Estrategia: Intenta FastKML -> Si falla, usa Regex Extremo para rescatar coordenadas.
        """
        try:
            print(f"\n--- INICIANDO PROCESAMIENTO KML: {os.path.basename(file_path)} ---")
            doc_bytes = b""
            
            # 1. Extracción de datos (manejar KML o KMZ)
            # Si el archivo es KMZ, lo descomprimimos
            if zipfile.is_zipfile(file_path):
                try:
                    with zipfile.ZipFile(file_path, 'r') as zip_ref:
                        # Extraer todo a la carpeta uploads (para texturas, modelos .dae, etc)
                        upload_dir = os.path.dirname(file_path)
                        for file_info in zip_ref.infolist():
                            # No extraer el KML principal aquí todavía, o extraerlo con cuidado
                            try:
                                zip_ref.extract(file_info, upload_dir)
                            except: pass
                        
                        # Buscar el KML principal
                        kml_file = next((f for f in zip_ref.namelist() if f.lower().endswith('.kml')), None)
                        if kml_file:
                             with zip_ref.open(kml_file) as kml_data:
                                doc_bytes = kml_data.read()
                                print(f"DEBUG: KML principal extraído de zip: {kml_file}")
                except Exception as ze:
                    print(f"DEBUG: Error abriendo ZIP/KMZ: {ze}")
            
            if not doc_bytes:
                # Si no era un zip o falló, leer como KML normal
                with open(file_path, 'rb') as f:
                    doc_bytes = f.read()

            if not doc_bytes or len(doc_bytes) < 10:
                print("DEBUG: Archivo vacío")
                return {"type": "FeatureCollection", "features": []}

            features = []

            # --- INTENTO 1: FASTKML ---
            try:
                k = kml.KML()
                k.from_string(doc_bytes)
                
                def deep_extract(item, depth=0):
                    if depth > 25: return
                    if hasattr(item, 'geometry') and item.geometry:
                        try:
                            gi = item.__geo_interface__
                            if gi.get('type') == 'Feature':
                                props = gi.get('properties', {})
                                props['name'] = getattr(item, 'name', 'Elemento')
                                props['description'] = getattr(item, 'description', '')
                                gi['properties'] = props
                                features.append(gi)
                        except: pass
                    
                    sub_items = []
                    for attr in ['features', '_features']:
                        if hasattr(item, attr):
                            val = getattr(item, attr)
                            res = val() if callable(val) else val
                            if res: sub_items = res ; break
                    for sub in sub_items: deep_extract(sub, depth + 1)

                deep_extract(k)
            except Exception as e:
                print(f"DEBUG: FastKML falló: {e}")

            # --- INTENTO 2: RESCATE QUIRÚRGICO (Regex Placemark-by-Placemark) ---
            if not features:
                print("DEBUG: Iniciando RESCATE QUIRÚRGICO (Geometría por Placemark)...")
                try:
                    import re
                    content = doc_bytes.decode('utf-8', errors='ignore')
                    
                    # 1. Limpiar namespaces para que el regex sea más simple
                    content = re.sub(r'\s+xmlns(:\w+)?=".*?"', '', content)
                    
                    # 2. Buscar bloques de Placemark
                    placemarks = re.findall(r'<Placemark(.*?)>(.*?)</Placemark>', content, re.DOTALL)
                    print(f"DEBUG: Encontrados {len(placemarks)} bloques de Placemark en el XML.")
                    
                    for i, (attr, body) in enumerate(placemarks):
                        # Extraer nombre
                        name_match = re.search(r'<name>(.*?)</name>', body, re.DOTALL)
                        name = name_match.group(1).strip() if name_match else f"Elemento {i+1}"
                        
                        # Extraer descripción
                        desc_match = re.search(r'<description>(.*?)</description>', body, re.DOTALL)
                        desc = desc_match.group(1).strip() if desc_match else ""
                        
                        # Extraer todas las coordenadas del bloque
                        coord_blocks = re.findall(r'<coordinates>(.*?)</coordinates>', body, re.DOTALL)
                        
                        for block in coord_blocks:
                            # Limpiar coordenadas (quitar espacios extra, tabs, etc)
                            raw_pts = block.strip().replace('\t', ' ').replace('\n', ' ').split()
                            pts = []
                            for p_str in raw_pts:
                                parts = p_str.split(',')
                                if len(parts) >= 2:
                                    try:
                                        lon = float(parts[0])
                                        lat = float(parts[1])
                                        # FILTRO CRÍTICO: Ignorar 0,0 que causa líneas locas
                                        if abs(lon) < 0.0001 and abs(lat) < 0.0001:
                                            continue
                                        pts.append([lon, lat])
                                    except: continue
                            
                            if not pts: continue
                            
                            # Crear feature según cantidad de puntos
                            if len(pts) == 1:
                                features.append({
                                    "type": "Feature",
                                    "properties": {"name": name, "description": desc, "layer": "KML RECOVERY"},
                                    "geometry": {"type": "Point", "coordinates": pts[0]}
                                })
                            else:
                                features.append({
                                    "type": "Feature",
                                    "properties": {"name": name, "description": desc, "layer": "KML RECOVERY"},
                                    "geometry": {"type": "LineString", "coordinates": pts}
                                })
                except Exception as re_err:
                    print(f"DEBUG: Error en rescate quirúrgico: {re_err}")

            print(f"RESULTADO FINAL: Se encontraron {len(features)} geometrías filtradas.")
            print(f"--- FIN PROCESAMIENTO KML ---\n")

            return {
                "type": "FeatureCollection",
                "features": features
            }
        except Exception as e:
            print(f"Error crítico en kml_to_geojson: {e}")
            return {"type": "FeatureCollection", "features": []}

# Instancia singleton del servicio
gis_service = GISService()
