# 🚀 Guía de Despliegue con Docker - Geovisor Pro

## 📋 Requisitos Previos

- Docker (versión 20.10 o superior)
- Docker Compose (versión 2.0 o superior)
- Mínimo 4GB de RAM disponible
- Mínimo 10GB de espacio en disco

## 🔧 Configuración Inicial

### 1. Clonar el Repositorio

```bash
git clone <url-del-repositorio>
cd NewGeovisor-1
```

### 2. Configurar Variables de Entorno

Copiar el archivo de ejemplo y editarlo:

```bash
cp .env.example .env
```

Editar el archivo `.env` y configurar las siguientes variables **IMPORTANTES**:

```env
# CAMBIAR ESTAS VARIABLES EN PRODUCCIÓN
POSTGRES_PASSWORD=tu_contraseña_segura_aqui
SECRET_KEY=tu_clave_secreta_jwt_aqui
```

Para generar una clave secreta segura:

```bash
# En Linux/Mac
openssl rand -hex 32

# En Windows (PowerShell)
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | % {[char]$_})
```

### 3. Configurar CORS (Opcional)

Si vas a acceder desde un dominio específico, actualiza `ALLOWED_ORIGINS`:

```env
ALLOWED_ORIGINS=https://tu-dominio.com,https://www.tu-dominio.com
```

## 🚀 Despliegue

### Opción 1: Despliegue Completo (Recomendado)

Construir y levantar todos los servicios:

```bash
docker-compose up -d --build
```

### Opción 2: Despliegue por Servicio

```bash
# Solo base de datos
docker-compose up -d db

# Base de datos + Backend
docker-compose up -d db backend

# Todos los servicios
docker-compose up -d
```

## 📊 Verificar el Estado

### Ver logs de todos los servicios

```bash
docker-compose logs -f
```

### Ver logs de un servicio específico

```bash
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f db
```

### Verificar que los servicios estén corriendo

```bash
docker-compose ps
```

Deberías ver algo como:

```
NAME                  STATUS              PORTS
geovisor_db          Up (healthy)        0.0.0.0:5432->5432/tcp
geovisor_backend     Up (healthy)        0.0.0.0:8000->8000/tcp
geovisor_frontend    Up                  0.0.0.0:80->80/tcp
```

## 🔍 Acceder a la Aplicación

- **Frontend**: http://localhost
- **Backend API**: http://localhost:8000
- **Documentación API**: http://localhost:8000/docs
- **Base de Datos**: localhost:5432

## 🛠️ Comandos Útiles

### Detener los servicios

```bash
docker-compose down
```

### Detener y eliminar volúmenes (⚠️ BORRA TODOS LOS DATOS)

```bash
docker-compose down -v
```

### Reiniciar un servicio

```bash
docker-compose restart backend
```

### Reconstruir un servicio

```bash
docker-compose up -d --build backend
```

### Ejecutar comandos dentro de un contenedor

```bash
# Acceder al backend
docker-compose exec backend bash

# Acceder a la base de datos
docker-compose exec db psql -U geovisor_user -d geovisor_db
```

## 🗄️ Gestión de Base de Datos

### Crear usuario administrador

```bash
docker-compose exec backend python create_admin.py
```

### Backup de la base de datos

```bash
docker-compose exec db pg_dump -U geovisor_user geovisor_db > backup_$(date +%Y%m%d).sql
```

### Restaurar base de datos

```bash
cat backup.sql | docker-compose exec -T db psql -U geovisor_user geovisor_db
```

## 📁 Estructura de Volúmenes

Los datos persistentes se almacenan en:

- **postgres_data**: Datos de PostgreSQL/PostGIS
- **./backend/uploads**: Archivos geoespaciales cargados

## 🔒 Seguridad en Producción

### Checklist de Seguridad

- [ ] Cambiar `POSTGRES_PASSWORD` por una contraseña fuerte
- [ ] Generar un `SECRET_KEY` único y seguro
- [ ] Configurar `ALLOWED_ORIGINS` solo con dominios autorizados
- [ ] Usar HTTPS en producción (configurar reverse proxy)
- [ ] Limitar acceso al puerto 5432 (solo localhost o red interna)
- [ ] Configurar firewall para exponer solo puertos necesarios
- [ ] Implementar backups automáticos de la base de datos
- [ ] Monitorear logs regularmente

### Configurar HTTPS con Nginx (Producción)

Crear archivo `nginx.conf` para reverse proxy:

```nginx
server {
    listen 443 ssl;
    server_name tu-dominio.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 🐛 Solución de Problemas

### El backend no se conecta a la base de datos

```bash
# Verificar que la base de datos esté saludable
docker-compose ps

# Ver logs de la base de datos
docker-compose logs db

# Reiniciar servicios
docker-compose restart db backend
```

### Error de permisos en uploads

```bash
# Dar permisos a la carpeta uploads
chmod -R 777 backend/uploads
```

### El frontend no se conecta al backend

Verificar la variable `API_URL` en `.env` y reconstruir:

```bash
docker-compose up -d --build frontend
```

## 📈 Monitoreo

### Ver uso de recursos

```bash
docker stats
```

### Ver espacio en disco

```bash
docker system df
```

## 🔄 Actualización

Para actualizar a una nueva versión:

```bash
# Detener servicios
docker-compose down

# Actualizar código
git pull

# Reconstruir y levantar
docker-compose up -d --build
```

## 📞 Soporte

Para problemas o preguntas, revisar:

- Logs: `docker-compose logs -f`
- Documentación API: http://localhost:8000/docs
- Issues del repositorio

---

**Nota**: Este geovisor está diseñado para integrarse en sistemas más grandes. Asegúrate de configurar correctamente las variables de entorno y la seguridad antes de desplegar en producción.
