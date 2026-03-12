# Guía de Nombrado de Archivos KML/KMZ

## Estructura de Carpeta `uploads/`

Los archivos KML/KMZ deben guardarse en la carpeta `backend/uploads/` con el siguiente patrón:

```
backend/uploads/
├── {pid}.kml                      # Polígono del área de obra
├── {pid}_oficina.kml              # Polígono del área de oficina
├── {pid}.kmz                      # Alternativa comprimida
├── {pid}_oficina.kmz              # Alternativa comprimida
└── ... más proyectos
```

## Ejemplos Reales

Si tienes un proyecto con `pid = "5f231f11682b965f9889826c"`:

```
backend/uploads/
├── 5f231f11682b965f9889826c.kml
├── 5f231f11682b965f9889826c_oficina.kml
└── ...
```

Si solo tienes el archivo de obra, está bien (la oficina será opcional):

```
backend/uploads/
├── 60a4c2b3d8e9f1a2b3c4d5e6.kml
└── ...
```

## Cómo Renombrar Archivos Existentes

Si tienes archivos con nombres actuales diferentes, debes renombrarlos:

**Opción 1: Manual (Windows Explorer)**
1. Abre `backend/uploads/`
2. Haz clic derecho en cada archivo → Renombrar
3. Usa el patrón: `{pid}.kml` o `{pid}_oficina.kml`

**Opción 2: PowerShell (Script Automático)**

```powershell
# Cambiar a la carpeta
cd C:\Users\cgrub\OneDrive\Documents\NewGeovisor-1\backend\uploads

# Ejemplo: Renombrar un archivo
Rename-Item "AEROPUERTO PASTO.kml" -NewName "5f231f11682b965f9889826c.kml"

# Para renombrar múltiples archivos, crea un mapping
$mapping = @{
    "ABSCISADO_G9.kml" = "5f231f11682b965f9889826c.kml"
    "AEROPUERTO PASTO.kml" = "60a4c2b3d8e9f1a2b3c4d5e6_oficina.kml"
    "av68.kml" = "60a4c2b3d8e9f1a2b3c4d5e7.kml"
}

foreach ($old in $mapping.Keys) {
    $new = $mapping[$old]
    Rename-Item $old -NewName $new
    Write-Host "Renombrado: $old → $new"
}
```

**Opción 3: Python Script**

```python
import os
from pathlib import Path

# Mapping del PID a los archivos
mapping = {
    "5f231f11682b965f9889826c": "AEROPUERTO PASTO.kml",
    "5f231f11682b965f9889826c_oficina": "ABSCISADO_G9.kml",
    "60a4c2b3d8e9f1a2b3c4d5e6": "av68.kml",
}

uploads_dir = Path("backend/uploads")

for pid, old_filename in mapping.items():
    old_path = uploads_dir / old_filename
    new_path = uploads_dir / f"{pid}.kml"
    
    if old_path.exists():
        old_path.rename(new_path)
        print(f"✅ Renombrado: {old_filename} → {new_path.name}")
    else:
        print(f"❌ Archivo no encontrado: {old_filename}")
```

## Estructura de un Archivo KML Válido

Un arquivo KML válido debe tener esta estructura básica:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <name>Nombre del polígono (Obra)</name>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>
              -74.0088,4.7110,0
              -74.0085,4.7110,0
              -74.0085,4.7115,0
              -74.0088,4.7115,0
              -74.0088,4.7110,0
            </coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>
  </Document>
</kml>
```

### Puntos Importantes:
- **Coordenadas en orden: longitud, latitud, elevación**
- **Sistema de coordenadas: WGS84 (EPSG:4326)**
- **El anillo debe cerrarse**: primer punto = último punto
- **Un solo Polygon por Placemark** (el sistema usa el primero encontrado)

## Validar Archivos KML

Puedes validar que tus archivos KML sean correctos:

```python
from geographic_records import GeographicRecordsAnalyzer

# Crear instancia
analyzer = GeographicRecordsAnalyzer(
    ssh_host="34.75.253.101",
    ssh_user="mgamboa",
    ssh_key_path="C:/Users/cgrub/Downloads/ssh_gcp_key",
    ssh_passphrase="b1t4c0r4MAB@gg",
    mongo_port=27017,
    db_name="segmab",
    kml_base_path="uploads"
)

# Verificar que los archivos KML cargan correctamente
pid = "5f231f11682b965f9889826c"
poly_obra = analyzer.obtener_poligono_trabajo(pid)
poly_oficina = analyzer.obtener_poligono_oficina(pid)

print(f"Polígono de obra: {poly_obra is not None}")
print(f"Polígono de oficina: {poly_oficina is not None}")
```

## Cómo Exportar KML desde Google Earth o ArcGIS

### Google Earth Pro:
1. Abre Google Earth Pro
2. Dibuja el polígono (o importa uno existente)
3. Haz clic derecho → Guardar como KML

### ArcGIS:
1. Crea un Feature Layer con los polígonos
2. Selecciona la capa → Exportar a KML

### QGIS:
1. Abre QGIS
2. Carga tu shapefile o GeoJSON con los polígonos
3. Clic derecho en la capa → Exportar → Guardar como KML

## Estructura de Múltiples Proyectos

Si tienes 3 proyectos (obra + oficina):

```
backend/uploads/
├── 5f231f11682b965f9889826c.kml              # Proyecto 1 - Obra
├── 5f231f11682b965f9889826c_oficina.kml      # Proyecto 1 - Oficina
├── 60a4c2b3d8e9f1a2b3c4d5e6.kml              # Proyecto 2 - Obra
├── 60a4c2b3d8e9f1a2b3c4d5e6_oficina.kml      # Proyecto 2 - Oficina
├── 7f3d5e1b8c2a9f4d6e1c3a5b.kml              # Proyecto 3 - Obra
└── 7f3d5e1b8c2a9f4d6e1c3a5b_oficina.kml      # Proyecto 3 - Oficina
```

## Obtener PID del Proyecto

Los PIDs se encuentran en MongoDB en la colección `projects`:

```python
from pymongo import MongoClient
from sshtunnel import SSHTunnelForwarder

with SSHTunnelForwarder(
    ("34.75.253.101", 22),
    ssh_username="mgamboa",
    ssh_pkey="C:/Users/cgrub/Downloads/ssh_gcp_key",
    ssh_private_key_password=b"b1t4c0r4MAB@gg",
    remote_bind_address=('127.0.0.1', 27017),
    set_keepalive=30.0
) as server:
    client = MongoClient('127.0.0.1', server.local_bind_port)
    db = client['segmab']
    
    # Obtener todos los proyectos con sus PIDs
    projects = db.projects.find({}, {"_id": 1, "name": 1})
    
    for project in projects:
        print(f"PID: {project['_id']} → {project['name']}")
```

Esto te mostrará algo como:
```
PID: 5f231f11682b965f9889826c → Proyecto Aeropuerto Pasto
PID: 60a4c2b3d8e9f1a2b3c4d5e6 → Cicloruta Cali
PID: 7f3d5e1b8c2a9f4d6e1c3a5b → Avenida 68 Bogotá
```

## Presencia de Archivos KML en el Sistema

Para verificar qué archivos KML tienes actualmente:

```bash
# Windows PowerShell
Get-ChildItem "backend\uploads" -Filter "*.kml" | Select-Object Name

Get-ChildItem "backend\uploads" -Filter "*.kmz" | Select-Object Name

# Linux/Mac
ls -la backend/uploads/*.kml
ls -la backend/uploads/*.kmz
```

## Notas Importantes

⚠️ **El nombre del archivo es crítico:**
- Debe coincidir exactamente con el PID del proyecto en MongoDB
- No incluir espacios, acentos o caracteres especiales
- Usar guiones bajos para separar PID de "_oficina"

📝 **Archivos opcionales:**
- El archivo de "oficina" es opcional
- Si no existe, todos los puntos fuera de la obra se clasificarán como "UBICACIÓN EXTERNA"
- El archivo de "obra" es obligatorio para clasificar correctamente

✅ **Validación automática:**
- El sistema valida automáticamente que los archivos existan
- Si no existen, retorna None sin error
- Los puntos se clasifican como "UBICACIÓN EXTERNA" si no hay polígono

## Troubleshooting

**Problema:** Todos los registros se clasifican como "UBICACIÓN EXTERNA"
- Solución: Verifica que los archivos KML existan y tengan el nombre correcto

**Problema:** Error al cargar KML
- Solución: Verifica que el KML sea válido (usa validador XML online)

**Problema:** No encuentra el archivo
- Solución: Revisa la carpeta `backend/uploads/` y verifica los nombres exactos

---

**Última actualización:** 12 de marzo de 2026
