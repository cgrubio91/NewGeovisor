# 🌍 Geovisor Pro - Plataforma Geoespacial Avanzada

Geovisor Pro es una solución web de alto rendimiento para la gestión, visualización y análisis de datos geográficos. Diseñada con una arquitectura moderna y robusta, permite centralizar proyectos complejos y servirlos con una experiencia de usuario fluida y profesional.

---

## ✨ Características Estelares

### 📂 Gestión Integral de Proyectos
*   **Control de Accesos:** Asignación de múltiples usuarios a proyectos específicos.
*   **Jerarquía de Roles:** Administradores (Control Total), Directores (Carga/Edición) y Usuarios (Solo Visualización).
*   **Jerarquía Inteligente:** Organización de capas mediante carpetas y subcarpetas.
*   **Dashboard Estadístico:** Visualización del estado del sistema y visitas a proyectos.

### 🗺️ Poder Multiformato
Visualice prácticamente cualquier dato GIS sin software adicional:
*   **Imágenes:** TIFF, GeoTIFF, ECW, Ortofotos.
*   **Vectores:** KML, KMZ, Shapefile, GeoJSON.
*   **3D y Nubes:** LAS, LAZ, OBJ, DXF (CAD).

### 🎨 Experiencia de Navegación
*   **Modo Dual:** Cambio instantáneo entre vistas **2D (OpenLayers)** y **3D (CesiumJS)**.
*   **Comparación Avanzada:** Herramienta de **Cortinilla (Swipe)** para comparar cambios temporales u ortofotos.
*   **Mapas Base:** Selección entre Satélite, Topográfico, Oscuro, Claro y OpenStreetMap.

---

## 🚀 Instalación Rápida con Docker

Asegúrese de tener instalado Docker y Docker Compose antes de iniciar.

```bash
# 1. Clonar el proyecto
git clone <url-repositorio>
cd NewGeovisor-1

# 2. Configurar entorno
# Cree el archivo backend/.env basado en DOCUMENTATION.md

# 3. Desplegar sistema
docker-compose up -d --build

# 4. Crear Administrador
docker-compose exec backend python create_admin.py
```

---

## 🏗️ Estructura del Código

*   `/backend`: API construida con **FastAPI** y motores de procesamiento como Rasterio.
*   `/frontend`: Interfaz de usuario premium desarrollada en **Angular 17+**.
*   `docker-compose.yml`: Orquestación de contenedores (PostGIS, Backend, Frontend).

---

## 📚 Documentación Completa

Para detalles técnicos, guías de migración y arquitectura profunda, consulte:
📖 **[DOCUMENTATION.md](./DOCUMENTATION.md)**

---

## 🤝 Contribuciones y Soporte

Este proyecto es el núcleo de una plataforma de gestión geoespacial empresarial.
*   **Versión actual:** 2.1.0 (Fase 1 completada)
*   **Próxima Fase:** Optimización de modelos 3D y análisis volumétrico.

---
*Desarrollado con ❤️ por el equipo de Geovisor Pro.*
