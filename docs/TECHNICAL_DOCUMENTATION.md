# Geovisor Pro - Documentación Técnica

Esta documentación explica la arquitectura y función de cada archivo principal dentro del repositorio del Geovisor Pro, una plataforma web de análisis geoespacial para la gestión de proyectos, carga de capas, visualización en 2D/3D y generación de reportes avanzados a través de integraciones con los registros en MongoDB y PostgreSQL.

## Estructura del Proyecto

El código está dividido en dos grandes bloques:
- **`backend/`**: API RESTful en **FastAPI** (Python 3)
- **`frontend/`**: Aplicación de página única en **Angular 17+** (TypeScript)

---

## 1. Backend (Python/FastAPI)

El backend maneja la lógica de negocio, procesamiento de información geoespacial local, autenticación, y conexión concurrente a PostgreSQL y MongoDB.

### Archivos Principales
* **`main.py`**: El punto de entrada central de la API. Orquesta los endpoints para usuarios, proyectos, subida de capas, reportes geográficos, conversiones 3D y sincronización base de datos. Administra las verificaciones de roles (midlewares).
* **`database.py`**: Gestiona la configuración de conexión hacia PostgreSQL a través de SQLAlchemy y maneja la base de datos persistente.
* **`models.py`**: Define los modelos relacionales (Tablas) que SQLAlchemy sincroniza con la base de datos. Incluye los esquemas para Usuarios, Proyectos, Capas (Layers), y Mediciones (Measurements). Define también la geometría usada por PostGIS.
* **`schemas.py`**: Modelos Pydantic que validan y serializan los datos al entrar o salir a los endpoints REST mediante esquemas estrictos.
* **`crud.py`**: Concentra las operaciones puras a la base de datos (CREATE, READ, UPDATE, DELETE). Aísla la lógica de consultas complejas para limpiar `main.py`.
* **`geographic_records.py`**: **Motor de Análisis Geoespacial Avanzado**. Establece el túnel SSH hacia el clúster MongoDB, descarga registros en rangos de fecha, extrae las geocercas activas (kml/kmz) guardadas en la plataforma, y usa `shapely` para cruzar las coordenadas produciendo hojas de cálculo (Excel) y visores geográficos (KML).
* **`gis_service.py` / `file_processor.py`**: Componentes auxiliares para procesar archivos físicos y abstraer transformaciones espaciales comunes (CRS).
* **`setup_admin.py` y `init_db.py`**: Scripts independientes para inicializar la base de datos con un esquema preconstruido y crear las credenciales iniciales del superadministrador.
* **`requirements.txt`**: Lista explícita de las dependencias e integraciones de servidor requeridas para el ecosistema de Python.

---

## 2. Frontend (Angular)

Desarrollada bajo componentes modulares (Stand-Alone Components) para un renderizado dinámico e instantáneo.

### Archivos Principales
* **`src/app/components/`**: Aloja cada fragmento funcional de la interfaz visual.
 * **`header/`**: Componente global superior de la aplicación. Maneja el menú de navegación condicional donde expone los módulos correspondientes según el rol (Usuario, Administrador, Director).
 * **`map/`**: Carga el visor principal OpenLayers. Orquesta las vistas Raster y vectoriales y permite renderización de polígonos sobre el plano interactivo.
 * **`map3d/`**: Integra transformaciones avanzadas como Three.js/Cesium (opcional) o vistas paramétricas de modelos 3D asociados al proyecto.
 * **`geographic-records/`**: Interfaz donde el usuario de Rol "Director/Administrador" consulta registros específicos. Presenta controles para filtrar por intervalo de fechas y renderiza estadísticas con botones de descarga KML/Excel.
 * **`project-manager/`**: Administrador visual de proyectos habilitado para organizar capas, editar metadatos o adjuntar archivos físicos, con visibilidad filtrada.
 * **`login/`**: Puerta de entrada mediante el JWT para las sesiones en la aplicación.

* **`src/app/services/`**: Controladores que encapsulan todas las peticiones hacia la API `backend/`.
 * **`auth.service.ts`**: Administra el token y valida qué rol posee el usuario actualmente autenticado (RBAC restrictivo).
 * **`project.service.ts`**: Solicita información al backend limitando las vistas con base a la pertenencia o designación de acceso de la persona.
 * **`geographic-records.service.ts`**: Orquesta la comunicación para emitir reportes de cruce, procesar PIDs de MongoDB y permitir o denegar el despliegue del mapa según corresponda.

* **`src/styles.css` / `index.css`**: Archivos base que definen la estética corporativa general, usando colores en hexadecimales enriquecidos para una apariencia estricta y profesional sin Tailwind.

---

## 3. Modelo Analítico de Roles
La plataforma se rige por un estricto control de acceso basado en roles (RBAC):

- **Administrador**: Control total sobre el Geovisor. Lee/Escribe en todos los proyectos y manipula la cuenta de todos los colaboradores, adicionalmente consulta registros ajenos del módulo global.
- **Director**: Visibilidad restringida _únicamente_ a los Proyectos y Capas asignados explícitamente a sí mismo. **Posee acceso completo al módulo de Registros (Geographic Records)** pudiendo revisar métricas de "EN OBRA/EN OFICINA" y exportaciones de KML/Excel pero **SOLO** acotado al perímetro de sus proyectos designados.
- **Usuario**: Visibilidad restringida _únicamente_ a los Proyectos y Capas que le son concedidos. Este escalafón no expone herramientas de análisis geográfico ni despliega el menú de "Registros". Se limita a funciones exploratorias de las vistas de mapas o 3D asignados.

---

## 4. Estructura Persistente (Sistema de Archivos)
El ecosistema guarda información generada en rutas claves descritas en `.gitignore`:
* **`backend/report/`**: Destino recurrente para guardar los archivos emitidos por `geographic_records.py`.
* **`backend/uploads/` y `backend/kml_proyectos/`**: Carpetas estratégicas que agrupan las mallas geocercas usadas para discernir qué puntos aplican físicamente en fronteras topográficas usando `shapely.contains()`.
