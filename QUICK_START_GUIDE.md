# 🚀 Próximos Pasos: Guía de Ejecución

Este documento te guía paso a paso para poner en funcionamiento el sistema de análisis geográfico de registros.

## 📋 Requisitos Previos

✅ Verificar que tienes:

- Python 3.9+ instalado
- Git configurado
- Acceso SSH a `34.75.253.101` (servidor GCP)
- Archivo de clave SSH en `C:/Users/cgrub/Downloads/ssh_gcp_key`
- MongoDB corriendo en el servidor remoto

## 🔧 Paso 1: Instalar Dependencias (Backend)

### 1.1 Activar el entorno virtual

```powershell
# Windows PowerShell
cd backend
.\.venv\Scripts\Activate.ps1

# Linux/Mac
source .venv/bin/activate
```

### 1.2 Instalar/actualizar paquetes

```bash
pip install -r requirements.txt
```

**Salida esperada:**
```
Successfully installed pymongo-4.6.1 sshtunnel-0.4.0 pandas-2.2.0 ...
```

## 🔍 Paso 2: Validar la Configuración (Backend)

### 2.1 Verificar archivo .env

```bash
# Abre en tu editor favorito
cat .env

# O usa PowerShell
Get-Content .env
```

**Debería contener:**
```
SSH_HOST=34.75.253.101
SSH_USER=mgamboa
SSH_KEY_PATH=C:/Users/cgrub/Downloads/ssh_gcp_key
SSH_PASSPHRASE=b1t4c0r4MAB@gg
MONGO_PORT=27017
DB_NAME=segmab
```

### 2.2 Ejecutar diagnóstico

```bash
cd backend
python run_geographic_analysis.py --info
```

**Salida esperada:**
```
======================================================
  INFORMACIÓN DE CONFIGURACIÓN
======================================================

🔒 Configuración SSH:
   SSH_HOST: 34.75.253.101
   SSH_USER: mgamboa
   SSH_KEY_PATH: C:/Users/cgrub/Downloads/ssh_gcp_key

🗄️  Configuración MongoDB:
   MONGO_PORT: 27017
   DB_NAME: segmab

🗂️  Rutas:
   KML Base Path: uploads
   Reportes: report/

   Archivos KML/KMZ encontrados: X
```

## 📁 Paso 3: Preparar Archivos KML

### 3.1 Revisar archivos actuales

```bash
# Windows PowerShell
Get-ChildItem "backend\uploads" -Filter "*.kml" | Select-Object Name
Get-ChildItem "backend\uploads" -Filter "*.kmz" | Select-Object Name

# Linux/Mac
ls -la backend/uploads/*.kml
ls -la backend/uploads/*.kmz
```

### 3.2 Obtener PIDs de proyectos

```bash
cd backend
python -c "
import os
from sshtunnel import SSHTunnelForwarder
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

with SSHTunnelForwarder(
    (os.getenv('SSH_HOST'), 22),
    ssh_username=os.getenv('SSH_USER'),
    ssh_pkey=os.getenv('SSH_KEY_PATH'),
    ssh_private_key_password=os.getenv('SSH_PASSPHRASE').encode(),
    remote_bind_address=('127.0.0.1', int(os.getenv('MONGO_PORT'))),
    set_keepalive=30.0
) as server:
    client = MongoClient('127.0.0.1', server.local_bind_port)
    db = client[os.getenv('DB_NAME')]
    
    print('✅ Conexión a MongoDB exitosa!')
    print(f'\n📊 Proyectos en base de datos:\n')
    
    for project in db.projects.find({}, {'_id': 1, 'name': 1}).limit(10):
        print(f'   PID: {project[\"_id\"]} → {project.get(\"name\", \"Sin nombre\")}')
"
```

### 3.3 Renombrar archivos KML según PID

Consulta [KML_NAMING_GUIDE.md](../KML_NAMING_GUIDE.md) para renombrar tus archivos KML.

**Ejemplo:**
```powershell
# Windows PowerShell
Rename-Item "backend\uploads\AEROPUERTO PASTO.kml" -NewName "backend\uploads\5f231f11682b965f9889826c.kml"
Rename-Item "backend\uploads\av68.kml" -NewName "backend\uploads\60a4c2b3d8e9f1a2b3c4d5e6.kml"
```

## 🧪 Paso 4: Ejecutar Prueba desde CLI

### 4.1 Menú interactivo

```bash
cd backend
python run_geographic_analysis.py
```

Le solicitará:
1. Selecciona opción 1 (Generar Reporte Global)
2. Ingresa fecha inicial: `2026-01-01`
3. Ingresa fecha final: `2026-03-31`

**Salida esperada:**
```
⏳ Conectando a MongoDB...
✅ Túnel SSH establecido
🔍 Consultando base de datos...
📍 Procesando 245 registros...

✅ ¡REPORTE GENERADO EXITOSAMENTE!
📁 Archivo: report/Reporte_20260312_143200.xlsx
📊 Total de registros: 245

📈 Estadísticas de clasificación:
   - EN OBRA: 180
   - EN OFICINA: 45
   - UBICACIÓN EXTERNA: 20
```

### 4.2 Línea de comandos

```bash
# Reporte global para un período
python run_geographic_analysis.py --global --inicio 2026-01-01 --fin 2026-03-31

# Reporte filtrado por proyecto
python run_geographic_analysis.py --filtrado --pid 5f231f11682b965f9889826c --inicio 2026-01-01 --fin 2026-03-31

# Mostrar configuración
python run_geographic_analysis.py --info
```

## 🌐 Paso 5: Iniciar el Servidor FastAPI

### 5.1 Activar backend

```bash
cd backend
uvicorn main:app --reload --port 8000
```

**Salida esperada:**
```
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     Application startup complete
```

### 5.2 Verificar documentación interactiva

Abre en navegador:
```
http://localhost:8000/docs
```

Deberías ver Swagger UI con todos los endpoints, incluyendo:
- POST `/api/v1/geographic-records/generar-reporte`
- GET `/api/v1/geographic-records/descargar/{filename}`
- GET `/api/v1/geographic-records/info`

## 🧪 Paso 6: Probar API desde cURL o Postman

### 6.1 Obtener token JWT

Si requiere autenticación, primero obtén un token:

```bash
# Registra un usuario (si no existe)
curl -X POST http://localhost:8000/users/ \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "testpass123",
    "full_name": "Test User"
  }'

# Obtén el token
curl -X POST http://localhost:8000/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=testuser&password=testpass123"
```

Esto retorna algo como:
```json
{"access_token": "eyJ0eXAiOiJKV1QiLC...", "token_type": "bearer"}
```

### 6.2 Generar reporte

```bash
curl -X POST http://localhost:8000/api/v1/geographic-records/generar-reporte \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "fecha_inicio": "2026-01-01",
    "fecha_fin": "2026-03-31",
    "pid_filtro": null,
    "user_filtro": null,
    "nombre_proyecto_filtro": null
  }'
```

**Respuesta esperada:**
```json
{
  "status": "success",
  "mensaje": "Reporte generado exitosamente con 245 registros",
  "archivo": "report/Reporte_Registros_20260312_143200.xlsx",
  "total_registros": 245,
  "estadisticas": {
    "EN OBRA": 180,
    "EN OFICINA": 45,
    "UBICACIÓN EXTERNA": 20
  },
  "url_descarga": "/files/Reporte_Registros_20260312_143200.xlsx",
  "timestamp": "20260312_143200"
}
```

### 6.3 Descargar reporte

```bash
curl -X GET http://localhost:8000/api/v1/geographic-records/descargar/Reporte_Registros_20260312_143200.xlsx \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -o reporte.xlsx
```

## 💻 Paso 7: Integrar en Frontend Angular (Opcional)

### 7.1 Crear componente

```bash
cd frontend
ng generate component components/geographic-records
```

### 7.2 Copiar archivos

Copia los contenidos de:
- `COMPONENT_EXAMPLE_TypeScript.ts` → `src/app/components/geographic-records/geographic-records.component.ts`
- `COMPONENT_EXAMPLE_Template.html` → `src/app/components/geographic-records/geographic-records.component.html`
- `COMPONENT_EXAMPLE_Styles.scss` → `src/app/components/geographic-records/geographic-records.component.scss`

### 7.3 Actualizar módulo

En `src/app/app.module.ts`, importa:
```typescript
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';

@NgModule({
  imports: [
    // ...
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatTableModule,
    MatChipsModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    ReactiveFormsModule,
    HttpClientModule
  ]
})
```

### 7.4 Iniciar servidor frontend

```bash
cd frontend
ng serve --open
```

Accede a:
```
http://localhost:4200
```

## 📊 Paso 8: Verificar Resultados

### 8.1 Revisar archivo Excel generado

```bash
# La carpeta de reportes estará llena de archivos
ls -la backend/report/

# Con Windows PowerShell
Get-ChildItem -Path "backend\report" -Filter "*.xlsx" | Select-Object Name, LastWriteTime
```

### 8.2 Validar contenido

El archivo Excel tendrá estas columnas:
- Proyecto
- Colaborador
- Cargo
- Correo
- Fecha del registro
- Formato
- Norte (Lat)
- Este (Lon)
- Coordenadas_Google
- Clasificación (EN OBRA / EN OFICINA / UBICACIÓN EXTERNA)
- URL Registro

## 🎯 Paso 9: Monitoreo en Producción

### 9.1 Crear cronjob (Linux/Mac)

```bash
# Editar crontab
crontab -e

# Agregar línea para ejecutar reporte diario a las 2 AM
0 2 * * * cd /ruta/a/NewGeovisor-1/backend && python run_geographic_analysis.py --global --inicio $(date -d "yesterday" +\%Y-\%m-\%d) --fin $(date +\%Y-\%m-\%d) >> /var/log/geovisor-reports.log 2>&1
```

### 9.2 Crear tarea programada (Windows)

```powershell
# Crear archivo batch: generate_report.bat
@echo off
cd C:\Users\cgrub\OneDrive\Documents\NewGeovisor-1\backend
call .venv\Scripts\Activate.ps1
python run_geographic_analysis.py --global --inicio 2026-01-01 --fin 2026-03-31
pause
```

Luego crear una tarea programada en Windows Task Scheduler.

### 9.3 Revisar logs

```bash
# Ver logs en tiempo real
tail -f backend/report/reporte.log

# O en PowerShell
Get-Content -Path "backend\report\reporte.log" -Wait
```

## ✅ Checklist Final

- [ ] Dependencias instaladas (`pip install -r requirements.txt`)
- [ ] Variables de entorno verificadas (`.env`)
- [ ] Diagnóstico completado (`--info`)
- [ ] Archivos KML renombrados según PID
- [ ] Primera ejecución exitosa (CLI)
- [ ] Backend corriendo (`uvicorn`)
- [ ] API testeable en `http://localhost:8000/docs`
- [ ] Reporte generado y disponible en `/report/`
- [ ] Frontend integrado (opcional)
- [ ] Datos validados en Excel

## 📞 Troubleshooting Rápido

| Problema | Solución |
|----------|----------|
| "SSH connection failed" | Verifica `SSH_HOST`, `SSH_USER`, `SSH_KEY_PATH` en `.env` |
| "MongoDB timeout" | Verifica que SSH esté accesible, conexión de red |
| "Archivo KML no encontrado" | Verifica que está en `backend/uploads/{pid}.kml` |
| "No records found" | Verifica fechas en MongoDB, hay datos en ese período |
| "Import error" | Reinstala: `pip install -r requirements.txt` |
| "Port 8000 in use" | Usa otro puerto: `uvicorn main:app --port 8001` |

## 🎓 Documentación Completa

- [GEOGRAPHIC_RECORDS_README.md](../GEOGRAPHIC_RECORDS_README.md) - Descripción del sistema
- [KML_NAMING_GUIDE.md](../KML_NAMING_GUIDE.md) - Cómo nombrar archivos KML
- [ANGULAR_INTEGRATION_GUIDE.md](frontend/ANGULAR_INTEGRATION_GUIDE.md) - Integración frontend
- [promt.md](promt.md) - Especificación original del proyecto

## 🚀 ¡Listo!

Una vez completados todos los pasos, tendrás:

✅ Sistema de análisis geográfico funcionando  
✅ API REST lista para consultas  
✅ CLI para ejecución manual  
✅ Interfaz Angular (opcional)  
✅ Reportes en Excel automáticos  
✅ Integración con MongoDB  
✅ Clasificación de ubicaciones  

¡Adelante! 🎉

---

**Última actualización**: 12 de marzo de 2026  
**Versión**: 1.0
