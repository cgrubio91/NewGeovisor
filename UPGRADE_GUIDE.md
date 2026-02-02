# 🚀 Guía de Actualización a Geovisor Pro v2.0

## 📋 Resumen de Cambios

Esta actualización incluye:
- ✅ Soporte para múltiples formatos (LAS, LAZ, OBJ, DWG, DXF, KMZ, KML)
- ✅ Sistema de carpetas jerárquicas
- ✅ Comparación de capas (swipe, opacity, split)
- ✅ Selector de mapas base
- ✅ Control de visibilidad y opacidad de capas
- 🗑️ Eliminación de herramientas de medición
- 🐳 Mejoras en Docker y despliegue
- 🔒 Mejoras de seguridad

## ⚠️ IMPORTANTE - Antes de Actualizar

### 1. Hacer Backup de la Base de Datos

```bash
# Backup completo
docker-compose exec db pg_dump -U geovisor_user geovisor_db > backup_$(date +%Y%m%d_%H%M%S).sql

# O si usas otro usuario
docker-compose exec db pg_dump -U <tu_usuario> <tu_db> > backup_$(date +%Y%m%d_%H%M%S).sql
```

### 2. Hacer Backup de Archivos Cargados

```bash
# Copiar carpeta uploads
cp -r backend/uploads backend/uploads_backup_$(date +%Y%m%d)
```

## 🔄 Proceso de Actualización

### Paso 1: Detener Servicios Actuales

```bash
docker-compose down
```

### Paso 2: Actualizar Código

```bash
# Si usas Git
git pull origin main

# O descargar manualmente los archivos actualizados
```

### Paso 3: Configurar Variables de Entorno

```bash
# Copiar archivo de ejemplo si no existe
cp .env.example .env

# Editar .env con tus configuraciones
nano .env  # o usar tu editor preferido
```

**Variables críticas a configurar:**

```env
# Base de datos
POSTGRES_USER=geovisor_user
POSTGRES_PASSWORD=TU_CONTRASEÑA_SEGURA
POSTGRES_DB=geovisor_db

# Backend
SECRET_KEY=TU_CLAVE_JWT_SEGURA
ALLOWED_ORIGINS=http://localhost,http://tu-dominio.com

# Puertos (opcional)
POSTGRES_PORT=5432
BACKEND_PORT=8000
FRONTEND_PORT=80
```

### Paso 4: Levantar Solo la Base de Datos

```bash
docker-compose up -d db

# Esperar a que esté saludable
docker-compose ps
```

### Paso 5: Ejecutar Migración de Base de Datos

```bash
# Opción A: Ejecutar script de migración
docker-compose exec backend python migrate_db.py

# Opción B: Migración manual con SQL
docker-compose exec db psql -U geovisor_user -d geovisor_db
```

**SQL de migración manual (si es necesario):**

```sql
-- Añadir nuevas columnas
ALTER TABLE layers ADD COLUMN IF NOT EXISTS file_format VARCHAR;
ALTER TABLE layers ADD COLUMN IF NOT EXISTS visible BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE layers ADD COLUMN IF NOT EXISTS opacity INTEGER NOT NULL DEFAULT 100;
ALTER TABLE layers ADD COLUMN IF NOT EXISTS z_index INTEGER NOT NULL DEFAULT 0;
ALTER TABLE layers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Actualizar file_format para capas existentes
UPDATE layers 
SET file_format = CASE
    WHEN layer_type = 'raster' AND file_path LIKE '%.tif%' THEN 'tiff'
    WHEN layer_type = 'raster' AND file_path LIKE '%.geotiff%' THEN 'geotiff'
    WHEN layer_type = 'vector' AND file_path LIKE '%.shp%' THEN 'shapefile'
    WHEN layer_type = '3d_model' AND file_path LIKE '%.obj%' THEN 'obj'
    WHEN file_path LIKE '%.kml%' THEN 'kml'
    WHEN file_path LIKE '%.kmz%' THEN 'kmz'
    WHEN file_path LIKE '%.las%' THEN 'las'
    WHEN file_path LIKE '%.laz%' THEN 'laz'
    ELSE layer_type
END
WHERE file_format IS NULL;

-- Verificar cambios
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'layers';
```

### Paso 6: Reconstruir y Levantar Servicios

```bash
# Reconstruir imágenes con las nuevas dependencias
docker-compose build --no-cache

# Levantar todos los servicios
docker-compose up -d

# Ver logs para verificar
docker-compose logs -f
```

### Paso 7: Verificar Instalación

```bash
# Verificar estado de servicios
docker-compose ps

# Deberías ver:
# geovisor_db       Up (healthy)
# geovisor_backend  Up (healthy)
# geovisor_frontend Up
```

**Verificar endpoints:**

- Frontend: http://localhost
- Backend: http://localhost:8000
- API Docs: http://localhost:8000/docs
- Health Check: http://localhost:8000/

### Paso 8: Probar Nuevas Funcionalidades

1. **Login** en la aplicación
2. **Crear un proyecto** o abrir uno existente
3. **Crear carpetas** para organizar capas
4. **Subir archivos** de diferentes formatos (TIFF, LAS, OBJ, etc.)
5. **Probar control de capas**:
   - Activar/desactivar visibilidad
   - Ajustar opacidad
   - Cambiar orden
6. **Probar selector de mapa base**
7. **Probar comparación de capas**

## 🔍 Verificación de Migración

### Verificar Nuevas Columnas en la Base de Datos

```bash
docker-compose exec db psql -U geovisor_user -d geovisor_db -c "\d layers"
```

Deberías ver las nuevas columnas:
- `file_format`
- `visible`
- `opacity`
- `z_index`
- `updated_at`

### Verificar Nuevas Dependencias Python

```bash
docker-compose exec backend pip list | grep -E "laspy|ezdxf"
```

Deberías ver:
- `laspy` (2.5.1 o superior)
- `ezdxf` (1.1.3 o superior)

### Verificar Logs del Backend

```bash
docker-compose logs backend | grep -i "error"
```

No deberían aparecer errores relacionados con imports o base de datos.

## 🐛 Solución de Problemas

### Error: "column does not exist"

**Causa**: La migración no se ejecutó correctamente.

**Solución**:
```bash
# Ejecutar migración manualmente
docker-compose exec backend python migrate_db.py
```

### Error: "ModuleNotFoundError: No module named 'laspy'"

**Causa**: Las nuevas dependencias no se instalaron.

**Solución**:
```bash
# Reconstruir imagen del backend
docker-compose build --no-cache backend
docker-compose up -d backend
```

### Error: "FATAL: password authentication failed"

**Causa**: Las credenciales de la base de datos no coinciden.

**Solución**:
```bash
# Verificar .env
cat .env | grep POSTGRES

# Asegurarse de que coincidan con la base de datos existente
```

### Las capas existentes no se muestran

**Causa**: Los nuevos campos no tienen valores por defecto.

**Solución**:
```bash
# Actualizar capas existentes
docker-compose exec db psql -U geovisor_user -d geovisor_db -c "
UPDATE layers SET visible = TRUE WHERE visible IS NULL;
UPDATE layers SET opacity = 100 WHERE opacity IS NULL;
UPDATE layers SET z_index = 0 WHERE z_index IS NULL;
"
```

### Error al subir archivos nuevos formatos

**Causa**: file_processor no está importado correctamente.

**Solución**:
```bash
# Verificar que file_processor.py existe
docker-compose exec backend ls -la file_processor.py

# Reiniciar backend
docker-compose restart backend
```

## 🔙 Rollback (Si es Necesario)

Si algo sale mal y necesitas volver a la versión anterior:

### 1. Detener Servicios

```bash
docker-compose down
```

### 2. Restaurar Base de Datos

```bash
# Restaurar desde backup
cat backup_YYYYMMDD_HHMMSS.sql | docker-compose exec -T db psql -U geovisor_user geovisor_db
```

### 3. Restaurar Código Anterior

```bash
# Si usas Git
git checkout <commit-anterior>

# O restaurar archivos manualmente
```

### 4. Levantar Servicios

```bash
docker-compose up -d
```

## 📊 Checklist Post-Actualización

- [ ] Base de datos migrada correctamente
- [ ] Todos los servicios están "Up (healthy)"
- [ ] Frontend carga sin errores
- [ ] Backend responde en /docs
- [ ] Login funciona correctamente
- [ ] Proyectos existentes se cargan
- [ ] Capas existentes se visualizan
- [ ] Se pueden subir archivos nuevos formatos
- [ ] Control de visibilidad funciona
- [ ] Control de opacidad funciona
- [ ] Selector de mapa base funciona
- [ ] Comparación de capas funciona
- [ ] No hay errores en logs

## 📞 Soporte

Si encuentras problemas durante la actualización:

1. **Revisar logs**:
   ```bash
   docker-compose logs -f
   ```

2. **Consultar documentación**:
   - [DEPLOYMENT.md](./DEPLOYMENT.md)
   - [README.md](./README.md)
   - [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)

3. **Verificar configuración**:
   - Variables de entorno (.env)
   - Docker Compose (docker-compose.yml)
   - Permisos de archivos

## 🎉 ¡Actualización Completada!

Si todos los pasos se completaron exitosamente, tu Geovisor Pro v2.0 está listo para usar con todas las nuevas funcionalidades.

**Nuevas características disponibles:**
- 📁 Organización con carpetas
- 🗺️ Múltiples formatos de archivo
- 🎨 Selector de mapas base
- 🔀 Comparación de capas
- 👁️ Control de visibilidad y opacidad

---

**Fecha de actualización**: 2026-02-02
**Versión**: 2.0.0
**Tiempo estimado**: 15-30 minutos
