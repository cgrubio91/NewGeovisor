"""
Módulo para análisis geográfico de registros de colaboradores desde MongoDB.
Integra datos con análisis de ubicación usando geocercas en formato KML/KMZ.
"""

import os
import pandas as pd
from datetime import datetime
from typing import List, Optional, Dict, Any
from pathlib import Path
from zipfile import ZipFile
from fastkml import kml
from shapely.geometry import Point, Polygon, MultiPolygon, shape
from shapely.geometry.base import BaseGeometry
from sshtunnel import SSHTunnelForwarder
from pymongo import MongoClient
import logging

logger = logging.getLogger(__name__)


class GeographicRecordsAnalyzer:
    """Analizador de registros geográficos con autenticación SSH y MongoDB."""
    
    def __init__(
        self,
        ssh_host: str,
        ssh_user: str,
        ssh_key_path: str,
        ssh_passphrase: str,
        mongo_port: int,
        db_name: str,
        kml_base_path: str = "uploads"
    ):
        """
        Inicializa el analizador.
        
        Args:
            ssh_host: IP/hostname del servidor SSH
            ssh_user: Usuario SSH
            ssh_key_path: Ruta a la clave privada SSH
            ssh_passphrase: Contraseña de la clave SSH
            mongo_port: Puerto MongoDB local en el servidor remoto (27017 típicamente)
            db_name: Nombre de la base de datos MongoDB
            kml_base_path: Ruta base para buscar archivos KML/KMZ
        """
        self.ssh_host = ssh_host
        self.ssh_user = ssh_user
        self.ssh_key_path = ssh_key_path
        self.ssh_passphrase = ssh_passphrase
        self.mongo_port = mongo_port
        self.db_name = db_name
        self.kml_base_path = kml_base_path
        
        # Cachés para evitar cargar polígonos múltiples veces
        self.cache_obra: Dict[str, Optional[Polygon]] = {}
        self.cache_oficina: Dict[str, Optional[Polygon]] = {}
    
    def cargar_poligono_geocerca(self, path: str) -> Optional[BaseGeometry]:
        """
        Carga y combina todos los polígonos desde un archivo KML o KMZ.
        
        Args:
            path: Ruta al archivo KML/KMZ
            
        Returns:
            shapely geometry (Polygon, MultiPolygon or any result of unary_union)
        """
        if not os.path.exists(path):
            logger.debug(f"Archivo no encontrado: {path}")
            return None
        
        try:
            if path.lower().endswith('.kmz'):
                with ZipFile(path, 'r') as z:
                    kml_files = [f for f in z.namelist() if f.lower().endswith('.kml')]
                    if not kml_files: return None
                    content = z.read(kml_files[0])
            else:
                with open(path, 'rb') as f:
                    content = f.read()
            
            k = kml.KML()
            k.from_string(content)
            
            features = list(k.features())
            if not features: return None
            placemarks = list(features[0].features())
            for p in placemarks:
                if hasattr(p, 'geometry') and hasattr(p.geometry, 'exterior'):
                    return Polygon(p.geometry.exterior.coords)
                elif hasattr(p, 'features'):
                    for sub_p in p.features():
                        if hasattr(sub_p.geometry, 'exterior'):
                            return Polygon(sub_p.geometry.exterior.coords)
            
            return None
        
        except Exception as e:
            logger.error(f"Error avanzado cargando geocerca {path}: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            return None
    
    def obtener_poligono_trabajo(self, pid: str) -> Optional[Polygon]:
        """
        Obtiene el polígono del área de obra para un proyecto.
        Busca en orden: {pid}.kml, {pid}.kmz
        """
        if pid not in self.cache_obra:
            # Construir rutas posibles
            ruta_kml = os.path.join(self.kml_base_path, f"{pid}.kml")
            ruta_kmz = os.path.join(self.kml_base_path, f"{pid}.kmz")
            
            # Intentar cargar en orden
            poligono = self.cargar_poligono_geocerca(ruta_kml)
            if poligono is None:
                poligono = self.cargar_poligono_geocerca(ruta_kmz)
            
            self.cache_obra[pid] = poligono
        
        return self.cache_obra[pid]
    
    def obtener_poligono_oficina(self, pid: str) -> Optional[Polygon]:
        """
        Obtiene el polígono del área de oficina para un proyecto.
        Busca en orden: {pid}_oficina.kml, {pid}_oficina.kmz
        """
        if pid not in self.cache_oficina:
            # Construir rutas posibles
            ruta_kml = os.path.join(self.kml_base_path, f"{pid}_oficina.kml")
            ruta_kmz = os.path.join(self.kml_base_path, f"{pid}_oficina.kmz")
            
            # Intentar cargar en orden
            poligono = self.cargar_poligono_geocerca(ruta_kml)
            if poligono is None:
                poligono = self.cargar_poligono_geocerca(ruta_kmz)
            
            self.cache_oficina[pid] = poligono
        
        return self.cache_oficina[pid]
    
    def clasificar_ubicacion(self, pid: str, lat: float, lon: float, p_obra_override: Optional[BaseGeometry] = None, p_ofi_override: Optional[BaseGeometry] = None) -> str:
        """
        Clasifica la ubicación de un punto dentro de los polígonos del proyecto.
        
        Args:
            pid: ID del proyecto
            lat: Latitud en WGS84
            lon: Longitud en WGS84
            p_obra_override: Polígono de obra pasado explícitamente
            p_ofi_override: Polígono de oficina pasado explícitamente
            
        Returns:
            "EN OBRA", "EN OFICINA", o "UBICACIÓN EXTERNA"
        """
        # El sistema usa (lat, lon) usualmente, Point de shapely es (x, y) = (lon, lat) para GeoJSON
        # pero revisando el script del usuario, él usa Point(lon, lat).
        punto = Point(lon, lat)
        
        # 1. Verificar polígono de obra (Prioridad: override -> file)
        p_obra = p_obra_override or self.obtener_poligono_trabajo(pid)
        if p_obra and (p_obra.contains(punto) or p_obra.intersects(punto)):
            return "EN OBRA"
        
        # 2. Verificar polígono de oficina (Prioridad: override -> file)
        p_ofi = p_ofi_override or self.obtener_poligono_oficina(pid)
        if p_ofi and (p_ofi.contains(punto) or p_ofi.intersects(punto)):
            return "EN OFICINA"
        
        return "UBICACIÓN EXTERNA"
    
    def generar_reporte(
        self,
        fecha_inicio: datetime,
        fecha_fin: datetime,
        pid_filtro: Optional[str] = None,
        user_filtro: Optional[str] = None,
        nombre_proyecto_filtro: Optional[str] = None,
        p_obra_explicit: Optional[BaseGeometry] = None,
        p_ofi_explicit: Optional[BaseGeometry] = None
    ) -> pd.DataFrame:
        """
        Genera un reporte de registros geográficos con clasificación de ubicación.
        
        Args:
            fecha_inicio: Fecha inicial (inclusive)
            fecha_fin: Fecha final (inclusive, se ajusta a 23:59:59)
            pid_filtro: ID del proyecto (opcional, filtra a un solo proyecto)
            user_filtro: Email del usuario (opcional, filtra a un solo usuario)
            nombre_proyecto_filtro: Nombre del proyecto (opcional, filtra por nombre)
            
        Returns:
            DataFrame con los registros procesados
        """
        # Ajustar fecha_fin al último segundo del día si es necesario
        if fecha_fin.hour == 0 and fecha_fin.minute == 0:
            fecha_fin = fecha_fin.replace(hour=23, minute=59, second=59)
        
        logger.info(f"Iniciando generación de reporte: {fecha_inicio} - {fecha_fin}")
        
        # Construir el match filter
        # NOTA: El campo de fecha en MongoDB es "cre" (creation timestamp, NO "cte")
        match_filter = {
            "cre": {
                "$gte": fecha_inicio,
                "$lte": fecha_fin
            }
        }
        
        if pid_filtro:
            if isinstance(pid_filtro, list):
                match_filter["pid"] = {"$in": pid_filtro}
            else:
                match_filter["pid"] = pid_filtro
        
        if user_filtro:
            match_filter["user"] = user_filtro
        
        # Pipeline de agregación MongoDB
        pipeline = [
            # 1. Filtrar por fecha y otros criterios
            {"$match": match_filter},
            
            # 2. Convertir pid a ObjectId para el join con projects
            {"$addFields": {"pid_oid": {"$toObjectId": "$pid"}}},
            
            # 3. Join con la colección Projects
            {
                "$lookup": {
                    "from": "projects",
                    "localField": "pid_oid",
                    "foreignField": "_id",
                    "as": "info_proy"
                }
            },
            {"$unwind": "$info_proy"},
            
            # Filtrar por nombre de proyecto si se proporciona
            *([
                {"$match": {"info_proy.name": {"$regex": nombre_proyecto_filtro, "$options": "i"}}}
            ] if nombre_proyecto_filtro else []),
            
            # 4. Join con la colección Users
            {
                "$lookup": {
                    "from": "users",
                    "localField": "user",
                    "foreignField": "email",
                    "as": "info_user"
                }
            },
            {"$unwind": {"path": "$info_user", "preserveNullAndEmptyArrays": True}},
            
            # 5. Proyectar campos finales
            {
                "$project": {
                    "name_project": "$info_proy.name",
                    "pid": 1,
                    "_id": 1,
                    "user_email": "$user",
                    "display_name": "$info_user.displayName",
                    "cargo": {"$arrayElemAt": ["$info_user.organizations.title", 0]},
                    "fecha": "$cre",
                    "codigo": 1,
                    "coords": 1
                }
            }
        ]
        
        results = []
        
        # Conectar a MongoDB a través del túnel SSH
        try:
            with SSHTunnelForwarder(
                (self.ssh_host, 22),
                ssh_username=self.ssh_user,
                ssh_pkey=self.ssh_key_path,
                ssh_private_key_password=self.ssh_passphrase.encode() 
                    if isinstance(self.ssh_passphrase, str) else self.ssh_passphrase,
                remote_bind_address=('127.0.0.1', self.mongo_port),
                set_keepalive=30.0
            ) as server:
                logger.info("✅ Túnel SSH establecido")
                
                client = MongoClient(
                    '127.0.0.1',
                    server.local_bind_port,
                    connectTimeoutMS=30000,
                    serverSelectionTimeoutMS=30000
                )
                db = client[self.db_name]
                
                logger.info("🔍 Consultando base de datos...")
                records_data = list(db.records.aggregate(pipeline))
                logger.info(f"📍 Procesando {len(records_data)} registros...")
                
                # Procesar cada registro
                for doc in records_data:
                    pid = str(doc.get('pid'))
                    id_reg = str(doc.get('_id'))
                    coord_list = doc.get('coords', [])
                    
                    # Validaciones
                    if not coord_list or len(coord_list) == 0:
                        logger.debug(f"Registro {id_reg} sin coordenadas, omitido")
                        continue
                    
                    lat = coord_list[0].get('latitud')
                    lon = coord_list[0].get('longitud')
                    
                    if lat is None or lon is None:
                        logger.debug(f"Registro {id_reg} con coordenadas inválidas, omitido")
                        continue
                    
                    # Clasificar ubicación pasándole los polígonos explícitos si existen
                    status = self.clasificar_ubicacion(pid, lat, lon, p_obra_explicit, p_ofi_explicit)
                    
                    # Agregar al resultado
                    results.append({
                        "id": id_reg,
                        "project_id": pid,
                        "Proyecto": doc.get('name_project', 'N/A'),
                        "Colaborador": doc.get('display_name') or doc.get('user_email', 'N/A'),
                        "Cargo": doc.get('cargo') or "No definido",
                        "Correo": doc.get('user_email', ''),
                        "Fecha del registro": pd.to_datetime(doc.get('fecha')).tz_localize(None),
                        "Formato": doc.get('codigo', ''),
                        "Norte (Lat)": lat,
                        "Este (Lon)": lon,
                        "Coordenadas_Google": f"{lat}, {lon}",
                        "Clasificación": status,
                        "URL Registro": f"https://segmab.com/i40/home#!/proyecto/{pid}/registro/{id_reg}"
                    })
                
                client.close()
        
        except Exception as e:
            logger.error(f"Error conectando a MongoDB: {str(e)}")
            raise
        
        # Crear DataFrame
        if results:
            df = pd.DataFrame(results)
            logger.info(f"✅ Reporte generado con {len(df)} registros")
            return df
        else:
            logger.warning("❌ No se encontraron datos para procesar")
            return pd.DataFrame()
    
    def exportar_a_excel(
        self,
        df: pd.DataFrame,
        output_path: str
    ) -> str:
        """
        Exporta el DataFrame a un archivo Excel.
        
        Args:
            df: DataFrame con los registros
            output_path: Ruta donde guardar el archivo
            
        Returns:
            Ruta al archivo creado
        """
        os.makedirs(os.path.dirname(output_path) if os.path.dirname(output_path) else '.', exist_ok=True)
        df.to_excel(output_path, index=False, sheet_name='Registros')
        logger.info(f"✅ Archivo Excel guardado: {output_path}")
        return output_path
    
    def exportar_a_kml(self, df: pd.DataFrame, output_path: str) -> str:
        """
        Exporta el DataFrame a un archivo KML con estilos de colores basados en la clasificación.
        
        Args:
            df: DataFrame con los registros
            output_path: Ruta donde guardar el archivo KML
            
        Returns:
            Ruta al archivo KML creado
        """
        import codecs
        os.makedirs(os.path.dirname(output_path) if os.path.dirname(output_path) else '.', exist_ok=True)
        
        kml_content = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<kml xmlns="http://www.opengis.net/kml/2.2">',
            '  <Document>',
            '    <name>Reporte de Registros SEGMAB</name>',
            '    <Style id="style-obra">',
            '      <IconStyle>',
            '        <color>ff00ff00</color> <!-- Verde -->',
            '        <scale>1.2</scale>',
            '        <Icon><href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon>',
            '      </IconStyle>',
            '    </Style>',
            '    <Style id="style-oficina">',
            '      <IconStyle>',
            '        <color>ff00ffff</color> <!-- Amarillo -->',
            '        <scale>1.2</scale>',
            '        <Icon><href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon>',
            '      </IconStyle>',
            '    </Style>',
            '    <Style id="style-externa">',
            '      <IconStyle>',
            '        <color>ff0000ff</color> <!-- Rojo -->',
            '        <scale>1.2</scale>',
            '        <Icon><href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon>',
            '      </IconStyle>',
            '    </Style>'
        ]
        
        for _, row in df.iterrows():
            clasif = str(row.get('Clasificación', 'UBICACIÓN EXTERNA')).upper()
            if 'OBRA' in clasif:
                style_id = '#style-obra'
            elif 'OFICINA' in clasif:
                style_id = '#style-oficina'
            else:
                style_id = '#style-externa'
                
            lat = row.get('Norte (Lat)')
            lon = row.get('Este (Lon)')
            if pd.isna(lat) or pd.isna(lon):
                continue
                
            name = f"{row.get('Fecha del registro', 'Sin fecha')} - {row.get('Colaborador', 'Desconocido')}"
            desc = f"""<![CDATA[
            <b>Proyecto:</b> {row.get('Proyecto', 'N/A')}<br>
            <b>Colaborador:</b> {row.get('Colaborador', 'N/A')}<br>
            <b>Cargo:</b> {row.get('Cargo', 'N/A')}<br>
            <b>Correo:</b> {row.get('Correo', 'N/A')}<br>
            <b>Fecha:</b> {row.get('Fecha del registro', 'N/A')}<br>
            <b>Formato:</b> {row.get('Formato', 'N/A')}<br>
            <b>Clasificación:</b> {clasif}<br>
            <br>
            <a href="{row.get('URL Registro', '#')}">Ver registro en SEGMAB</a>
            ]]>"""
            
            kml_content.extend([
                '    <Placemark>',
                f'      <name><![CDATA[{name}]]></name>',
                f'      <description>{desc}</description>',
                f'      <styleUrl>{style_id}</styleUrl>',
                '      <Point>',
                f'        <coordinates>{lon},{lat},0</coordinates>',
                '      </Point>',
                '    </Placemark>'
            ])
            
        kml_content.extend(['  </Document>', '</kml>'])
        
        with codecs.open(output_path, 'w', encoding='utf-8') as f:
            f.write('\\n'.join(kml_content))
            
        logger.info(f"✅ Archivo KML guardado: {output_path}")
        return output_path
    
    def limpiar_cache(self):
        """Limpia los cachés de polígonos en memoria."""
        self.cache_obra.clear()
        self.cache_oficina.clear()
        logger.info("Cache de geocercas limpiado")
    
    def obtener_proyectos_mongodb(self) -> List[Dict[str, Any]]:
        """
        Obtiene la lista de todos los proyectos desde MongoDB.
        """
        try:
            with SSHTunnelForwarder(
                (self.ssh_host, 22),
                ssh_username=self.ssh_user,
                ssh_pkey=self.ssh_key_path,
                ssh_private_key_password=self.ssh_passphrase.encode() 
                    if isinstance(self.ssh_passphrase, str) else self.ssh_passphrase,
                remote_bind_address=('127.0.0.1', self.mongo_port),
                set_keepalive=30.0
            ) as server:
                client = MongoClient('127.0.0.1', server.local_bind_port)
                db = client[self.db_name]
                
                projects = list(db.projects.find({}, {"name": 1, "description": 1, "owner": 1, "users": 1}))
                for p in projects:
                    p["_id"] = str(p["_id"])
                
                client.close()
                return projects
        except Exception as e:
            logger.error(f"Error obteniendo proyectos de MongoDB: {str(e)}")
            return []

    def obtener_usuarios_y_proyectos(self) -> List[Dict[str, Any]]:
        """
        Obtiene usuarios y sus relaciones con proyectos desde MongoDB.
        Esta lógica depende de cómo Segmab almacene los permisos. 
        Asumiendo esquema estándar donde el usuario tiene 'projects' (IDs).
        """
        try:
            with SSHTunnelForwarder(
                (self.ssh_host, 22),
                ssh_username=self.ssh_user,
                ssh_pkey=self.ssh_key_path,
                ssh_private_key_password=self.ssh_passphrase.encode() 
                    if isinstance(self.ssh_passphrase, str) else self.ssh_passphrase,
                remote_bind_address=('127.0.0.1', self.mongo_port),
                set_keepalive=30.0
            ) as server:
                client = MongoClient('127.0.0.1', server.local_bind_port)
                db = client[self.db_name]
                
                # Obtener usuarios con sus campos básicos y lista de proyectos
                users = list(db.users.find({}, {
                    "email": 1, 
                    "displayName": 1, 
                    "organizations": 1,
                    "projects": 1  
                }))
                
                for u in users:
                    u["_id"] = str(u["_id"])
                    if "projects" in u and isinstance(u["projects"], list):
                        u["projects"] = [str(pid) for pid in u["projects"]]
                
                client.close()
                return users
        except Exception as e:
            logger.error(f"Error obteniendo usuarios de MongoDB: {str(e)}")
            return []


def crear_analizador_desde_env(kml_base_path: str = "uploads") -> GeographicRecordsAnalyzer:
    """
    Factory para crear un GeographicRecordsAnalyzer usando variables de entorno.
    
    Args:
        kml_base_path: Ruta base para archivos KML/KMZ
        
    Returns:
        GeographicRecordsAnalyzer configurado
    """
    return GeographicRecordsAnalyzer(
        ssh_host=os.getenv("SSH_HOST"),
        ssh_user=os.getenv("SSH_USER"),
        ssh_key_path=os.getenv("SSH_KEY_PATH"),
        ssh_passphrase=os.getenv("SSH_PASSPHRASE"),
        mongo_port=int(os.getenv("MONGO_PORT", 27017)),
        db_name=os.getenv("DB_NAME"),
        kml_base_path=kml_base_path
    )
