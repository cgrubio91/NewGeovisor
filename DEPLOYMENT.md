# Guía de Despliegue en Producción - NewGeovisor

Este documento describe los pasos necesarios para desplegar la aplicación utilizando la nueva arquitectura profesional basada en Docker.

## 🚀 Requisitos Previos
- Servidor con Linux (Ubuntu 22.04 recomendado).
- Docker y Docker Compose instalados.
- Un dominio apuntando a la IP del servidor.

## 🛠️ Pasos para el Despliegue

### 1. Clonar el Repositorio
```bash
git clone https://github.com/cgrubio91/NewGeovisor.git
cd NewGeovisor
```

### 2. Configurar Variables de Entorno
Crea un archivo `.env` en la raíz del proyecto (o usa el de `backend/.env` como base):
```bash
cp backend/.env.example backend/.env
```
Edita `backend/.env` y asegúrate de cambiar:
- `SECRET_KEY`: Una cadena larga y aleatoria.
- `ALLOWED_ORIGINS`: Tu dominio real (ej. `https://geovisor.gmab.com`).

### 3. Iniciar con Docker Compose
Desde la raíz del proyecto, ejecuta:
```bash
docker-compose up -d --build
```
Este comando:
1. Levantará una base de datos **PostGIS**.
2. Construirá y ejecutará el **Backend** con Gunicorn.
3. Construirá el **Frontend** de Angular y lo servirá con Nginx.

### 4. Verificación
- Frontend: `http://tu-ip-o-dominio`
- Backend API: `http://tu-ip-o-dominio/api/`
- Documentación API: `http://tu-ip-o-dominio/api/docs`

## 🔒 Recomendaciones de Seguridad Adicionales
1. **HTTPS**: Se recomienda usar un proxy inverso adicional (como Nginx Proxy Manager o Traefik) con Let's Encrypt para habilitar SSL.
2. **Firewall**: Abre solo los puertos 80 (HTTP) y 443 (HTTPS). El puerto 8000 y 5432 están protegidos dentro de la red de Docker.
3. **Backups**: Configura un cronjob para realizar volcados de la base de datos PostgreSQL periódicamente.

## 📁 Estructura de Archivos Creados/Modificados
- `backend/database.py`: Ahora usa Pydantic Settings para variables de entorno.
- `backend/main.py`: Seguridad reforzada y CORS dinámico.
- `backend/Dockerfile`: Imagen optimizada para GIS.
- `backend/requirements.txt`: Versiones fijas para evitar errores.
- `frontend/src/app/services/api.service.ts`: URL de API inteligente (detecta entorno).
- `frontend/Dockerfile`: Build multi-etapa con Nginx.
- `frontend/nginx.conf`: Configuración de proxy inverso.
- `docker-compose.yml`: Orquestación completa del sistema.
