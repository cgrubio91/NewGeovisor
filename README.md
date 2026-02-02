# 🌍 Geovisor Pro - Sistema de Visualización Geoespacial

## 📖 Descripción

Geovisor Pro es una aplicación web profesional para visualización y análisis de datos geoespaciales. Diseñada para integrarse en sistemas más grandes, ofrece soporte para múltiples formatos de archivos y capacidades avanzadas de visualización 2D y 3D.

## ✨ Características Principales

### 📁 Gestión de Proyectos y Carpetas
- ✅ Creación y gestión de proyectos
- ✅ Organización jerárquica con carpetas y subcarpetas
- ✅ Asignación de usuarios a proyectos
- ✅ Control de acceso basado en roles

### 🗺️ Formatos Soportados

#### Raster
- ✅ TIFF / GeoTIFF
- ✅ Ortofotos
- ✅ ECW, JP2
- ✅ PNG, JPEG

#### Vector
- ✅ Shapefile (.shp)
- ✅ GeoJSON
- ✅ GeoPackage (.gpkg)

#### KML/KMZ
- ✅ KML
- ✅ KMZ (comprimido)

#### Nubes de Puntos
- ✅ LAS
- ✅ LAZ (comprimido)
- ✅ XYZ
- ✅ PLY

#### Modelos 3D
- ✅ OBJ
- ✅ GLTF / GLB
- ✅ FBX
- ✅ Collada (DAE)

#### CAD
- ✅ DXF
- ✅ DWG (requiere conversión)

### 🎨 Visualización

#### Mapas Base
- OpenStreetMap
- Satélite (Esri)
- Terreno (OpenTopoMap)
- Tema Oscuro (CartoDB Dark)
- Tema Claro (CartoDB Light)
- Sin mapa base

#### Modos de Visualización
- 🗺️ **2D**: OpenLayers con renderizado optimizado
- 🌐 **3D**: CesiumJS para visualización tridimensional
- 🔄 Cambio fluido entre 2D y 3D

### 🔧 Herramientas de Capas

#### Control de Capas
- ✅ Activar/Desactivar visibilidad
- ✅ Control de opacidad (0-100%)
- ✅ Orden de capas (z-index)
- ✅ Organización en carpetas
- ✅ Información de metadatos

#### Comparación de Capas
- 🔀 **Cortinilla (Swipe)**: Desliza entre dos capas
- 🎭 **Superposición**: Control de opacidad para comparar
- ⬌ **División**: Pantalla dividida (vertical/horizontal)

### 🚀 Rendimiento
- Tiling dinámico para rasters grandes
- Carga lazy de capas
- Caché de tiles
- Optimización de renderizado

## 🏗️ Arquitectura

### Backend
- **Framework**: FastAPI (Python)
- **Base de Datos**: PostgreSQL + PostGIS
- **Procesamiento GIS**: 
  - Rasterio (raster)
  - Fiona (vector)
  - Laspy (nubes de puntos)
  - Ezdxf (CAD)
- **Autenticación**: JWT

### Frontend
- **Framework**: Angular 17+
- **Mapas 2D**: OpenLayers
- **Mapas 3D**: CesiumJS
- **UI**: Componentes standalone

### Infraestructura
- **Contenedores**: Docker + Docker Compose
- **Base de Datos**: PostGIS (extensión espacial de PostgreSQL)
- **Servidor Web**: Nginx (producción)

## 📦 Instalación

### Requisitos Previos
- Docker 20.10+
- Docker Compose 2.0+
- 4GB RAM mínimo
- 10GB espacio en disco

### Instalación Rápida

```bash
# 1. Clonar repositorio
git clone <url-repositorio>
cd NewGeovisor-1

# 2. Configurar variables de entorno
# Crear archivo backend/.env con la estructura indicada abajo

# 3. Levantar servicios
docker-compose up -d --build

# 4. Crear usuario administrador
docker-compose exec backend python create_admin.py
```

### Configuración del Archivo .env

Debes crear manualmente el archivo `backend/.env` con la siguiente estructura:

```env
# Configuración de Base de Datos
DATABASE_URL=postgresql://usuario:contraseña@host:puerto/nombre_db

# Seguridad JWT
SECRET_KEY=tu_clave_secreta_muy_segura_aqui
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# Entorno
ENV=development
ALLOWED_ORIGINS=http://localhost:4200,http://localhost
```

**Descripción de las variables:**

- `DATABASE_URL`: Cadena de conexión a PostgreSQL
  - Formato: `postgresql://usuario:contraseña@host:puerto/nombre_db`
  - Ejemplo local: `postgresql://postgres:mipassword@localhost:5432/geovisor_db`
  - Ejemplo Docker: `postgresql://postgres:mipassword@db:5432/geovisor_db`

- `SECRET_KEY`: Clave secreta para firmar tokens JWT
  - Generar con: `openssl rand -hex 32`
  - **IMPORTANTE**: Cambiar en producción

- `ALGORITHM`: Algoritmo de encriptación JWT (mantener `HS256`)

- `ACCESS_TOKEN_EXPIRE_MINUTES`: Tiempo de expiración del token en minutos
  - `1440` = 24 horas

- `ENV`: Entorno de ejecución
  - Valores: `development`, `production`

- `ALLOWED_ORIGINS`: Orígenes permitidos para CORS (separados por comas)
  - Desarrollo: `http://localhost:4200,http://localhost`
  - Producción: `https://tu-dominio.com`

**⚠️ IMPORTANTE**: El archivo `.env` NO se sube al repositorio (está en `.gitignore`). Cada desarrollador debe crear su propia copia con sus credenciales locales.

La aplicación estará disponible en:
- Frontend: http://localhost
- Backend API: http://localhost:8000
- Docs API: http://localhost:8000/docs

Ver [DEPLOYMENT.md](./DEPLOYMENT.md) para instrucciones detalladas.

## 🔐 Seguridad

### Variables de Entorno Críticas

```env
# CAMBIAR EN PRODUCCIÓN
POSTGRES_PASSWORD=contraseña_segura
SECRET_KEY=clave_jwt_generada_con_openssl
ALLOWED_ORIGINS=https://tu-dominio.com
```

### Archivos Protegidos (.gitignore)
- ✅ Variables de entorno (.env)
- ✅ Archivos cargados (uploads/)
- ✅ Claves y certificados (*.key, *.pem)
- ✅ Archivos geoespaciales grandes
- ✅ Bases de datos locales

## 📚 Uso

### 1. Crear un Proyecto
```
Login → Dashboard → Nuevo Proyecto → Completar formulario
```

### 2. Organizar con Carpetas
```
Proyecto → Nueva Carpeta → Asignar nombre
```

### 3. Subir Archivos
```
Proyecto → Subir Archivos → Seleccionar formato → Asignar a carpeta (opcional)
```

### 4. Visualizar Capas
```
Mapa → Panel de Capas → Activar/Desactivar → Ajustar opacidad
```

### 5. Comparar Capas
```
Herramientas → Comparar Capas → Seleccionar 2 capas → Elegir modo
```

### 6. Cambiar Mapa Base
```
Panel de Capas → Mapa Base → Seleccionar estilo
```

## 🛠️ Desarrollo

### Estructura del Proyecto

```
NewGeovisor-1/
├── backend/
│   ├── main.py              # API principal
│   ├── models.py            # Modelos de base de datos
│   ├── schemas.py           # Schemas Pydantic
│   ├── file_processor.py    # Procesador de archivos GIS
│   ├── gis_service.py       # Servicios GIS
│   ├── crud.py              # Operaciones CRUD
│   ├── database.py          # Configuración DB
│   ├── requirements.txt     # Dependencias Python
│   └── Dockerfile           # Imagen Docker backend
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/  # Componentes Angular
│   │   │   ├── services/    # Servicios
│   │   │   └── models/      # Modelos TypeScript
│   │   └── environments/    # Configuración
│   ├── package.json         # Dependencias Node
│   └── Dockerfile           # Imagen Docker frontend
│
├── docker-compose.yml       # Orquestación de servicios
├── .gitignore               # Archivos ignorados
├── README.md                # Este archivo
└── DEPLOYMENT.md            # Guía de despliegue
```

### Comandos de Desarrollo

```bash
# Backend
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload

# Frontend
cd frontend
npm install
ng serve

# Base de datos
docker-compose up -d db
```

## 🧪 Testing

```bash
# Backend
pytest

# Frontend
ng test

# E2E
ng e2e
```

## 📊 API Documentation

La documentación interactiva de la API está disponible en:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### Endpoints Principales

#### Autenticación
- `POST /token` - Login
- `GET /users/me` - Usuario actual

#### Proyectos
- `GET /projects/` - Listar proyectos
- `POST /projects/` - Crear proyecto
- `GET /projects/{id}` - Obtener proyecto
- `DELETE /projects/{id}` - Eliminar proyecto

#### Carpetas
- `POST /folders/` - Crear carpeta
- `GET /projects/{id}/folders` - Listar carpetas
- `DELETE /folders/{id}` - Eliminar carpeta

#### Capas
- `POST /upload` - Subir archivos
- `GET /projects/{id}/layers` - Listar capas
- `PATCH /layers/{id}` - Actualizar capa
- `POST /layers/{id}/toggle-visibility` - Alternar visibilidad
- `POST /layers/{id}/set-opacity` - Establecer opacidad
- `DELETE /layers/{id}` - Eliminar capa

#### Tiles
- `GET /tiles/{filename}/{z}/{x}/{y}.png` - Obtener tile

## 🤝 Contribución

Este proyecto está diseñado para integrarse en sistemas más grandes. Para contribuir:

1. Fork el repositorio
2. Crear rama feature (`git checkout -b feature/AmazingFeature`)
3. Commit cambios (`git commit -m 'Add AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abrir Pull Request

## 📝 Changelog

### v2.0.0 (2026-02-02)
- ✨ Soporte para múltiples formatos (LAS, LAZ, OBJ, DWG, DXF, KMZ, KML)
- ✨ Sistema de carpetas jerárquicas
- ✨ Comparación de capas (swipe, opacity, split)
- ✨ Selector de mapas base
- ✨ Control de visibilidad y opacidad de capas
- 🗑️ Eliminación de herramientas de medición
- 🐳 Mejoras en Docker y despliegue
- 🔒 Mejoras de seguridad (.gitignore actualizado)

### v1.0.0 (2025-12-XX)
- 🎉 Versión inicial
- Visualización 2D y 3D
- Soporte básico de formatos
- Autenticación JWT

## 📄 Licencia

[Especificar licencia]

## 👥 Equipo

Desarrollado para integración en sistemas empresariales de gestión geoespacial.

## 📞 Soporte

Para problemas o preguntas:
- Issues: [GitHub Issues]
- Documentación: [DEPLOYMENT.md](./DEPLOYMENT.md)
- API Docs: http://localhost:8000/docs

---

**Nota**: Este geovisor está optimizado para integrarse como módulo en sistemas más grandes. Asegúrate de configurar correctamente las variables de entorno y la seguridad antes del despliegue en producción.
