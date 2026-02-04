# 📗 Documentación Técnica de Geovisor Pro

Este documento proporciona detalles técnicos profundos sobre la arquitectura, el procesamiento de datos y la gestión del sistema Geovisor Pro.

## 🏗️ Arquitectura del Sistema

Geovisor Pro utiliza una arquitectura modular diseñada para la escalabilidad y la facilidad de integración.

### 🧩 Componentes Principales
- **Frontend (Angular 17+)**: Interfaz de usuario reactiva que maneja la visualización de mapas 2D (OpenLayers) y 3D (CesiumJS).
- **Backend (FastAPI)**: API REST robusta encargada del procesamiento geoespacial, autenticación y gestión de datos.
- **Base de Datos (PostgreSQL + PostGIS)**: Almacenamiento persistente con capacidades espaciales avanzadas.
- **Procesador de Archivos (file_processor.py)**: Núcleo lógico para la conversión y análisis de múltiples formatos GIS.

---

## 🛠️ Procesamiento Geoespacial

### 🖼️ Datos Raster (TIFF, ECW, Ortofotos)
El sistema utiliza **Rasterio** para leer y procesar imágenes georeferenciadas.
- **Tiling Dinámico**: Las imágenes grandes se sirven mediante tiles (teselas) para optimizar la carga.
- **Reproyección**: Los archivos se transforman automáticamente a Web Mercator (EPSG:3857) para compatibilidad con mapas web.
- **Optimización**: Se aplican técnicas de normalización de píxeles para asegurar una visualización clara en el navegador.

### 📐 Datos Vectoriales (KML, KMZ, Shapefile, GeoJSON)
- **KML/KMZ**: Se procesan para mantener estilos, colores y jerarquías originales.
- **Fiona/GeoPandas**: Utilizados para la lectura y filtrado de datos vectoriales complejos.

### ☁️ Nubes de Puntos (LAS/LAZ)
- Utiliza **laspy** para el análisis de cabeceras y estadísticas de nubes de puntos.
- Preparado para visualización volumétrica en el motor 3D.

---

## 🔐 Seguridad y Control de Acceso

### Autenticación JWT
- El sistema utiliza tokens JWT (JSON Web Tokens) para sesiones seguras.
- Las contraseñas se cifran usando **bcrypt**.

### Roles de Usuario
1. **Administrador**: Control total sobre la plataforma, gestión de todos los usuarios y creación/eliminación de proyectos.
2. **Director**: Perfil de gestión y supervisión. Puede crear carpetas, subir información (capas) y editar propiedades en los proyectos asignados.
3. **Usuario**: Perfil de visualización. Solo puede ver información y realizar comparaciones en los proyectos donde ha sido asignado por un administrador; no tiene permisos de creación ni edición.

### Gestión de Proyectos
- Los proyectos tienen un **Dueño** (Owner).
- Se pueden **Asignar Usuarios** específicos a cada proyecto, dándoles permiso de visualización y edición.

---

## 🐳 Guía de Despliegue Avanzado

### Entorno Docker
El sistema está completamente contenedorizado. Los servicios se definen en `docker-compose.yml`:
- `db`: Imagen de PostGIS.
- `backend`: Imagen personalizada de Python con GDAL/PROJ instalados.
- `frontend`: Imagen de Node para compilación y Nginx para servir.

### Escalabilidad en Producción
Para entornos de alta demanda, se recomienda:
- **Nginx Reverse Proxy**: Para manejar SSL/TLS y balanceo de carga.
- **Gunicorn/Uvicorn**: Ejecutar múltiples trabajadores (workers) en el backend.
- **Volúmenes Persistentes**: Asegurar que `/uploads` y los datos de Postgres residan en almacenamiento redundante.

---

## 🧪 Validación y Calidad

### Pruebas Realizadas
- **Conectividad**: Validación de túneles entre contenedores y base de datos.
- **Formatos**: Pruebas de carga exitosas con archivos >500MB.
- **CORS**: Configuración de orígenes permitidos para evitar brechas de seguridad.

---

## 📈 Changelog Técnico

### v2.0.0 (Fase 1 Finalizada)
- ✅ Implementada gestión de usuarios y accesos a proyectos (Persistencia robusta).
- ✅ Soporte multi-formato (LAS, LAZ, OBJ, DXF, KMZ, KML).
- ✅ Sistema de carpetas jerárquicas en proyectos.
- ✅ Herramientas de comparación de capas (Swipe/Cortinilla).
- ✅ Selector dinámico de mapas base.

---

**Nota**: Esta documentación es para desarrolladores y administradores del sistema. Para una guía rápida de usuario, consulte el [README.md](./README.md).
