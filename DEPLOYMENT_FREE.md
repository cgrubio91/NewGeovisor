# 🎁 Despliegue GRATIS para Demo - Railway.app

## ⚡ Opción Más Rápida: Railway.app

### Ventajas
- ✅ **100% Gratis** para demos ($5 crédito mensual)
- ✅ **5 minutos** de configuración
- ✅ **SSL automático** (HTTPS)
- ✅ **PostgreSQL incluido** con PostGIS
- ✅ **Deploy automático** desde GitHub
- ✅ **URL pública** (ej: `geovisor-demo.up.railway.app`)

### Limitaciones
- ⚠️ $5/mes = ~100 horas de servidor activo
- ⚠️ Archivos limitados a 500 MB (suficiente para demo)
- ⚠️ No soporta archivos muy pesados (usar archivos de prueba pequeños)

---

## 📋 Guía Paso a Paso

### Paso 1: Preparar el Repositorio

```bash
# En tu proyecto local
cd C:\Users\cgrub\OneDrive\Documents\NewGeovisor-1

# Inicializar Git (si no lo has hecho)
git init
git add .
git commit -m "Initial commit for Railway deployment"

# Crear repositorio en GitHub
# Ve a https://github.com/new y crea un repo llamado "geovisor-demo"

# Conectar y subir
git remote add origin https://github.com/TU_USUARIO/geovisor-demo.git
git branch -M main
git push -u origin main
```

### Paso 2: Configurar Backend para Railway

**Crear `railway.json` en la raíz del proyecto:**
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

**Crear `Procfile` en `/backend`:**
```
web: uvicorn main:app --host 0.0.0.0 --port $PORT
```

**Crear `runtime.txt` en `/backend`:**
```
python-3.11.7
```

**Actualizar `requirements.txt` en `/backend`:**
```txt
fastapi==0.109.0
uvicorn[standard]==0.27.0
sqlalchemy==2.0.25
psycopg2-binary==2.9.9
pydantic==2.5.3
pydantic-settings==2.1.0
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.6
rasterio==1.3.9
pyproj==3.6.1

# Para Railway (sin GDAL pesado)
# Usar versiones ligeras para demo
```

**IMPORTANTE:** Crear `backend/main_railway.py` (versión simplificada sin GDAL):
```python
# Copiar todo de main.py pero comentar imports de GDAL/rasterio
# Solo para archivos que no requieren conversión pesada

import os
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
import shutil

# ... resto del código igual ...

# Comentar funciones que usan GDAL:
# - process_raster_pipeline (solo para demo)
# - get_raster_info

# Mantener:
# - process_3d_pipeline (funciona sin GDAL)
# - Todos los endpoints de autenticación
# - CRUD de proyectos/capas
```

### Paso 3: Desplegar en Railway

1. **Ir a https://railway.app**
2. **Sign up** con GitHub
3. **New Project** → **Deploy from GitHub repo**
4. Seleccionar `geovisor-demo`
5. Railway detectará automáticamente Python

**Configurar Variables de Entorno:**
```bash
# En Railway Dashboard → Variables
DATABASE_URL=${{Postgres.DATABASE_URL}}  # Auto-generada
SECRET_KEY=tu-secret-key-aqui-generar-uno-nuevo
ALLOWED_ORIGINS=*
PORT=8000
```

6. **Add PostgreSQL Plugin**
   - Click en "+ New"
   - Seleccionar "Database" → "PostgreSQL"
   - Railway lo conecta automáticamente

7. **Habilitar PostGIS:**
   - En el dashboard de PostgreSQL, click en "Connect"
   - Copiar el comando `psql`
   - Ejecutar en tu terminal local:
   ```bash
   # Conectar a la BD de Railway
   psql postgresql://postgres:PASSWORD@HOST:PORT/railway
   
   # Habilitar PostGIS
   CREATE EXTENSION postgis;
   CREATE EXTENSION postgis_topology;
   ```

8. **Deploy!**
   - Railway desplegará automáticamente
   - Obtendrás una URL como: `https://geovisor-backend-production.up.railway.app`

### Paso 4: Desplegar Frontend

**Opción A: Netlify (Recomendada para frontend)**

1. **Ir a https://netlify.com**
2. **Sign up** con GitHub
3. **New site from Git** → Seleccionar repo
4. **Configurar build:**
   ```
   Base directory: frontend
   Build command: npm run build
   Publish directory: frontend/dist/geovisor
   ```

5. **Variables de entorno:**
   ```
   API_URL=https://geovisor-backend-production.up.railway.app
   ```

6. **Deploy!**
   - Obtendrás URL como: `https://geovisor-demo.netlify.app`

**Opción B: Vercel**

1. **Ir a https://vercel.com**
2. **Import Project** desde GitHub
3. Configurar:
   ```
   Framework Preset: Angular
   Root Directory: frontend
   Build Command: npm run build
   Output Directory: dist/geovisor
   ```

### Paso 5: Conectar Frontend con Backend

**Actualizar `frontend/src/environments/environment.prod.ts`:**
```typescript
export const environment = {
  production: true,
  apiUrl: 'https://geovisor-backend-production.up.railway.app'
};
```

**Commit y push:**
```bash
git add .
git commit -m "Configure production environment"
git push
```

Netlify/Vercel re-desplegará automáticamente.

---

## 🎯 Alternativa: Google Cloud Free Tier

### Configuración Mínima Gratuita

**VM e2-micro (Always Free):**
```bash
gcloud compute instances create geovisor-demo \
    --zone=us-central1-a \
    --machine-type=e2-micro \
    --image-family=ubuntu-2204-lts \
    --image-project=ubuntu-os-cloud \
    --boot-disk-size=30GB \
    --tags=http-server,https-server
```

**Limitaciones:**
- Solo 1 vCPU compartida
- 1 GB RAM
- **NO** puede convertir archivos grandes
- **SÍ** puede servir archivos ya convertidos

**Uso recomendado:**
- Convierte archivos localmente en tu PC
- Sube archivos ya procesados (3D Tiles, COG)
- Usa la VM solo para servir

---

## 💡 Estrategia para Demo con Gerencia

### 1. Preparar Datos de Prueba Ligeros

**En lugar de archivos de 1 GB, usa:**
- Nubes de puntos: 50-100 MB (suficiente para demo visual)
- Rasters: 20-50 MB
- Modelos 3D: 10-30 MB

**Convertir localmente antes de subir:**
```bash
# En tu PC local
cd backend

# Convertir LAS pequeño
py3dtiles convert uploads/demo_small.las --out uploads/demo_tiles --disable-processpool

# Subir a Railway/GCP solo los archivos procesados
```

### 2. Script de Demo

**Crear `DEMO_SETUP.md`:**
```markdown
# Demo Setup - Geovisor Pro

## Datos de Prueba Incluidos

1. **Nube de Puntos "Centro Urbano"** (50 MB)
   - Ya convertida a 3D Tiles
   - Visualización instantánea

2. **Ortofoto "Zona Industrial"** (30 MB)
   - Formato COG (Cloud Optimized GeoTIFF)
   - Streaming eficiente

3. **Modelo 3D "Edificio Corporativo"** (15 MB)
   - Formato GLB
   - Rotación y transformación

## Flujo de Demo (10 minutos)

1. **Login** (usuario: demo@geovisor.com, pass: Demo2024!)
2. **Dashboard** - Mostrar estadísticas
3. **Crear Proyecto** - "Proyecto Piloto Gerencia"
4. **Subir Capa** - Nube de puntos pre-convertida
5. **Visualización 3D** - Modo Studio
6. **Comparación** - Swipe entre 2 ortofotosmosaicos
7. **Descarga** - Archivo original

## URLs

- **Frontend:** https://geovisor-demo.netlify.app
- **Backend:** https://geovisor-backend.up.railway.app
- **Docs API:** https://geovisor-backend.up.railway.app/docs
```

### 3. Presentación

**Puntos clave para la gerencia:**
- ✅ "Sistema 100% funcional en la nube"
- ✅ "Accesible desde cualquier dispositivo con internet"
- ✅ "Visualización 3D de alta calidad"
- ✅ "Escalable a 200+ usuarios" (mostrar documentación)
- ✅ "Costo estimado: $450-720/mes en producción"

---

## 📊 Comparación de Opciones Gratuitas

| Opción | Facilidad | Tiempo Setup | Limitaciones | Mejor Para |
|--------|-----------|--------------|--------------|------------|
| **Railway** | ⭐⭐⭐⭐⭐ | 10 min | $5/mes crédito | Demo rápida |
| **Render** | ⭐⭐⭐⭐ | 15 min | Duerme después de 15 min | Demo ocasional |
| **GCP Free Tier** | ⭐⭐⭐ | 30 min | VM muy pequeña | Demo + aprendizaje |
| **Netlify + Railway** | ⭐⭐⭐⭐⭐ | 20 min | Combinación perfecta | **RECOMENDADO** |

---

## 🚀 Despliegue Express (30 minutos)

```bash
# 1. Subir a GitHub (5 min)
git init
git add .
git commit -m "Deploy to Railway"
git push origin main

# 2. Railway Backend (10 min)
# - Crear cuenta
# - Conectar repo
# - Añadir PostgreSQL
# - Configurar variables

# 3. Netlify Frontend (10 min)
# - Crear cuenta
# - Conectar repo
# - Configurar build
# - Deploy

# 4. Probar (5 min)
# - Abrir URL de Netlify
# - Login
# - Subir capa de prueba
# - Visualizar en 3D
```

---

## 💰 Costo Real de Demo

| Servicio | Costo | Duración |
|----------|-------|----------|
| Railway | $0 (crédito $5) | 1-2 meses |
| Netlify | $0 (plan free) | Ilimitado |
| GCP Free Tier | $0 ($300 crédito) | 3 meses |
| **TOTAL** | **$0** | **1-3 meses** |

Después de la demo, si aprueban:
- Migrar a configuración de producción (~$450/mes)
- O seguir en Railway con plan Pro ($20/mes) para uso ligero

---

**Última actualización:** 12 de febrero de 2026
