# 📚 Geovisor Pro - Documentación Técnica

## 🎯 Visión General del Sistema

**Geovisor Pro** es una aplicación web de análisis geoespacial avanzado que permite visualizar, gestionar y analizar datos geográficos en 2D y 3D. El sistema soporta múltiples formatos de archivos geoespaciales incluyendo rasters (TIFF, GeoTIFF), vectores (KML, KMZ), nubes de puntos (LAS, LAZ) y modelos 3D (OBJ).

### Características Principales

- 🗺️ **Visualización 2D y 3D**: Mapas interactivos con OpenLayers y CesiumJS
- 📁 **Gestión de Proyectos**: Organización jerárquica de capas en carpetas
- 🔄 **Procesamiento Asíncrono**: Conversión automática de archivos pesados en segundo plano
- 👥 **Multi-usuario**: Sistema de autenticación con JWT
- 🎨 **Comparación de Capas**: Herramienta de swipe para comparar ortofotosmosaicos
- 🌐 **Soporte Multi-formato**: TIFF, GeoTIFF, LAS, LAZ, OBJ, KML, KMZ, ECW

---

## 🏗️ Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND (Angular)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  OpenLayers  │  │   CesiumJS   │  │  Components  │      │
│  │    (2D)      │  │    (3D)      │  │   Services   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            ↕ HTTP/REST API
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND (FastAPI/Python)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Endpoints  │  │  Background  │  │  Converters  │      │
│  │     API      │  │    Tasks     │  │   (GDAL,     │      │
│  │              │  │              │  │  py3dtiles)  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            ↕ SQLAlchemy ORM
┌─────────────────────────────────────────────────────────────┐
│              BASE DE DATOS (PostgreSQL + PostGIS)            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │    Users     │  │   Projects   │  │    Layers    │      │
│  │   Folders    │  │              │  │              │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 Estructura de la Base de Datos

### Tablas Principales

#### `users`
Almacena información de usuarios del sistema.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | Integer (PK) | Identificador único |
| `username` | String(50) | Nombre de usuario único |
| `email` | String(100) | Correo electrónico único |
| `hashed_password` | String | Contraseña hasheada (bcrypt) |
| `full_name` | String(100) | Nombre completo |
| `is_active` | Boolean | Estado de la cuenta |
| `role` | String(20) | Rol: 'admin', 'user', 'viewer' |
| `created_at` | DateTime | Fecha de creación |

#### `projects`
Proyectos geoespaciales que agrupan capas.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | Integer (PK) | Identificador único |
| `name` | String(100) | Nombre del proyecto |
| `description` | Text | Descripción detallada |
| `owner_id` | Integer (FK→users) | Usuario propietario |
| `created_at` | DateTime | Fecha de creación |
| `updated_at` | DateTime | Última modificación |

**Relaciones:**
- `users` ↔ `projects`: Many-to-Many (tabla intermedia `user_projects`)
- `projects` → `folders`: One-to-Many
- `projects` → `layers`: One-to-Many

#### `folders`
Organización jerárquica de capas dentro de proyectos.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | Integer (PK) | Identificador único |
| `name` | String(100) | Nombre de la carpeta |
| `project_id` | Integer (FK→projects) | Proyecto contenedor |
| `parent_id` | Integer (FK→folders) | Carpeta padre (nullable) |
| `created_at` | DateTime | Fecha de creación |

**Jerarquía:** Soporta anidamiento infinito mediante `parent_id`.

#### `layers`
Capas geoespaciales individuales.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | Integer (PK) | Identificador único |
| `name` | String(200) | Nombre de la capa |
| `layer_type` | String(50) | Tipo: 'raster', 'vector', 'point_cloud', '3d_model' |
| `file_format` | String(20) | Formato: 'tiff', 'las', 'kml', etc. |
| `file_path` | String(500) | Ruta al archivo procesado |
| `crs` | String(50) | Sistema de coordenadas (EPSG) |
| `project_id` | Integer (FK→projects) | Proyecto contenedor |
| `folder_id` | Integer (FK→folders) | Carpeta contenedora (nullable) |
| `visible` | Boolean | Visibilidad inicial |
| `opacity` | Integer | Opacidad (0-100) |
| `z_index` | Integer | Orden de apilamiento |
| `settings` | JSON | Configuración específica |
| `metadata` | JSON | Metadatos del archivo |
| `processing_status` | String(20) | Estado: 'pending', 'processing', 'completed', 'failed' |
| `processing_progress` | Integer | Progreso (0-100) |
| `created_at` | DateTime | Fecha de creación |

**Campo `settings` (JSON):**
```json
{
  "optimized": true,
  "original_path": "uploads/archivo_original.las",
  "rotation": {
    "heading": 0,
    "pitch": 0,
    "roll": 0
  }
}
```

---

## 🔧 Backend - Estructura de Archivos

### Archivos Principales

#### `main.py` (Núcleo de la API)
**Propósito:** Punto de entrada de la aplicación FastAPI. Define todos los endpoints REST.

**Endpoints Clave:**

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/auth/login` | POST | Autenticación con JWT |
| `/users/` | GET, POST | Gestión de usuarios |
| `/projects/` | GET, POST | CRUD de proyectos |
| `/folders/` | POST, DELETE | Gestión de carpetas |
| `/layers/{id}` | GET, PATCH, DELETE | CRUD de capas |
| `/upload` | POST | Subida de archivos |
| `/tiles/{z}/{x}/{y}.png` | GET | Servicio de tiles para rasters |

**Funciones de Procesamiento Asíncrono:**
- `process_raster_pipeline()`: Convierte TIFF → COG (Cloud Optimized GeoTIFF)
- `process_3d_pipeline()`: Convierte LAS/LAZ → 3D Tiles, OBJ → GLB

**Configuración:**
```python
UPLOAD_DIR = "uploads"  # Directorio de archivos subidos
SECRET_KEY = os.getenv("SECRET_KEY")  # Para JWT
DATABASE_URL = os.getenv("DATABASE_URL")  # Conexión a PostgreSQL
```

#### `models.py` (Modelos de Base de Datos)
**Propósito:** Define las tablas de la base de datos usando SQLAlchemy ORM.

**Modelos:**
- `User`: Usuarios del sistema
- `Project`: Proyectos geoespaciales
- `Folder`: Carpetas de organización
- `Layer`: Capas geoespaciales

**Relaciones Importantes:**
```python
# Un proyecto puede tener muchos usuarios
Project.users = relationship("User", secondary=user_projects)

# Un proyecto tiene muchas capas
Project.layers = relationship("Layer", back_populates="project")

# Una carpeta puede tener subcarpetas (auto-referencia)
Folder.children = relationship("Folder", back_populates="parent")
```

#### `schemas.py` (Validación de Datos)
**Propósito:** Define esquemas Pydantic para validación de entrada/salida de la API.

**Esquemas Principales:**
- `UserCreate`, `UserResponse`: Creación y respuesta de usuarios
- `ProjectCreate`, `ProjectResponse`: Proyectos
- `LayerCreate`, `LayerResponse`: Capas
- `Token`: Respuesta de autenticación JWT

#### `crud.py` (Operaciones de Base de Datos)
**Propósito:** Funciones de acceso a datos (Create, Read, Update, Delete).

**Funciones Clave:**
- `get_user_by_username()`: Autenticación
- `create_project()`: Crear proyecto
- `get_project_layers()`: Obtener capas de un proyecto
- `update_layer()`: Actualizar propiedades de capa

#### `database.py` (Configuración de BD)
**Propósito:** Configuración de SQLAlchemy y conexión a PostgreSQL.

```python
DATABASE_URL = "postgresql://user:password@localhost:5432/geovisor_db"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
```

#### `gis_service.py` (Servicios Geoespaciales)
**Propósito:** Funciones para procesamiento de datos geográficos.

**Funciones:**
- `get_raster_info()`: Extrae metadatos de rasters (CRS, bounds, resolución)
- `get_kml_info()`: Procesa archivos KML/KMZ
- `extract_kmz()`: Descomprime archivos KMZ

#### `convert_cogs.py` (Conversión de Rasters)
**Propósito:** Convierte TIFF a Cloud Optimized GeoTIFF (COG) para streaming eficiente.

**Proceso:**
1. Lee el archivo TIFF original
2. Reproyecta a Web Mercator (EPSG:3857) si es necesario
3. Genera overviews (pirámides) para diferentes niveles de zoom
4. Guarda como COG con compresión LZW

**Tecnologías:** GDAL, rasterio

#### `convert_3d.py` (Conversión de Archivos 3D)
**Propósito:** Convierte archivos 3D a formatos optimizados para web.

**Funciones:**

##### `convert_point_cloud(input_path, output_dir)`
Convierte LAS/LAZ → 3D Tiles (formato Cesium).

**Proceso:**
1. Convierte rutas a absolutas (requerido en Windows)
2. Ejecuta `py3dtiles convert` con `--disable-processpool`
3. Valida que `tileset.json` se generó correctamente
4. Retorna ruta al tileset

**Configuración Especial para Windows:**
```python
cmd = [
    'py3dtiles', 'convert',
    input_path,
    '--out', output_dir,
    '--overwrite',
    '--disable-processpool'  # Evita errores de multiprocessing en Windows
]
```

**Timeout:** 10 minutos base + 1 minuto por cada 50MB del archivo.

##### `convert_obj_to_glb(input_path, output_path)`
Convierte OBJ → GLB (glTF binario).

**Tecnologías:** trimesh

---

## 🎨 Frontend - Estructura de Archivos

### Arquitectura Angular

```
frontend/src/app/
├── components/          # Componentes de UI
│   ├── header/         # Barra de navegación
│   ├── login/          # Autenticación
│   ├── dashboard/      # Panel de estadísticas
│   ├── project-manager/# Gestión de proyectos (Navega a /map al abrir)
│   ├── user-manager/   # Administración de usuarios
│   ├── upload/         # Subida de archivos
│   ├── layer-control/  # Panel de capas
│   ├── layer-compare/  # Herramienta de comparación
│   ├── map/            # Mapa 2D (OpenLayers)
│   ├── map3d/          # Mapa 3D (CesiumJS)
│   ├── transform-control/ # Controles de transformación 3D
│   └── basemap-selector/  # Selector de mapas base
├── services/           # Servicios de lógica de negocio
│   ├── api.service.ts
│   ├── auth.service.ts
│   ├── map.service.ts
│   ├── map3d.service.ts
│   ├── layer.service.ts
│   ├── project.service.ts
│   └── toast.service.ts
├── models/             # Interfaces TypeScript
│   └── models.ts
└── app.ts              # Componente raíz
```

### Componentes Principales

#### `app.ts` (Componente Raíz)
**Propósito:** Componente principal que orquesta la estructura base de la aplicación.

**Responsabilidades:**
- Renderiza el `HeaderComponent` y el `RouterOutlet`.
- Maneja el estado de autenticación global.
- Delega la navegación al `Angular Router`.

**Estructura del Template:**
```html
<app-header></app-header>
<main>
  <router-outlet></router-outlet> <!-- Aquí se cargan las vistas -->
</main>
```

#### `app.routes.ts` (Configuración de Rutas)
**Propósito:** Define la navegación de la aplicación mediante URLs.

**Rutas Configuradas:**
- `/dashboard` → `DashboardComponent`
- `/projects` → `ProjectManager`
- `/map` → `MapViewComponent` (Visor 2D/3D)
- `/users` → `UserManager`
- `/**` → Redirección a `/dashboard` (404)

#### `map-view.component.ts` (Contenedor del Visor)
**Propósito:** Vista principal que agrupa todos los componentes del mapa.

**Responsabilidades:**
- Contiene `MapComponent` (2D) y `Map3dComponent` (3D).
- Gestiona el cambio entre modos (2D, 3D Studio, Globo).
- Aloja los paneles flotantes (`LayerControl`, `Upload`, `LayerCompare`).

#### `map.component.ts` (Mapa 2D)
**Propósito:** Visualización 2D con OpenLayers.

**Funcionalidades:**
- Inicializa mapa con OpenStreetMap como base
- Carga capas raster (TIFF) como tiles XYZ
- Carga capas vectoriales (KML/KMZ)
- Controla visibilidad y opacidad de capas
- Se suscribe a `ProjectContextService.activeProject$` para actualizaciones en tiempo real

**Carga de Capas:**
```typescript
if (layer.layer_type === 'raster') {
  const tileUrl = this.apiService.getTileUrl(layer.id);
  this.mapService.addRasterLayer(tileUrl, layer.id, layer.opacity);
} else if (layer.layer_type === 'vector') {
  this.mapService.addKMLLayer(fileUrl, layer.id);
}
```

#### `map3d.component.ts` (Mapa 3D)
**Propósito:** Visualización 3D con CesiumJS.

**Funcionalidades:**
- Inicializa visor Cesium con terreno Cesium World Terrain
- Carga nubes de puntos (3D Tiles)
- Carga modelos 3D (GLB)
- Carga capas raster como ImageryLayer
- Modo "Studio" (sin globo, solo grid local)
- Controles de rotación de modelos

**Detección de Archivos Convertidos:**
```typescript
const filename = filePath.split(/[\\/]/).pop()?.toLowerCase() || '';
const isConverted = filename === 'tileset.json' || filename.endsWith('.json');

if (isConverted) {
  // Pequeño delay para asegurar que el archivo está disponible
  setTimeout(() => {
    this.map3dService.add3DTileset(fileUrl, layer.id, metadata?.rotation);
  }, 500);
}
```

#### `layer-control.component.ts` (Panel de Capas)
**Propósito:** Interfaz para gestionar capas y carpetas.

**Funcionalidades:**
- Lista jerárquica de capas y carpetas
- Drag & drop para reorganizar
- Toggle de visibilidad
- Control de opacidad
- Renombrado de capas
- Eliminación de capas
- Descarga de archivos originales
- Zoom a capa
- **Polling automático**: Refresca el proyecto cada 4 segundos si hay capas en procesamiento

**Sistema de Polling:**
```typescript
private checkAndStartPolling() {
  const hasProcessing = this.layers.some(l => 
    l.processing_status === 'processing' || 
    l.processing_status === 'pending'
  );

  if (hasProcessing && !this.pollInterval) {
    this.pollInterval = setInterval(() => {
      const projectId = this.projectContext.getActiveProjectId();
      if (projectId) {
        this.projectService.getProjectById(projectId).subscribe(project => {
          this.projectContext.setActiveProject(project);
        });
      }
    }, 4000); // Cada 4 segundos
  }
}
```

#### `upload.component.ts` (Subida de Archivos)
**Propósito:** Interfaz para subir archivos geoespaciales.

**Formatos Soportados:**
- Raster: TIFF, GeoTIFF, ECW
- Vector: KML, KMZ
- 3D: LAS, LAZ, OBJ

**Proceso:**
1. Usuario selecciona archivo(s)
2. Se envía a `/upload` con `FormData`
3. Backend procesa y crea capa en estado "pending" o "processing"
4. Frontend muestra progreso
5. Polling detecta cuando termina el procesamiento
6. Capa aparece automáticamente en el mapa

#### `layer-compare.component.ts` (Comparación de Capas)
**Propósito:** Herramienta de swipe para comparar dos capas lado a lado.

**Funcionalidades:**
- Selección de dos capas para comparar
- Control deslizante (swipe) para revelar capas
- Funciona en 2D y 3D
- Aislamiento de capas durante la comparación

### Servicios Principales

#### `api.service.ts`
**Propósito:** Comunicación HTTP con el backend.

**Métodos:**
- `uploadFiles()`: Sube archivos al servidor
- `getTileUrl()`: Construye URL para tiles de rasters
- `getUploadedFileUrl()`: Construye URL para archivos estáticos

#### `auth.service.ts`
**Propósito:** Gestión de autenticación y autorización.

**Funcionalidades:**
- Login con JWT
- Almacenamiento de token en localStorage
- Signal reactivo `currentUser()`
- Interceptor HTTP para añadir token a requests

#### `map.service.ts`
**Propósito:** Gestión del mapa 2D (OpenLayers).

**Métodos:**
- `initMap()`: Inicializa el mapa
- `addRasterLayer()`: Añade capa raster como tiles
- `addKMLLayer()`: Añade capa vectorial KML
- `setLayerVisibility()`: Controla visibilidad
- `setLayerOpacity()`: Controla opacidad
- `zoomToLayer()`: Hace zoom a una capa

#### `map3d.service.ts`
**Propósito:** Gestión del mapa 3D (CesiumJS).

**Métodos Clave:**

##### `add3DTileset(url, id, rotation?)`
Añade una nube de puntos o modelo 3D Tiles.

**Configuración de Point Cloud Shading:**
```typescript
tileset.pointCloudShading.attenuation = true;
tileset.pointCloudShading.maximumAttenuation = 5.0;
tileset.pointCloudShading.eyeDomeLighting = true;
tileset.pointCloudShading.eyeDomeLightingStrength = 1.0;
tileset.pointCloudShading.eyeDomeLightingRadius = 2.0;

tileset.style = new Cesium.Cesium3DTileStyle({
  pointSize: 4.0
});
```

##### `toggleLocalMode(enabled)`
Activa/desactiva el modo "Studio" (sin globo).

**Modo Studio:**
- Oculta el globo terrestre
- Muestra grid de referencia
- Muestra ejes XYZ
- Ideal para modelos arquitectónicos

##### `clearLayers()`
Limpia todas las capas **excepto** el grid y los ejes.

#### `layer.service.ts`
**Propósito:** Gestión del estado de capas.

**Características:**
- `BehaviorSubject<Layer[]>` para reactividad
- Métodos para actualizar propiedades de capas
- Sincronización con el backend

#### `project-context.service.ts`
**Propósito:** Mantiene el contexto global de la aplicación.

**Estado Global:**
- `activeProject$`: Proyecto actualmente abierto
- `selectedLayerId$`: Capa seleccionada

**Uso:**
```typescript
// Componentes se suscriben para reaccionar a cambios
this.projectContext.activeProject$.subscribe(project => {
  if (project) {
    this.loadLayers(project.layers);
  }
});
```

---

## 🔄 Flujos de Trabajo Principales

### 1. Subida y Procesamiento de Nube de Puntos (.las)

```
┌─────────────┐
│   Usuario   │
│ selecciona  │
│ archivo.las │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ Frontend: upload.component.ts           │
│ - Crea FormData con archivo             │
│ - POST /upload                           │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ Backend: main.py /upload                │
│ 1. Guarda archivo en uploads/           │
│ 2. Detecta tipo: point_cloud            │
│ 3. Crea Layer con status="processing"   │
│ 4. Lanza process_3d_pipeline() en       │
│    background                            │
│ 5. Retorna Layer al frontend            │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ Backend: process_3d_pipeline()          │
│ (Tarea en segundo plano)                │
│ 1. Llama convert_point_cloud()          │
│ 2. Ejecuta py3dtiles convert            │
│    - Timeout: 18 minutos                │
│    - Genera tileset.json                │
│ 3. Valida tileset.json                  │
│ 4. Actualiza Layer:                     │
│    - file_path = "uploads/3d_tiles_X/   │
│      tileset.json"                       │
│    - status = "completed"                │
│    - settings.original_path = archivo   │
│      original                            │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ Frontend: layer-control.component.ts    │
│ (Polling cada 4 segundos)               │
│ 1. GET /projects/by-id/{id}             │
│ 2. Detecta status="completed"           │
│ 3. Actualiza ProjectContext             │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ Frontend: map3d.component.ts            │
│ (Suscrito a activeProject$)             │
│ 1. Detecta nueva capa completada        │
│ 2. Construye fileUrl                    │
│ 3. Llama map3dService.add3DTileset()    │
│ 4. Cesium carga y renderiza la nube     │
│    de puntos                             │
└─────────────────────────────────────────┘
       │
       ▼
   ¡Visualización 3D lista!
```

### 2. Comparación de Capas (Swipe)

```
Usuario hace clic en "Comparar"
       │
       ▼
layer-compare.component.ts abre modal
       │
       ▼
Usuario selecciona 2 capas
       │
       ▼
map.service.ts (2D) o map3d.service.ts (3D)
       │
       ├─ Oculta todas las demás capas
       ├─ Muestra solo las 2 seleccionadas
       ├─ Aplica clipping con swipe position
       └─ Usuario mueve el slider
              │
              ▼
          Actualiza clipping en tiempo real
```

### 3. Autenticación JWT

```
Usuario ingresa credenciales
       │
       ▼
POST /auth/login
       │
       ▼
Backend valida con bcrypt
       │
       ├─ ✅ Válido: Genera JWT token
       │   └─ Frontend guarda en localStorage
       │       └─ Actualiza currentUser signal
       │           └─ Muestra interfaz principal
       │
       └─ ❌ Inválido: Error 401
           └─ Muestra mensaje de error
```

---

## 🚀 Guía de Escalabilidad

### Optimizaciones Actuales

1. **Cloud Optimized GeoTIFF (COG)**
   - Permite streaming de tiles sin cargar todo el archivo
   - Overviews para diferentes niveles de zoom

2. **3D Tiles**
   - Formato jerárquico para nubes de puntos
   - Carga progresiva según nivel de detalle (LOD)

3. **Procesamiento Asíncrono**
   - Conversiones pesadas no bloquean la API
   - Usuario puede seguir trabajando mientras procesa

4. **Polling Inteligente**
   - Solo activo cuando hay capas procesando
   - Se detiene automáticamente al completar

### Mejoras Futuras Recomendadas

#### 1. Sistema de Colas (Celery + Redis)

**Problema Actual:** `BackgroundTasks` de FastAPI no es persistente.

**Solución:**
```python
# Instalar: pip install celery redis
from celery import Celery

celery_app = Celery('geovisor', broker='redis://localhost:6379/0')

@celery_app.task
def process_3d_pipeline_task(file_path, layer_id):
    # Mismo código actual
    pass
```

**Beneficios:**
- Tareas persisten si el servidor se reinicia
- Monitoreo de tareas con Flower
- Escalabilidad horizontal (múltiples workers)

#### 2. Almacenamiento en la Nube (S3/Azure Blob)

**Problema Actual:** Archivos en disco local limitan escalabilidad.

**Solución:**
```python
# Usar boto3 para S3
import boto3

s3 = boto3.client('s3')
s3.upload_file('local_file.las', 'mi-bucket', 'uploads/file.las')

# Actualizar URLs para servir desde S3
file_url = f"https://mi-bucket.s3.amazonaws.com/uploads/file.las"
```

#### 3. WebSockets para Progreso en Tiempo Real

**Problema Actual:** Polling cada 4 segundos es ineficiente.

**Solución:**
```python
# Backend: FastAPI WebSocket
from fastapi import WebSocket

@app.websocket("/ws/progress/{layer_id}")
async def websocket_progress(websocket: WebSocket, layer_id: int):
    await websocket.accept()
    while True:
        progress = get_layer_progress(layer_id)
        await websocket.send_json({"progress": progress})
        await asyncio.sleep(1)
```

```typescript
// Frontend: Angular WebSocket
const ws = new WebSocket('ws://localhost:8000/ws/progress/123');
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  this.updateProgress(data.progress);
};
```

#### 4. Caché de Tiles (Redis/Memcached)

**Solución:**
```python
import redis
cache = redis.Redis(host='localhost', port=6379)

@app.get("/tiles/{z}/{x}/{y}.png")
def get_tile(z: int, x: int, y: int, layer_id: int):
    cache_key = f"tile:{layer_id}:{z}:{x}:{y}"
    
    # Intentar obtener de caché
    cached = cache.get(cache_key)
    if cached:
        return Response(content=cached, media_type="image/png")
    
    # Generar tile
    tile = generate_tile(z, x, y, layer_id)
    
    # Guardar en caché (expira en 1 hora)
    cache.setex(cache_key, 3600, tile)
    
    return Response(content=tile, media_type="image/png")
```

#### 5. Microservicios

**Arquitectura Propuesta:**
```
┌─────────────────┐
│  API Gateway    │
│  (FastAPI)      │
└────────┬────────┘
         │
    ┌────┴────┬──────────┬──────────┐
    ▼         ▼          ▼          ▼
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│ Auth   │ │ Files  │ │ 3D     │ │ Tiles  │
│Service │ │Service │ │Convert │ │Service │
└────────┘ └────────┘ └────────┘ └────────┘
```

**Beneficios:**
- Escalabilidad independiente de cada servicio
- Despliegue sin downtime
- Tecnologías específicas por servicio

---

## 🔒 Consideraciones de Seguridad

### Implementadas

1. **JWT con expiración**: Tokens expiran en 24 horas
2. **Passwords hasheadas**: bcrypt con salt
3. **CORS configurado**: Solo orígenes permitidos
4. **Validación de entrada**: Pydantic schemas
5. **SQL Injection protegido**: SQLAlchemy ORM

### Recomendaciones Adicionales

1. **HTTPS en producción**
   ```nginx
   server {
       listen 443 ssl;
       ssl_certificate /path/to/cert.pem;
       ssl_certificate_key /path/to/key.pem;
   }
   ```

2. **Rate Limiting**
   ```python
   from slowapi import Limiter
   
   limiter = Limiter(key_func=get_remote_address)
   
   @app.post("/upload")
   @limiter.limit("5/minute")  # Máximo 5 uploads por minuto
   async def upload_files(...):
       pass
   ```

3. **Validación de archivos**
   ```python
   ALLOWED_EXTENSIONS = {'.tiff', '.las', '.kml', '.obj'}
   MAX_FILE_SIZE = 500 * 1024 * 1024  # 500 MB
   
   def validate_file(file: UploadFile):
       ext = os.path.splitext(file.filename)[1].lower()
       if ext not in ALLOWED_EXTENSIONS:
           raise HTTPException(400, "Formato no permitido")
       
       # Verificar tamaño
       file.file.seek(0, 2)
       size = file.file.tell()
       file.file.seek(0)
       
       if size > MAX_FILE_SIZE:
           raise HTTPException(400, "Archivo muy grande")
   ```

4. **Sanitización de nombres de archivo**
   ```python
   import re
   
   def sanitize_filename(filename: str) -> str:
       # Remover caracteres peligrosos
       filename = re.sub(r'[^\w\s.-]', '', filename)
       # Prevenir path traversal
       filename = os.path.basename(filename)
       return filename
   ```

---

## 📦 Dependencias Críticas

### Backend (Python)

| Paquete | Versión | Propósito |
|---------|---------|-----------|
| `fastapi` | ^0.100.0 | Framework web |
| `uvicorn` | ^0.23.0 | Servidor ASGI |
| `sqlalchemy` | ^2.0.0 | ORM |
| `psycopg2-binary` | ^2.9.0 | Driver PostgreSQL |
| `pydantic` | ^2.0.0 | Validación de datos |
| `python-jose` | ^3.3.0 | JWT |
| `passlib` | ^1.7.4 | Hashing de passwords |
| `rasterio` | ^1.3.0 | Procesamiento de rasters |
| `gdal` | ^3.6.0 | Geoespacial |
| `py3dtiles` | ^6.0.0 | Conversión LAS→3D Tiles |
| `trimesh` | ^3.20.0 | Conversión OBJ→GLB |
| `pyproj` | ^3.5.0 | Proyecciones |

### Frontend (Angular)

| Paquete | Versión | Propósito |
|---------|---------|-----------|
| `@angular/core` | ^17.0.0 | Framework |
| `ol` | ^8.0.0 | OpenLayers (2D) |
| `cesium` | ^1.110.0 | CesiumJS (3D) |
| `rxjs` | ^7.8.0 | Programación reactiva |

---

## 🐛 Problemas Conocidos y Soluciones

### 1. Error: `OSError: handle is closed` (Windows)

**Causa:** `py3dtiles` usa multiprocessing que falla en Windows.

**Solución:** Usar `--disable-processpool`
```python
cmd = ['py3dtiles', 'convert', input_path, '--out', output_dir, '--disable-processpool']
```

### 2. Error: `FileNotFoundError` al convertir LAS

**Causa:** `py3dtiles` no maneja bien rutas relativas en Windows.

**Solución:** Convertir a rutas absolutas
```python
input_path = os.path.abspath(input_path)
output_dir = os.path.abspath(output_dir)
```

### 3. Nubes de puntos se ven grises/opacas

**Causa:** Falta configuración de Point Cloud Shading en Cesium.

**Solución:** Configurar Eye Dome Lighting
```typescript
tileset.pointCloudShading.eyeDomeLighting = true;
tileset.pointCloudShading.eyeDomeLightingStrength = 1.0;
```

### 4. Capas no aparecen después de subir

**Causa:** El visor no detecta cuando termina el procesamiento.

**Solución:** Sistema de polling implementado en `layer-control.component.ts`

### 5. CORS errors en desarrollo

**Causa:** Frontend (localhost:4200) y Backend (localhost:8000) son orígenes diferentes.

**Solución:** Configurar CORS en FastAPI
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## 🔧 Mantenimiento

### Backups de Base de Datos

```bash
# Backup
pg_dump -U postgres -d geovisor_db > backup_$(date +%Y%m%d).sql

# Restaurar
psql -U postgres -d geovisor_db < backup_20260212.sql
```

### Limpieza de Archivos Temporales

```python
# Script de limpieza (ejecutar periódicamente)
import os
import time

UPLOAD_DIR = "uploads"
MAX_AGE_DAYS = 30

for root, dirs, files in os.walk(UPLOAD_DIR):
    for file in files:
        filepath = os.path.join(root, file)
        age_days = (time.time() - os.path.getmtime(filepath)) / 86400
        
        if age_days > MAX_AGE_DAYS:
            # Verificar que no esté referenciado en la BD
            if not is_file_referenced(filepath):
                os.remove(filepath)
```

### Monitoreo de Logs

```bash
# Ver logs en tiempo real
tail -f backend/logs/app.log

# Buscar errores
grep "ERROR" backend/logs/app.log
```

---

## 📞 Contacto y Soporte

**Desarrollador:** Cristian Rubio  
**Email:** [tu-email@ejemplo.com]  
**Repositorio:** [URL del repositorio Git]

---

## 📝 Changelog

### v1.0.0 (2026-02-12)
- ✅ Sistema completo de visualización 2D/3D
- ✅ Soporte para LAS/LAZ, TIFF, KML/KMZ, OBJ
- ✅ Procesamiento asíncrono con polling
- ✅ Autenticación JWT
- ✅ Gestión de proyectos y carpetas
- ✅ Herramienta de comparación de capas
- ✅ Modo Studio para visualización 3D local

---


---

## 🚀 Despliegue Rápido (Demo)

Para demostraciones rápidas o pruebas de concepto sin coste inicial:

### Opciones Gratuitas Recomendadas

| Plataforma | Uso | Ventaja |
|------------|-----|---------|
| **Railway.app** | Backend + BD | Despliegue automático desde GitHub, PostgreSQL incluido. |
| **Netlify/Vercel** | Frontend | Hosting estático gratuito, CDN global, SSL automático. |
| **Google Cloud Free Tier** | Full Stack | Crédito gratuito de $300 USD por 90 días. |

**Estrategia para Demos:**
- Usar archivos de muestra ligeros (<100MB) pre-convertidos.
- Desplegar Backend en Railway y Frontend en Netlify.
- Mostrar capacidades clave: Visualización 3D, Comparación (Swipe), Gestión de Usuarios.

---

**Última actualización:** 12 de febrero de 2026

