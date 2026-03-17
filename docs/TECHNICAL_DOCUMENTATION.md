# Geovisor Pro - Documentación Técnica Detallada

Esta documentación proporciona una visión exhaustiva de la arquitectura del Geovisor Pro, detallando la función de cada script y componente tanto en el Backend como en el Frontend. 

---

## 🛡️ Privacidad y Seguridad
**IMPORTANTE:** Todas las configuraciones sensibles (credenciales de base de datos, llaves SSH, tokens JWT, rutas de servidor) se gestionan exclusivamente a través de variables de entorno en el archivo `.env`. Esta documentación describe la estructura y lógica de los scripts sin exponer datos privados.

---

## 1. Arquitectura del Backend (Python / FastAPI)

El backend es el motor de procesamiento geoespacial y la API que sirve los datos al cliente. Está diseñado para manejar grandes volúmenes de datos y procesar archivos GIS complejos.

### 🏠 Núcleo de la API
*   **`main.py`**: Punto de entrada de la aplicación FastAPI. Define las rutas de la API, maneja el CORS y orquesta la integración de todos los módulos.
*   **`database.py`**: Configuración de la conexión a PostgreSQL/PostGIS. Implementa el motor de persistencia y la gestión de sesiones de base de datos.
*   **`models.py`**: Definición de las tablas relacionales (Proyectos, Capas, Usuarios, Mediciones) utilizando SQLAlchemy.
*   **`schemas.py`**: Modelos de validación Pydantic que aseguran que los datos enviados y recibidos cumplan con el formato esperado.
*   **`crud.py`**: Contiene todas las operaciones directas de base de datos (Crear, Leer, Actualizar, Borrar) para mantener la lógica de negocio separada de los endpoints.

### ⚙️ Procesamiento Geoespacial
*   **`geographic_records.py`**: Clase central de análisis. Gestiona túneles SSH para extraer registros de MongoDB, realiza cruces espaciales con geocercas KML/KMZ y clasifica ubicaciones (En Obra / En Oficina / Externo).
*   **`gis_service.py`**: Servicios para manejo de proyecciones (EPSG), transformaciones de coordenadas y utilidades GIS generales.
*   **`file_processor.py`**: Lógica para la lectura y validación de archivos subidos (KML, Shapefiles, GeoTIFF).
*   **`tile_renderer.py`**: Motor encargado de renderizar imágenes raster pesadas en "tiles" para su visualización eficiente en el mapa.
*   **`convert_3d.py`**: Script para transformar nubes de puntos (LAS/LAZ) o modelos CAD a formatos compatibles con visualizadores 3D (Cesium/Three.js).
*   **`convert_cogs.py`**: Convierte imágenes ortofotos convencionales en *Cloud Optimized GeoTIFFs* para una carga progresiva rápida.

### 🛠️ Scripts de Mantenimiento y Migración
*   **`migrate_db.py`**: Realiza cambios estructurales en las tablas de la base de datos sin perder información.
*   **`init_db.py`**: Inicializa una base de datos vacía con el esquema inicial necesario para que el sistema funcione.
*   **`seed_db.py`**: Carga datos de prueba iniciales o configuraciones base.
*   **`reset_processes.py`**: Limpia y reinicia estados de tareas en segundo plano que hayan quedado pendientes o fallidas.
*   **`add_columns.py` / `add_icon_column.py`, etc.**: Scripts auxiliares específicos para actualizar el esquema de la base de datos de forma dirigida.

### 🔍 Scripts de Diagnóstico
*   **`check_db_layers.py`**: Verifica la integridad entre los archivos físicos en el servidor y sus registros en la base de datos.
*   **`diagnose_query.py`**: Herramienta de depuración para analizar el rendimiento de las consultas espaciales complejas.
*   **`run_geographic_analysis.py`**: Interfaz de línea de comandos (CLI) que permite ejecutar reportes de análisis de registros de forma manual e interactiva sin pasar por la web.

---

## 2. Arquitectura del Frontend (Angular 17+)

El frontend es una Single Page Application (SPA) moderna enfocada en la visualización interactiva y la gestión intuitva de proyectos geoespacialies.

### 🧩 Componentes Principales (`src/app/components/`)
*   **`map/`**: El visor de mapas 2D basado en OpenLayers. Gestiona capas vectoriales, raster y la interacción del usuario con las geometrías.
*   **`map3d/`**: Visor especializado en modelos de elevación digital y nubes de puntos 3D.
*   **`geographic-records/`**: Módulo de reportes donde el usuario visualiza estadísticas de trabajo de campo a través de gráficos y tablas.
*   **`project-manager/`**: Interfaz administrativa para la creación de proyectos y subida de información.
*   **`layer-control/` / `layer-panel/`**: Herramientas para activar, desactivar y gestionar la transparencia/orden de las capas cargadas.
*   **`basemap-selector/`**: Selector dinámico de mapas base (Satélite, Topográfico, etc.).
*   **`measurement-panel/`**: Herramienta interactiva para medir distancias y áreas directamente en el mapa.
*   **`layer-compare/`**: Implementa la funcionalidad de "Swipe" o cortinilla para comparar dos capas temporalmente (ej. Ortofotos de distintos meses).
*   **`user-manager/`**: Módulo para la administración de usuarios, roles y permisos de acceso.

### 📡 Servicios de Datos (`src/app/services/`)
*   **`api.service.ts`**: Clase base para todas las peticiones HTTP, centralizando el manejo de errores y cabeceras.
*   **`auth.service.ts`**: Gestiona el inicio de sesión, el almacenamiento del JWT y la protección de rutas según el rol.
*   **`map.service.ts`**: Mantiene el estado del visor 2D y permite la comunicación entre distintos componentes y el mapa.
*   **`project.service.ts` / `layer.service.ts`**: Servicios dedicados a obtener y actualizar información de proyectos y capas respectivamente.
*   **`geographic-records.service.ts`**: Orquesta las peticiones complejas de reportes y descargas de Excel/KML.
*   **`toast.service.ts`**: Administra las notificaciones visuales (alertas) en la interfaz.

---

## 3. Infraestructura y Configuración

*   **`docker-compose.yml`**: Define los servicios (Contenedores) que componen la plataforma:
    *   **db**: Base de datos PostGIS (PostgreSQL + Extensiones Espaciales).
    *   **backend**: API FastAPI corriendo sobre Uvicorn.
    *   **frontend**: Servidor Nginx que sirve los archivos estáticos de la aplicación Angular.
*   **`backend/.env.example`**: Plantilla de las variables necesarias para el despliegue:
    *   Conexión a base de datos.
    *   Configuración de Túnel SSH para acceso a datos externos.
    *   Límites de memoria y puertos.

---

## 📈 Flujo de Datos Típico
1. El **Usuario** carga un archivo KMZ en el **Project Manager**.
2. El **Frontend** lo envía vía **Layer Service** al endpoint de carga en el **Backend**.
3. El **Backend** (`main.py`) recibe el archivo, lo guarda en `uploads/` y genera un registro en **PostgreSQL** vía **CRUD**.
4. Si se requiere análisis, `run_geographic_analysis.py` o los servicios internos invocan a `geographic_records.py` para cruzar esos datos con la base de datos externa de registros.
5. Los resultados se visualizan de nuevo en el **Mapa 2D/3D** o se descargan como reportes estructurados.
