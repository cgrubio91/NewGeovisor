# 🚀 Guía de Despliegue en Google Cloud Platform (GCP)

## 📊 Análisis de Requisitos

### Escenario de Uso
- **Usuarios concurrentes:** 200
- **Tamaño promedio de archivos:** 1 GB
- **Tipos de archivos:** LAS/LAZ (nubes de puntos), TIFF (rasters), OBJ (modelos 3D)
- **Operaciones críticas:**
  - Subida de archivos (1 GB)
  - Conversión LAS → 3D Tiles (10-20 min por archivo de 450 MB)
  - Streaming de tiles 3D
  - Visualización simultánea en Cesium

### Cálculos de Capacidad

#### Almacenamiento
```
Archivos originales: 1 GB × 200 usuarios × 5 proyectos = 1 TB
Archivos procesados (3D Tiles): 1 GB × 1.5 (overhead) = 1.5 GB por archivo
Total estimado: 2-3 TB
```

#### Ancho de Banda
```
Streaming de tiles 3D: ~50 MB/min por usuario activo
200 usuarios × 50 MB/min = 10 GB/min = 600 GB/hora (pico)
Promedio realista (30% activos): 180 GB/hora
```

#### Procesamiento
```
Conversión LAS (1 GB): ~30-40 minutos en CPU estándar
200 usuarios subiendo simultáneamente: Necesitamos procesamiento paralelo
Recomendación: 8-16 vCPUs dedicadas a conversión
```

---

## 🏗️ Arquitectura Recomendada en GCP

### Opción 1: Compute Engine + Cloud Storage (Recomendada)

```
┌─────────────────────────────────────────────────────────────────┐
│                    USUARIOS (200 concurrentes)                   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              Cloud Load Balancer (HTTPS/SSL)                     │
│                    + Cloud CDN (tiles estáticos)                 │
└────────────────────────────┬────────────────────────────────────┘
                             │
                ┌────────────┴────────────┐
                │                         │
                ▼                         ▼
┌───────────────────────────┐  ┌───────────────────────────┐
│  Frontend (Angular)       │  │  Backend (FastAPI)        │
│  Cloud Storage Bucket     │  │  Compute Engine VM        │
│  (Static Hosting)         │  │  n2-standard-8            │
│                           │  │  8 vCPUs, 32 GB RAM       │
└───────────────────────────┘  └──────────┬────────────────┘
                                          │
                    ┌─────────────────────┼─────────────────────┐
                    │                     │                     │
                    ▼                     ▼                     ▼
        ┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐
        │ Cloud SQL         │ │ Cloud Storage     │ │ Cloud Tasks       │
        │ (PostgreSQL +     │ │ - Archivos        │ │ (Conversiones     │
        │  PostGIS)         │ │   originales      │ │  asíncronas)      │
        │ db-n1-standard-4  │ │ - 3D Tiles        │ │                   │
        │ 4 vCPUs, 15 GB    │ │ - Rasters COG     │ │                   │
        └───────────────────┘ └───────────────────┘ └───────────────────┘
```

### Componentes Detallados

#### 1. **Frontend: Cloud Storage + Cloud CDN**
- **Servicio:** Cloud Storage Bucket (Static Website Hosting)
- **CDN:** Cloud CDN para distribución global
- **Costo:** ~$0.026/GB almacenamiento + $0.08/GB transferencia (CDN)

**Configuración:**
```bash
# Crear bucket para frontend
gsutil mb -c STANDARD -l us-central1 gs://geovisor-frontend

# Subir build de Angular
cd frontend
ng build --configuration production
gsutil -m cp -r dist/geovisor/* gs://geovisor-frontend/

# Hacer público
gsutil iam ch allUsers:objectViewer gs://geovisor-frontend

# Configurar como sitio web
gsutil web set -m index.html -e index.html gs://geovisor-frontend
```

#### 2. **Backend: Compute Engine VM**

**Especificaciones Recomendadas:**

| Componente | Especificación | Justificación |
|------------|----------------|---------------|
| **Tipo de VM** | n2-standard-8 | 8 vCPUs para procesamiento paralelo |
| **RAM** | 32 GB | Conversión de archivos grandes (1 GB) |
| **CPU** | Intel Cascade Lake | Mejor rendimiento en GDAL/py3dtiles |
| **Disco Boot** | 50 GB SSD | Sistema operativo + dependencias |
| **Disco Datos** | 100 GB SSD | Archivos temporales durante conversión |
| **Región** | us-central1 | Baja latencia, bajo costo |
| **SO** | Ubuntu 22.04 LTS | Compatibilidad con GDAL 3.6+ |

**Costo Estimado:** ~$260/mes (con descuento por uso sostenido)

**Script de Creación:**
```bash
gcloud compute instances create geovisor-backend \
    --zone=us-central1-a \
    --machine-type=n2-standard-8 \
    --image-family=ubuntu-2204-lts \
    --image-project=ubuntu-os-cloud \
    --boot-disk-size=50GB \
    --boot-disk-type=pd-ssd \
    --create-disk=size=100GB,type=pd-ssd,auto-delete=yes \
    --tags=http-server,https-server \
    --metadata=startup-script='#!/bin/bash
        apt-get update
        apt-get install -y python3.11 python3-pip postgresql-client
        apt-get install -y gdal-bin libgdal-dev python3-gdal
        pip3 install fastapi uvicorn sqlalchemy psycopg2-binary
        pip3 install rasterio py3dtiles trimesh
    '
```

#### 3. **Base de Datos: Cloud SQL (PostgreSQL + PostGIS)**

**Especificaciones:**

| Componente | Especificación | Justificación |
|------------|----------------|---------------|
| **Tipo** | db-n1-standard-4 | 4 vCPUs, 15 GB RAM |
| **Almacenamiento** | 100 GB SSD | Metadatos de proyectos/capas |
| **Backups** | Automáticos diarios | Retención 7 días |
| **Alta Disponibilidad** | Regional (opcional) | Para producción crítica |
| **Versión PostgreSQL** | 15 | Última estable con PostGIS 3.3 |

**Costo Estimado:** ~$200/mes (sin HA), ~$400/mes (con HA)

**Creación:**
```bash
gcloud sql instances create geovisor-db \
    --database-version=POSTGRES_15 \
    --tier=db-n1-standard-4 \
    --region=us-central1 \
    --storage-size=100GB \
    --storage-type=SSD \
    --storage-auto-increase \
    --backup-start-time=03:00 \
    --maintenance-window-day=SUN \
    --maintenance-window-hour=04

# Crear base de datos
gcloud sql databases create geovisor_db --instance=geovisor-db

# Habilitar PostGIS
gcloud sql connect geovisor-db --user=postgres
# En psql:
CREATE EXTENSION postgis;
CREATE EXTENSION postgis_topology;
```

#### 4. **Almacenamiento de Archivos: Cloud Storage**

**Buckets Recomendados:**

| Bucket | Propósito | Clase de Almacenamiento | Costo/GB/mes |
|--------|-----------|-------------------------|--------------|
| `geovisor-uploads` | Archivos originales (.las, .tiff) | Standard | $0.020 |
| `geovisor-processed` | Archivos procesados (3D Tiles, COG) | Standard | $0.020 |
| `geovisor-cache` | Tiles generados dinámicamente | Nearline | $0.010 |

**Configuración:**
```bash
# Crear buckets
gsutil mb -c STANDARD -l us-central1 gs://geovisor-uploads
gsutil mb -c STANDARD -l us-central1 gs://geovisor-processed
gsutil mb -c NEARLINE -l us-central1 gs://geovisor-cache

# Configurar CORS para acceso desde frontend
cat > cors.json << EOF
[
  {
    "origin": ["https://geovisor.tudominio.com"],
    "method": ["GET", "HEAD", "PUT", "POST"],
    "responseHeader": ["Content-Type", "Range"],
    "maxAgeSeconds": 3600
  }
]
EOF

gsutil cors set cors.json gs://geovisor-uploads
gsutil cors set cors.json gs://geovisor-processed

# Configurar lifecycle (borrar archivos temporales después de 30 días)
cat > lifecycle.json << EOF
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "Delete"},
        "condition": {
          "age": 30,
          "matchesPrefix": ["temp/"]
        }
      }
    ]
  }
}
EOF

gsutil lifecycle set lifecycle.json gs://geovisor-uploads
```

#### 5. **Procesamiento Asíncrono: Cloud Tasks**

**Propósito:** Reemplazar `BackgroundTasks` de FastAPI con sistema persistente.

**Ventajas:**
- ✅ Tareas persisten si el servidor se reinicia
- ✅ Reintentos automáticos en caso de fallo
- ✅ Escalabilidad automática
- ✅ Monitoreo integrado

**Configuración:**
```bash
# Crear cola de tareas
gcloud tasks queues create geovisor-conversions \
    --max-concurrent-dispatches=10 \
    --max-dispatches-per-second=5 \
    --max-attempts=3 \
    --min-backoff=60s \
    --max-backoff=3600s
```

**Código Backend (main.py):**
```python
from google.cloud import tasks_v2
import json

tasks_client = tasks_v2.CloudTasksClient()
project = 'tu-proyecto-gcp'
queue = 'geovisor-conversions'
location = 'us-central1'

parent = tasks_client.queue_path(project, location, queue)

@app.post("/upload")
async def upload_files(...):
    # Guardar archivo
    layer = create_layer(...)
    
    # Crear tarea asíncrona en Cloud Tasks
    task = {
        'http_request': {
            'http_method': tasks_v2.HttpMethod.POST,
            'url': f'https://tu-backend.com/process-3d',
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({
                'layer_id': layer.id,
                'file_path': file_path
            }).encode()
        }
    }
    
    response = tasks_client.create_task(request={'parent': parent, 'task': task})
    
    return layer

@app.post("/process-3d")
async def process_3d_endpoint(data: dict):
    # Este endpoint es llamado por Cloud Tasks
    layer_id = data['layer_id']
    file_path = data['file_path']
    
    # Ejecutar conversión
    process_3d_pipeline(file_path, layer_id)
    
    return {"status": "completed"}
```

---

## 🔧 Configuración Paso a Paso

### Paso 1: Preparar el Proyecto GCP

```bash
# Instalar gcloud CLI
curl https://sdk.cloud.google.com | bash
exec -l $SHELL

# Inicializar
gcloud init

# Crear proyecto
gcloud projects create geovisor-prod --name="Geovisor Pro"
gcloud config set project geovisor-prod

# Habilitar APIs necesarias
gcloud services enable compute.googleapis.com
gcloud services enable sqladmin.googleapis.com
gcloud services enable storage.googleapis.com
gcloud services enable cloudtasks.googleapis.com
gcloud services enable cloudcdn.googleapis.com
```

### Paso 2: Configurar Networking

```bash
# Crear VPC personalizada
gcloud compute networks create geovisor-vpc \
    --subnet-mode=custom

# Crear subnet
gcloud compute networks subnets create geovisor-subnet \
    --network=geovisor-vpc \
    --region=us-central1 \
    --range=10.0.0.0/24

# Configurar firewall
gcloud compute firewall-rules create allow-http \
    --network=geovisor-vpc \
    --allow=tcp:80,tcp:443 \
    --source-ranges=0.0.0.0/0

gcloud compute firewall-rules create allow-internal \
    --network=geovisor-vpc \
    --allow=tcp:0-65535,udp:0-65535,icmp \
    --source-ranges=10.0.0.0/24
```

### Paso 3: Desplegar Backend

**Crear archivo de configuración `.env` en la VM:**
```bash
# Conectar a la VM
gcloud compute ssh geovisor-backend --zone=us-central1-a

# Crear directorio de aplicación
sudo mkdir -p /opt/geovisor
sudo chown $USER:$USER /opt/geovisor
cd /opt/geovisor

# Clonar repositorio (o subir archivos)
git clone https://github.com/tu-usuario/geovisor.git
cd geovisor/backend

# Crear .env
cat > .env << EOF
DATABASE_URL=postgresql://postgres:TU_PASSWORD@10.0.0.3:5432/geovisor_db
SECRET_KEY=$(openssl rand -hex 32)
ALLOWED_ORIGINS=https://geovisor.tudominio.com
GCS_BUCKET_UPLOADS=geovisor-uploads
GCS_BUCKET_PROCESSED=geovisor-processed
GOOGLE_CLOUD_PROJECT=geovisor-prod
EOF

# Instalar dependencias
pip3 install -r requirements.txt

# Crear servicio systemd
sudo cat > /etc/systemd/system/geovisor.service << EOF
[Unit]
Description=Geovisor Backend
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=/opt/geovisor/backend
Environment="PATH=/usr/local/bin:/usr/bin:/bin"
ExecStart=/usr/local/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# Iniciar servicio
sudo systemctl daemon-reload
sudo systemctl enable geovisor
sudo systemctl start geovisor
```

### Paso 4: Configurar Load Balancer + SSL

```bash
# Reservar IP estática
gcloud compute addresses create geovisor-ip \
    --global

# Obtener IP
gcloud compute addresses describe geovisor-ip --global

# Crear certificado SSL (Let's Encrypt)
gcloud compute ssl-certificates create geovisor-cert \
    --domains=geovisor.tudominio.com \
    --global

# Crear backend service
gcloud compute backend-services create geovisor-backend-service \
    --protocol=HTTP \
    --port-name=http \
    --health-checks=geovisor-health-check \
    --global

# Añadir VM al backend
gcloud compute backend-services add-backend geovisor-backend-service \
    --instance-group=geovisor-ig \
    --instance-group-zone=us-central1-a \
    --global

# Crear URL map
gcloud compute url-maps create geovisor-lb \
    --default-service=geovisor-backend-service

# Crear proxy HTTPS
gcloud compute target-https-proxies create geovisor-https-proxy \
    --url-map=geovisor-lb \
    --ssl-certificates=geovisor-cert

# Crear forwarding rule
gcloud compute forwarding-rules create geovisor-https-rule \
    --address=geovisor-ip \
    --global \
    --target-https-proxy=geovisor-https-proxy \
    --ports=443
```

### Paso 5: Desplegar Frontend

```bash
# En tu máquina local
cd frontend

# Configurar environment para producción
cat > src/environments/environment.prod.ts << EOF
export const environment = {
  production: true,
  apiUrl: 'https://api.geovisor.tudominio.com'
};
EOF

# Build
ng build --configuration production

# Subir a Cloud Storage
gsutil -m cp -r dist/geovisor/* gs://geovisor-frontend/

# Configurar Cloud CDN
gcloud compute backend-buckets create geovisor-frontend-bucket \
    --gcs-bucket-name=geovisor-frontend \
    --enable-cdn
```

---

## 💰 Estimación de Costos Mensual

### Configuración Recomendada (200 usuarios)

| Servicio | Especificación | Costo/mes |
|----------|----------------|-----------|
| **Compute Engine** | n2-standard-8 (8 vCPUs, 32 GB) | $260 |
| **Cloud SQL** | db-n1-standard-4 (4 vCPUs, 15 GB) | $200 |
| **Cloud Storage** | 3 TB (uploads + processed) | $60 |
| **Cloud CDN** | 500 GB/mes transferencia | $40 |
| **Load Balancer** | HTTPS + reglas | $20 |
| **Cloud Tasks** | 1M operaciones/mes | $0.40 |
| **Networking** | Egress 1 TB/mes | $120 |
| **Backups** | Cloud SQL backups | $10 |
| **Monitoreo** | Cloud Monitoring | $10 |
| **TOTAL** | | **~$720/mes** |

### Optimizaciones para Reducir Costos

1. **Usar Preemptible VMs para conversión** (70% descuento)
   ```bash
   gcloud compute instances create geovisor-worker \
       --preemptible \
       --machine-type=n2-standard-4
   ```
   **Ahorro:** ~$150/mes

2. **Lifecycle policies en Cloud Storage**
   - Mover archivos antiguos a Nearline después de 30 días
   - Mover a Coldline después de 90 días
   **Ahorro:** ~$20/mes

3. **Committed Use Discounts** (1 año)
   - 37% descuento en Compute Engine
   **Ahorro:** ~$100/mes

**Costo Optimizado:** ~$450/mes

---

## 📈 Escalabilidad Automática

### Auto-scaling para Backend

```bash
# Crear template de instancia
gcloud compute instance-templates create geovisor-template \
    --machine-type=n2-standard-8 \
    --image-family=ubuntu-2204-lts \
    --image-project=ubuntu-os-cloud \
    --boot-disk-size=50GB \
    --metadata-from-file=startup-script=startup.sh

# Crear grupo de instancias administrado
gcloud compute instance-groups managed create geovisor-ig \
    --base-instance-name=geovisor-backend \
    --template=geovisor-template \
    --size=1 \
    --zone=us-central1-a

# Configurar auto-scaling
gcloud compute instance-groups managed set-autoscaling geovisor-ig \
    --max-num-replicas=5 \
    --min-num-replicas=1 \
    --target-cpu-utilization=0.7 \
    --cool-down-period=300 \
    --zone=us-central1-a
```

**Comportamiento:**
- **Carga baja:** 1 instancia (~$260/mes)
- **Carga media (50-100 usuarios):** 2-3 instancias (~$520-780/mes)
- **Carga alta (150-200 usuarios):** 4-5 instancias (~$1040-1300/mes)

---

## 🔒 Seguridad en Producción

### 1. Identity-Aware Proxy (IAP)

```bash
# Proteger acceso a la VM
gcloud compute instances add-iam-policy-binding geovisor-backend \
    --member=user:tu-email@gmail.com \
    --role=roles/iap.tunnelResourceAccessor \
    --zone=us-central1-a
```

### 2. Secret Manager para Credenciales

```bash
# Crear secretos
echo -n "tu-password-db" | gcloud secrets create db-password --data-file=-
echo -n "tu-secret-key-jwt" | gcloud secrets create jwt-secret --data-file=-

# Dar acceso a la VM
gcloud secrets add-iam-policy-binding db-password \
    --member=serviceAccount:COMPUTE_SERVICE_ACCOUNT \
    --role=roles/secretmanager.secretAccessor
```

**Modificar backend para usar Secret Manager:**
```python
from google.cloud import secretmanager

client = secretmanager.SecretManagerServiceClient()
project_id = "geovisor-prod"

def get_secret(secret_id):
    name = f"projects/{project_id}/secrets/{secret_id}/versions/latest"
    response = client.access_secret_version(request={"name": name})
    return response.payload.data.decode("UTF-8")

DATABASE_PASSWORD = get_secret("db-password")
SECRET_KEY = get_secret("jwt-secret")
```

### 3. Cloud Armor (WAF)

```bash
# Crear política de seguridad
gcloud compute security-policies create geovisor-waf

# Bloquear IPs sospechosas
gcloud compute security-policies rules create 1000 \
    --security-policy=geovisor-waf \
    --expression="origin.region_code == 'CN' || origin.region_code == 'RU'" \
    --action=deny-403

# Rate limiting
gcloud compute security-policies rules create 2000 \
    --security-policy=geovisor-waf \
    --expression="true" \
    --action=rate-based-ban \
    --rate-limit-threshold-count=100 \
    --rate-limit-threshold-interval-sec=60

# Aplicar al backend
gcloud compute backend-services update geovisor-backend-service \
    --security-policy=geovisor-waf \
    --global
```

---

## 📊 Monitoreo y Alertas

### Cloud Monitoring Dashboard

```bash
# Crear dashboard personalizado
gcloud monitoring dashboards create --config-from-file=dashboard.json
```

**dashboard.json:**
```json
{
  "displayName": "Geovisor Metrics",
  "mosaicLayout": {
    "columns": 12,
    "tiles": [
      {
        "width": 6,
        "height": 4,
        "widget": {
          "title": "CPU Usage",
          "xyChart": {
            "dataSets": [{
              "timeSeriesQuery": {
                "timeSeriesFilter": {
                  "filter": "resource.type=\"gce_instance\" AND metric.type=\"compute.googleapis.com/instance/cpu/utilization\""
                }
              }
            }]
          }
        }
      },
      {
        "width": 6,
        "height": 4,
        "widget": {
          "title": "Active Conversions",
          "xyChart": {
            "dataSets": [{
              "timeSeriesQuery": {
                "timeSeriesFilter": {
                  "filter": "resource.type=\"cloud_tasks_queue\" AND metric.type=\"cloudtasks.googleapis.com/queue/depth\""
                }
              }
            }]
          }
        }
      }
    ]
  }
}
```

### Alertas Críticas

```bash
# Alerta: CPU > 90% por 5 minutos
gcloud alpha monitoring policies create \
    --notification-channels=CHANNEL_ID \
    --display-name="High CPU Usage" \
    --condition-display-name="CPU > 90%" \
    --condition-threshold-value=0.9 \
    --condition-threshold-duration=300s \
    --condition-filter='resource.type="gce_instance" AND metric.type="compute.googleapis.com/instance/cpu/utilization"'

# Alerta: Disco > 80%
gcloud alpha monitoring policies create \
    --notification-channels=CHANNEL_ID \
    --display-name="Disk Almost Full" \
    --condition-threshold-value=0.8 \
    --condition-filter='resource.type="gce_instance" AND metric.type="compute.googleapis.com/instance/disk/utilization"'
```

---

## 🚀 Checklist de Despliegue

### Pre-Despliegue
- [ ] Crear proyecto en GCP
- [ ] Configurar facturación
- [ ] Habilitar APIs necesarias
- [ ] Configurar dominio DNS (A record → IP del Load Balancer)
- [ ] Generar certificado SSL

### Infraestructura
- [ ] Crear VPC y subnets
- [ ] Configurar firewall rules
- [ ] Crear Cloud SQL instance
- [ ] Crear Cloud Storage buckets
- [ ] Configurar Cloud Tasks queue

### Backend
- [ ] Crear VM Compute Engine
- [ ] Instalar dependencias (GDAL, Python, etc.)
- [ ] Configurar variables de entorno
- [ ] Migrar base de datos (crear tablas)
- [ ] Configurar systemd service
- [ ] Probar endpoints

### Frontend
- [ ] Build de producción
- [ ] Subir a Cloud Storage
- [ ] Configurar Cloud CDN
- [ ] Probar acceso público

### Seguridad
- [ ] Configurar IAP
- [ ] Migrar secretos a Secret Manager
- [ ] Configurar Cloud Armor (WAF)
- [ ] Configurar backups automáticos

### Monitoreo
- [ ] Crear dashboard de métricas
- [ ] Configurar alertas críticas
- [ ] Configurar logs centralizados
- [ ] Probar notificaciones

### Testing
- [ ] Prueba de carga (200 usuarios simulados)
- [ ] Prueba de subida de archivo 1 GB
- [ ] Prueba de conversión LAS → 3D Tiles
- [ ] Prueba de visualización 3D
- [ ] Prueba de failover (si hay HA)

---

## 🆘 Troubleshooting Común

### Problema: Conversión LAS muy lenta

**Solución:** Usar VM con más vCPUs o crear workers dedicados
```bash
# Crear worker dedicado para conversiones
gcloud compute instances create geovisor-worker \
    --machine-type=c2-standard-16 \  # 16 vCPUs optimizadas para cómputo
    --zone=us-central1-a
```

### Problema: Timeout en subida de archivos grandes

**Solución:** Aumentar timeout en Load Balancer
```bash
gcloud compute backend-services update geovisor-backend-service \
    --timeout=1800s \  # 30 minutos
    --global
```

### Problema: Costos muy altos

**Solución:**
1. Revisar Cloud Storage lifecycle policies
2. Habilitar Committed Use Discounts
3. Usar Preemptible VMs para workers
4. Configurar auto-scaling más agresivo

---

## 📞 Recursos Adicionales

- **Documentación GCP:** https://cloud.google.com/docs
- **Calculadora de Costos:** https://cloud.google.com/products/calculator
- **Soporte GCP:** https://cloud.google.com/support
- **Comunidad:** https://stackoverflow.com/questions/tagged/google-cloud-platform

---

**Última actualización:** 12 de febrero de 2026
