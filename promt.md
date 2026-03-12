# Sistema de Control de Registros con Análisis Geográfico

## 🏢 Nombre del Sistema
**Control Registros SEGMAB** - Sistema de auditoría y análisis geográfico de registros de colaboradores

## 📋 Descripción General

Sistema completo para procesar, clasificar e integrar registros de colaboradores con análisis geográfico. Conecta a base de datos MongoDB mediante túnel SSH seguro, clasifica automáticamente registros por ubicación (obra, oficina, externa) utilizando geocercas en formato KML/KMZ, y genera reportes multiformato (Excel, KML, JSON).

**Propósito principal**: Auditar presencia de colaboradores, validar patrones de ubicación y generar reportes de conformidad geográfica.

---

## 🔌 Arquitectura Técnica

### Componentes Principales

```
┌─────────────────────────────────────────────┐
│         Geovisor (Sistema Externo)          │
└────────────────┬────────────────────────────┘
                 │
        ┌────────▼─────────┐
        │  API/Interfaz    │
        │ (Por crear)      │
        └────────┬─────────┘
                 │
    ┌────────────┴────────────────┐
    │                             │
┌───▼──────────────┐   ┌──────────▼────┐
│  main.py         │   │ exportar_kml.py│
│ (Reporte Global) │   │(Reporte x PID) │
└───┬──────────────┘   └──────────┬─────┘
    │                             │
    └──────────────┬──────────────┘
                   │
        ┌──────────▼──────────┐
        │ Conexión MongoDB    │
        │ (SSH Tunnel)        │
        └──────────┬──────────┘
                   │
        ┌──────────▼──────────┐
        │  MongoDB (Remoto)   │
        │ - records           │
        │ - projects          │
        │ - users             │
        └─────────────────────┘
```

---

## 🗄️ Base de Datos

### Colecciones Utilizadas

#### **records**
- `_id`: ObjectId (identificador único)
- `pid`: String (Project ID)
- `user`: String (email del colaborador)
- `cre`: DateTime (fecha de creación del registro)
- `codigo`: String (tipo de formato utilizado)
- `coords`: Array de objetos
  - `latitud`: Float (WGS84)
  - `longitud`: Float (WGS84)

#### **projects**
- `_id`: ObjectId
- `name`: String (nombre del proyecto)
- Otros campos de metadatos

#### **users**
- `email`: String (clave primaria para lookups)
- `displayName`: String (nombre completo)
- `organizations`: Array
  - `title`: String (puesto/cargo)

### Relaciones
```
records.pid ──(string)──> projects._id
records.user ──(email)──> users.email
```

---

## 📂 Estructura de Archivos

```
control_registros/
├── main.py                          # Reporte global (todas las órdenes)
├── exportar_kml.py                  # Reporte por proyecto específico
├── .env                             # Variables de entorno (ignorado en git)
├── requirements.txt                 # Dependencias Python
├── projects.json                    # Metadatos de proyectos
├── redords.json                     # Caché de registros
├── README.md                        # Documentación
├── kml_proyectos/                   # Geocercas (KML/KMZ)
│   ├── {pid}.kml                    # Polígono de la obra
│   ├── {pid}_oficina.kml            # Polígono de la oficina
│   └── ...
├── report/                          # Carpeta de salida
│   ├── Reporte.xlsx                 # Reporte global (main.py)
│   ├── {nombre_proyecto}_{fecha}/   # Reportes por proyecto
│   │   ├── Reporte_Auditoria.xlsx
│   │   └── Mapa_Auditoria.kml
│   └── ...
└── .venv/                           # Entorno virtual Python
```

---

## 🔑 Configuración Requerida

### Variables de Entorno (.env)

```bash
# Conexión SSH
SSH_HOST=<dirección_del_servidor>
SSH_USER=<usuario_ssh>
SSH_KEY_PATH=/ruta/absoluta/a/clave_privada
SSH_PASSPHRASE=<contraseña_de_la_clave>

# Conexión MongoDB
MONGO_PORT=27017
DB_NAME=<nombre_base_datos>

# Opcional
LOG_LEVEL=INFO
```

### Dependencias Python

```
pymongo==4.6.1          # Gestión de base de datos MongoDB
pandas==2.2.0           # Procesamiento de datos tabulares
openpyxl==3.1.2         # Escritura de archivos Excel
fastkml==0.12           # Lectura de archivos KML/KMZ
shapely==2.0.2          # Análisis de geometría (puntos en polígonos)
lxml==5.1.0             # Procesamiento XML/KML
python-dotenv==1.0.1    # Carga de variables de entorno
sshtunnel==0.4.0        # Túnel SSH seguro
paramiko==3.3.1         # Librería SSH (dependencia de sshtunnel)
pyOpenSSL==23.3.0       # OpenSSL para Python
cryptography==41.0.7    # Criptografía (dependencia de paramiko)
pyarrow>=15.0.0         # Formato de datos eficiente
simplekml==1.3.5        # Generación de archivos KML
```

---

## 🎯 Modo 1: Reporte Global (main.py)

### Entrada del Usuario

```
📅 Ingresa el rango de fechas para el reporte
Formato: YYYY-MM-DD (ej: 2026-03-01)

Fecha inicial: 2026-01-01
Fecha final: 2026-03-31
```

### Proceso

1. **Obtener fechas**: Validar formato y que fin >= inicio
2. **Conectar MongoDB**:
   - Establecer túnel SSH
   - Crear cliente MongoDB en puerto local
3. **Ejecutar pipeline de agregación**:
   ```javascript
   [{
     $match: { cre: { $gte: fecha_inicio, $lte: fecha_fin } }
   },
   {
     $addFields: { pid_oid: { $toObjectId: "$pid" } }
   },
   {
     $lookup: {
       from: "projects",
       localField: "pid_oid",
       foreignField: "_id",
       as: "info_proy"
     }
   },
   {
     $unwind: "$info_proy"
   },
   {
     $lookup: {
       from: "users",
       localField: "user",
       foreignField: "email",
       as: "info_user"
     }
   },
   {
     $unwind: { path: "$info_user", preserveNullAndEmptyArrays: true }
   },
   {
     $project: {
       name_project: "$info_proy.name",
       pid: 1,
       _id: 1,
       user_email: "$user",
       display_name: "$info_user.displayName",
       cargo: { $arrayElemAt: ["$info_user.organizations.title", 0] },
       fecha: "$cre",
       codigo: 1,
       coords: 1
     }
   }]
   ```

4. **Procesar registros**:
   - Para cada registro validar que tiene coordenadas
   - Cargar geocercas (obra y oficina) desde archivos KML
   - Comprobar si punto está dentro de polígono (Shapely)
   - Clasificar ubicación

5. **Generar DataFrame**:
   - Crear tabla con columnas estándar
   - Aplicar transformaciones de formato

6. **Exportar**:
   - Guardar en `report/Reporte.xlsx`

### Salida

**Archivo**: `report/Reporte.xlsx`

**Columnas**:
| Columna | Tipo | Descripción |
|---------|------|-------------|
| Proyecto | String | Nombre del proyecto |
| Colaborador | String | displayName o email |
| Cargo | String | Puesto del usuario |
| Correo | String | Email del usuario |
| Fecha del registro | DateTime | Fecha de creación |
| Formato | String | Código del tipo de registro |
| Norte (Lat) | Float | Latitud en WGS84 |
| Este (Lon) | Float | Longitud en WGS84 |
| Coordenadas_Google | String | "Lat, Lon" para Google Maps |
| Clasificación | String | "EN OBRA", "EN OFICINA", "UBICACIÓN EXTERNA" |
| URL Registro | String | Link directo a SEGMAB |

---

## 🎯 Modo 2: Reporte por Proyecto (exportar_kml.py)

### Entrada del Usuario

```
🌍 GENERADOR DE REPORTES SEGMAB
🔹 Ingrese el PID del proyecto: 5f231f11682b965f9889826c

📅 Rango de fechas (AAAA-MM-DD)
Fecha inicial: 2026-01-01
Fecha final: 2026-03-31
```

### Proceso

1. **Validar proyecto**:
   - Consultar MongoDB por `projects._id`
   - Retornar error si no existe

2. **Generar estructura de carpeta**:
   ```
   report/{nombre_proyecto}_{YYYY-MM-DD_a_YYYY-MM-DD}/
   ```

3. **Ejecutar pipeline filtrado**:
   - Igual a Modo 1, pero agregar filtro: `pid: pid_input`

4. **Procesar registros**:
   - Cargar geocercas asociadas al proyecto
   - Clasificar por ubicación
   - Generar puntos KML con descripciones HTML

5. **Exportar**:
   - Excel: `Reporte_Auditoria.xlsx`
   - KML: `Mapa_Auditoria.kml` (compatible Google Earth, ArcGIS, Geovisor)

### Salida

**Carpeta**: `report/{nombre_proyecto}_{fecha_inicio}_a_{fecha_fin}/`

**Archivos**:
- `Reporte_Auditoria.xlsx` - Tabla de registros
- `Mapa_Auditoria.kml` - Mapa interactivo con marcadores

**Estructura KML**:
```xml
<kml>
  <Document>
    <Placemark>
      <name>CODIGO | FECHA</name>
      <coordinates>lon,lat,0</coordinates>
      <description>
        Colaborador: nombre
        Cargo: puesto
        Status: EN OBRA (o EN OFICINA, o UBICACIÓN EXTERNA)
      </description>
    </Placemark>
    ...
  </Document>
</kml>
```

---

## 📍 Algoritmo de Análisis Geográfico

### Clasificación de Registros

Para cada registro:

1. **Obtener coordenadas**:
   ```python
   lat, lon = coords[0]['latitud'], coords[0]['longitud']
   punto = Point(lon, lat)
   ```

2. **Cargar geocercas** (con caché):
   ```python
   poly_obra = cargar_poligono_geocerca(f"kml_proyectos/{pid}.kml")
   poly_oficina = cargar_poligono_geocerca(f"kml_proyectos/{pid}_oficina.kml")
   ```

3. **Determinar ubicación**:
   ```python
   if poly_obra and poly_obra.contains(punto):
       clasificacion = "EN OBRA"
   elif poly_oficina and poly_oficina.contains(punto):
       clasificacion = "EN OFICINA"
   else:
       clasificacion = "UBICACIÓN EXTERNA"
   ```

### Función: cargar_poligono_geocerca(path)

**Entrada**: Path a archivo KML o KMZ

**Proceso**:
1. Comprobar existencia del archivo
2. Si es KMZ (ZIP):
   - Descomprimir
   - Encontrar archivo KML interno
3. Parsear KML usando `fastkml`
4. Extraer primer polígono encontrado
5. Convertir a `Shapely Polygon`

**Salida**: 
- `Polygon` si es válido
- `None` si no existe o no es válido

**Manejo de errores**: Silencioso (retorna None sin excepción)

---

## 🔄 Flujo de Integración con Geovisor

### Arquitectura de Integración Propuesta

**Opción 1: API REST**
```
Geovisor → POST /api/registros/generar
  └─ Parámetros: pid, fecha_inicio, fecha_fin
     └─ Retorna: URL a archivo, datos JSON, embedding KML
```

**Opción 2: Librería Python**
```python
from control_registros import ControlRegistrosAPI

api = ControlRegistrosAPI(config)
datos = api.obtener_registros(
    fecha_inicio="2026-01-01",
    fecha_fin="2026-03-31",
    pid="5f231f11682b965f9889826c"
)
# Retorna: {registros, geojson, kml}
```

**Opción 3: Función Webhook**
```
Geovisor → Trigger evento
  └─ Ejecuta: python exportar_kml.py (o main.py)
     └─ Genera archivos automáticamente
        └─ Geovisor: Consulta carpeta `/report/`
```

### Datos Intercambiables

**Formato JSON**:
```json
{
  "proyecto": "Proyecto X",
  "fecha_inicio": "2026-01-01",
  "fecha_fin": "2026-03-31",
  "registros": [
    {
      "id": "507f1f77bcf86cd799439011",
      "colaborador": "Juan García",
      "cargo": "Ingeniero de Proyectos",
      "lat": 4.7110,
      "lon": -74.0088,
      "clasificacion": "EN OBRA",
      "fecha": "2026-03-11T14:32:00",
      "url": "https://segmab.com/i40/home#!/proyecto/.../registro/..."
    },
    ...
  ],
  "estadisticas": {
    "total": 245,
    "en_obra": 180,
    "en_oficina": 45,
    "ubicacion_externa": 20
  }
}
```

**Formato GeoJSON** (para visualización en mapas):
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "id": "507f1f77bcf86cd799439011",
        "colaborador": "Juan García",
        "clasificacion": "EN OBRA"
      },
      "geometry": {
        "type": "Point",
        "coordinates": [-74.0088, 4.7110]
      }
    },
    ...
  ]
}
```

---

## 📊 Casos de Uso

### 1. Auditoría de Presencia
- **Objetivo**: Verificar dónde estaban los colaboradores en un período
- **Entrada**: Rango de fechas
- **Salida**: Reporte global con clasificación de ubicaciones
- **Acción Geovisor**: Cargar Excel, filtrar por clasificación

### 2. Análisis de Eficiencia Operativa
- **Objetivo**: Identificar patrones de trabajo en obra vs. oficina
- **Entrada**: Proyecto específico, período largo (3-6 meses)
- **Salida**: KML con mapa de calor de actividades
- **Acción Geovisor**: Visualizar densidad de registros en obra

### 3. Reportería para Looker Studio
- **Objetivo**: Alimentar dashboards de monitoreo
- **Entrada**: Registros actuales, rango flexible
- **Salida**: Excel con estructura estándar
- **Acción Geovisor**: Importar DataFrame a BI

### 4. Exportación para CRM/ERP
- **Objetivo**: Sincronizar datos de asistencia con otros sistemas
- **Entrada**: Registros filtrados
- **Salida**: JSON estructurado, compatible APIs externas
- **Acción Geovisor**: Enviar POST a endpoints de integración

### 5. Validación de Conformidad
- **Objetivo**: Asegurar que registros están asociados a ubicaciones válidas
- **Entrada**: Proyecto con geocercas definidas
- **Salida**: Reporte de "UBICACIÓN EXTERNA" para auditoría
- **Acción Geovisor**: Alertas automáticas, escalamiento de incidencias

---

## ⚙️ Parámetros de Configuración

### Sistema
| Parámetro | Valor | Descripción |
|-----------|-------|-------------|
| Formato de fecha | YYYY-MM-DD | ISO 8601 sin hora |
| Zona horaria | UTC (almacenada) | Conversión a local en reportes |
| Coordenadas | WGS84 (EPSG:4326) | Sistema global de referencia |
| CRS KML | WGS84 | Estándar de Google Earth |
| Encoding salida | UTF-8 | Soporta caracteres acentuados |

### Rendimiento
| Parámetro | Valor | Objetivo |
|-----------|-------|----------|
| Caché de geocercas | En memoria | Reutilizar polígonos en bucle |
| Túnel SSH | `set_keepalive=30s` | Mantener sesión activa |
| Timeout MongoDB | 30s | Evitar cuelgues |
| Batch de registros | 10000 | Limitar uso de memoria |

---

## 🔐 Seguridad

### Autenticación
- **SSH**: Clave privada con passphrase
- **MongoDB**: Controlado por servidor remoto
- **Variables**: Almacenadas en `.env` (nunca en git)

### Validación de Entrada
- Formatos de fecha estrictos
- Validación de PID vs base de datos
- Verificación de existencia de archivos KML

### Manejo de Errores
- Conexión SSH: Reintentos con timeout
- Archivos KML: Fallback silencioso (None)
- Coordenadas inválidas: Omisión del registro
- Base de datos vacía: Mensaje claro al usuario

---

## 📈 Extensiones Futuras

1. **API REST**: Crear endpoint `/api/registros/` para consultas remotas
2. **WebSocket**: Stream de eventos en tiempo real
3. **Caché distribuida**: Redis para caché de geocercas
4. **Análisis predictivo**: ML para patrones de ubicación
5. **Sincronización automática**: Webhooks desde SEGMAB
6. **Soporte multi-idioma**: Traducción de etiquetas de salida
7. **Auditoría de logs**: Registro de quién generó cada reporte
8. **Validación de calidad**: Chequeos automáticos de consistencia

---

## 📞 Interfaz de Usuario (CLI)

### Menú Principal
```
╔════════════════════════════════════════╗
║  SISTEMA DE CONTROL DE REGISTROS      ║
║  SEGMAB - Auditoría Geográfica        ║
╚════════════════════════════════════════╝

1. 📊 Generar Reporte Global
   → Todos los registros en un rango de fechas
   → Salida: Reporte.xlsx

2. 🗺️  Generar Reporte por Proyecto
   → Registros de un proyecto específico
   → Salida: Excel + Mapa KML

3. ⚙️  Configuración y Validación
   → Verificar conexión a MongoDB
   → Comprobar archivos KML
   → Validar credenciales SSH

4. 📤 Exportar a Formato Externo
   → Generar JSON para APIs
   → Crear GeoJSON para mapas
   → CSV para importación Excel

5. 🔄 Sincronizar con Geovisor
   → Enviar datos a otro sistema
   → Importar configuración del Geovisor

Q. Salir

Seleccione opción:
```

---

## 📝 Comandos de Ejecución

### Desarrollo
```bash
# Activar entorno
source .venv/bin/activate  # Linux/Mac
.\.venv\Scripts\Activate.ps1  # Windows PowerShell

# Instalar dependencias
pip install -r requirements.txt

# Ejecutar modo 1 (reporte global)
python main.py

# Ejecutar modo 2 (reporte por proyecto)
python exportar_kml.py

# Ejecutar pruebas
python test_db_connection.py
```

### Producción
```bash
# Con cron/tarea programada
0 2 * * * cd /path/to/control_registros && python main.py >> log.txt

# O con integración Geovisor
curl -X POST http://geovisor.local/api/trigger-report \
  -H "Content-Type: application/json" \
  -d '{
    "tipo": "global",
    "fecha_inicio": "2026-01-01",
    "fecha_fin": "2026-03-31"
  }'
```

---

## 🎓 Guía de Integración Paso a Paso

### Paso 1: Inspeccionar estructura actual
```bash
ls -la control_registros/
# Verificar presencia de:
# - main.py, exportar_kml.py
# - .env con credenciales
# - kml_proyectos/ con archivos
```

### Paso 2: Crear wrapper para Geovisor
```python
# geovisor_adapter.py
from control_registros_api import ControlRegistrosAPI

class GeovisorAdapter:
    def __init__(self, config_path):
        self.api = ControlRegistrosAPI(config_path)
    
    def obtener_datos(self, params):
        """Interfaz wrapper para Geovisor"""
        return self.api.ejecutar(**params)
```

### Paso 3: Definir APIcontrato
```
POST /api/v1/control-registros/reportes
{
  "tipo": "global" | "proyecto",
  "pid": "5f231f11682b965f9889826c" (si tipo=proyecto),
  "fecha_inicio": "YYYY-MM-DD",
  "fecha_fin": "YYYY-MM-DD", 
  "formato_salida": "xlsx" | "json" | "kml" | "geojson"
}

→ Respuesta:
{
  "status": "success",
  "archivo": "/path/to/report.xlsx",
  "registros": 245,
  "clasificacion": {
    "EN_OBRA": 180,
    "EN_OFICINA": 45,
    "UBICACION_EXTERNA": 20
  }
}
```

### Paso 4: Documentar en Geovisor
- Agregar endpoint a documentación de APIs
- Crear interfaz UI para seleccionar parámetros
- Implementar carga de archivos generados
- Establecer permisos de acceso

---

## 📞 Soporte y Mantenimiento

### Logs Recomendados
- Tiempo de ejecución de pipelines
- Errores de conexión SSH/MongoDB
- Registros sin coordenadas válidas
- Archivos KML faltantes

### Monitoreo
- Espacio en disco para reportes (report/)
- Disponibilidad del servidor SSH/MongoDB
- Validez de credenciales (rotation anual)
- Actualización de geocercas

### Testing
```bash
python test_db_connection.py  # Verificar conectividad
python -m pytest tests/        # Suite de pruebas (crear)
```

---

## 📌 Resumen Técnico

| Aspecto | Detalle |
|--------|---------|
| **Lenguaje** | Python 3.9+ |
| **Base de datos** | MongoDB |
| **Autenticación** | SSH Tunnel + clave privada |
| **Entrada de usuario** | CLI interactiva |
| **Formatos de salida** | XLSX, KML, JSON, GeoJSON |
| **Librerías geográficas** | Shapely, FastKML, SimpleKML |
| **Estándar geográfico** | WGS84 (EPSG:4326) |
| **Caché** | En memoria (geocercas) |
| **Escalabilidad** | Hasta 100k registros/reporte |
| **Dependencia externa** | Geovisor (opcional) |

---

**Versión**: 1.0  
**Última actualización**: 12 de marzo de 2026  
**Mantenedor**: SEGMAB - Equipo de Auditoría Geográfica
