# NewGeovisor - Sistema de Visualización Geoespacial

## 📋 Descripción

NewGeovisor (Geovisor Pro) es una aplicación web moderna y profesional para la visualización y análisis de datos geoespaciales. Desarrollada para GMab Geomática, esta herramienta permite cargar, visualizar y comparar diferentes tipos de archivos GIS con una interfaz de usuario premium y altamente intuitiva.

## 🎨 Diseño y UI/UX

El proyecto implementa un sistema de diseño corporativo moderno basado en la identidad visual de GMab Geomática:

- **Paleta de Colores Corporativa**:
  - **Primario**: Azul Navy (#163255) para fondos y estructura
  - **Acento**: Cian (#00c1d2) para acciones y elementos destacados
  - **Notificaciones**: Naranja (#ff671c) para alertas y badges
- **Tipografía**: Combinación profesional de `Montserrat` (títulos), `Open Sans` (cuerpo) y `Dosis` (detalles).
- **Componentes**: Diseño basado en tarjetas con efectos de glassmorphism, sombras suaves y transiciones fluidas.
- **Header**: Navegación superior persistente con acceso rápido a herramientas principales.

## 🏗️ Arquitectura

El proyecto está dividido en dos componentes principales:

### Backend (FastAPI)

- **Framework**: FastAPI (Python)
- **Funcionalidades**:
  - Carga de archivos geoespaciales
  - Procesamiento de datos raster (GeoTIFF)
  - Conversión de KML a GeoJSON
  - Servicio de tiles para visualización de raster
  - API RESTful para comunicación con el frontend

### Frontend (Angular)

- **Framework**: Angular 19
- **Librerías de mapas**:
  - OpenLayers para visualización 2D
  - Soporte para CesiumJS (3D) en desarrollo
- **Funcionalidades**:
  - Visualización interactiva de mapas
  - Control de capas (visibilidad, opacidad)
  - Herramienta de comparación Swipe
  - Carga de archivos múltiples

## 🚀 Instalación y Configuración

### Requisitos Previos

- Python 3.8 o superior
- Node.js 18 o superior
- npm o yarn

### Configuración del Backend

1. Navegar a la carpeta del backend:

```bash
cd backend
```

2. Crear y activar un entorno virtual:

```bash
# Windows
python -m venv venv
venv\Scripts\activate

# Linux/Mac
python3 -m venv venv
source venv/bin/activate
```

3. Instalar dependencias:

```bash
pip install -r requirements.txt
```

4. Iniciar el servidor:

```bash
python main.py
```

El servidor estará disponible en `http://localhost:8000`

### Configuración del Frontend

1. Navegar a la carpeta del frontend:

```bash
cd frontend
```

2. Instalar dependencias:

```bash
npm install
```

3. Iniciar el servidor de desarrollo:

```bash
npm start
```

La aplicación estará disponible en `http://localhost:4200`

## 📁 Estructura del Proyecto

```
NewGeovisor/
├── backend/                    # Servidor FastAPI
│   ├── main.py                # Punto de entrada de la API
│   ├── gis_service.py         # Servicios de procesamiento GIS
│   ├── requirements.txt       # Dependencias Python
│   └── uploads/               # Archivos cargados (ignorado en git)
│
├── frontend/                   # Aplicación Angular
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/    # Componentes de la UI
│   │   │   │   ├── layer-control/    # Control de capas
│   │   │   │   └── upload/           # Carga de archivos
│   │   │   └── services/      # Servicios Angular
│   │   │       ├── api.service.ts    # Comunicación con backend
│   │   │       └── map.service.ts    # Gestión del mapa
│   │   └── ...
│   ├── package.json           # Dependencias Node
│   └── angular.json           # Configuración Angular
│
├── data/                       # Datos de ejemplo
└── README.md                   # Este archivo
```

## 🎯 Funcionalidades Principales

### 1. Carga de Archivos

- Soporte para múltiples formatos:
  - **Raster**: GeoTIFF (.tif, .geotiff)
  - **Vectorial**: KML (.kml)
- Carga múltiple de archivos simultáneos
- Extracción automática de metadatos

### 2. Visualización de Mapas

- Mapa base de OpenStreetMap
- Visualización de capas raster mediante tiles
- Visualización de capas vectoriales
- Navegación interactiva (zoom, pan)
- Centro por defecto en Bogotá, Colombia

### 3. Control de Capas

- Lista de capas cargadas
- Toggle de visibilidad por capa
- Control de opacidad (0-100%)
- Identificación única de cada capa

### 4. Herramienta Swipe

- Comparación visual entre capas
- Control deslizante para ajustar la posición
- Activación por capa individual

## 🔧 API Endpoints

### GET `/`

Verifica el estado del servidor.

**Respuesta:**

```json
{
  "message": "GIS Geovisor API is running"
}
```

### POST `/upload`

Carga uno o más archivos geoespaciales.

**Parámetros:**

- `files`: Array de archivos (multipart/form-data)

**Respuesta:**

```json
{
  "uploaded": [
    {
      "filename": "ejemplo.tif",
      "path": "uploads/ejemplo.tif",
      "metadata": {
        "crs": "EPSG:4326",
        "width": 1024,
        "height": 1024,
        "bounds": [-74.1, 4.6, -73.9, 4.8],
        "bands": 3
      }
    }
  ]
}
```

### GET `/tiles/{filename}/{z}/{x}/{y}.png`

Obtiene un tile de una imagen raster.

**Parámetros:**

- `filename`: Nombre del archivo raster
- `z`: Nivel de zoom
- `x`: Coordenada X del tile
- `y`: Coordenada Y del tile

**Respuesta:** Imagen PNG (256x256 píxeles)

## 🛠️ Tecnologías Utilizadas

### Backend

- **FastAPI**: Framework web moderno y rápido
- **Rasterio**: Procesamiento de datos raster
- **fastkml**: Procesamiento de archivos KML
- **Pillow**: Manipulación de imágenes
- **NumPy**: Operaciones numéricas

### Frontend

- **Angular 19**: Framework de aplicación web
- **OpenLayers**: Biblioteca de mapas 2D
- **RxJS**: Programación reactiva
- **TypeScript**: Lenguaje tipado

## 📝 Notas de Desarrollo

### Procesamiento de Raster

El backend implementa un servidor de tiles básico que:

1. Convierte coordenadas de tiles (Z/X/Y) a coordenadas geográficas
2. Lee la ventana correspondiente del raster
3. Normaliza los valores de píxeles
4. Genera una imagen PNG de 256x256

### Gestión de Capas

El servicio de mapas mantiene:

- Lista reactiva de capas
- Estado de visibilidad y opacidad
- Referencias a instancias de OpenLayers
- Sincronización automática con la UI

### Herramienta Swipe

Implementada usando eventos de renderizado de OpenLayers:

- `prerender`: Aplica clipping al contexto del canvas
- `postrender`: Restaura el contexto
- Actualización en tiempo real del mapa

## 🔜 Próximas Funcionalidades

- [ ] Integración completa de CesiumJS para visualización 3D
- [ ] Soporte para más formatos (Shapefile, GeoJSON, etc.)
- [ ] Herramientas de medición (distancia, área)
- [ ] Análisis espacial básico
- [ ] Exportación de mapas
- [ ] Gestión de proyectos
- [ ] Autenticación de usuarios
- [ ] Base de datos para persistencia

## 🐛 Solución de Problemas

### El backend no inicia

- Verificar que el entorno virtual esté activado
- Verificar que todas las dependencias estén instaladas
- Verificar que el puerto 8000 no esté en uso

### El frontend no se conecta al backend

- Verificar que el backend esté corriendo en `http://localhost:8000`
- Verificar la configuración de CORS en `main.py`
- Revisar la consola del navegador para errores

### Los archivos no se cargan

- Verificar que la carpeta `uploads` exista
- Verificar permisos de escritura
- Verificar que el formato del archivo sea compatible

### Los tiles no se visualizan

- Verificar que el archivo sea un GeoTIFF válido
- Verificar que el archivo tenga un sistema de coordenadas
- Revisar logs del backend para errores de procesamiento

## 📄 Licencia

Este proyecto es de código abierto y está disponible bajo la licencia MIT.

## 👥 Contribuciones

Las contribuciones son bienvenidas. Por favor:

1. Fork el repositorio
2. Crea una rama para tu feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit tus cambios (`git commit -am 'Agrega nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Crea un Pull Request

## 📧 Contacto

Para preguntas o sugerencias, por favor abre un issue en el repositorio.

---

**Última actualización**: Enero 2026
