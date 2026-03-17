# Consulta de Registros Geográficos en el Mapa

Se ha implementado una nueva funcionalidad en Geovisor Pro que permite consultar registros de MongoDB y visualizarlos como marcadores en el mapa.

## Lo que se ha hecho

### Backend (Python/FastAPI)

1. **Actualización del endpoint `/api/v1/geographic-records/generar-reporte`**
 - Ahora devuelve también un array de `records` además del reporte Excel
 - Cada registro incluye coordenadas en formato GeoJSON
 - Las coordenadas se preservan tanto en string format como en objeto `{lat, lon}`

2. **Importaciones nuevas**
 - Agregado `import pandas as pd` para procesar DataFrames

### Frontend (Angular)

1. **Nuevo Servicio: `geographic-records.service.ts`**
 - Métodos para consultar MongoDB filtrado
 - Conversión de registros a formato GeoJSON
 - Parseo de coordenadas desde múltiples fuentes

2. **Componente actualizado: `GeographicRecordsComponent`**
 - Formulario con filtros:
 - Fecha inicial y final (requeridos)
 - Proyecto (opcional)
 - Usuario (opcional)
 - Nombre de proyecto (opcional)
 - Vista de resultados con:
 - Tabla de registros encontrados
 - Estadísticas (EN OBRA, EN OFICINA, UBICACIÓN EXTERNA)
 - Botón para cargar registros al mapa
 - Posibilidad de descargar reporte Excel

3. **Menu actualizado**
 - Nueva opción " Registros" en el menú principal
 - Ubicado entre "Visor de Mapas" y "Usuarios"
 - Accesible para todos los usuarios

4. **Estilos mejorados**
 - Interfaz moderna con gradientes
 - Cards para estadísticas
 - Tabla responsive con información de coordenadas
 - Estados de carga y animaciones

## Cómo usar

### 1. Ejecutar el servidor

El servidor FastAPI ya está corriendo. Si necesitas reiniciarlo:

```bash
cd backend
uvicorn main:app --reload --port 8000
```

### 2. Acceder a la sección de Registros

1. Inicia sesión en Geovisor Pro
2. En el menú superior, haz clic en **" Registros"**
3. Se abrirá la interfaz de consulta

### 3. Filtrar registros

1. **Fecha inicial y final**: Selecciona el rango de fechas (obligatorio)
2. **Proyecto** (opcional): Selecciona un proyecto específico
3. **Usuario** (opcional): Escribe el email o nombre del usuario
4. **Nombre Proyecto** (opcional): Busca por nombre de proyecto

Luego haz clic en **" Buscar Registros"**

### 4. Ver resultados

Una vez ejecutada la búsqueda, verás:
- **Cards de estadísticas** con los conteos de cada clasificación
- **Tabla con los registros** encontrados
- **Información de coordenadas** para cada registro (cuando disponibles)

### 5. Visualizar en el mapa

Haz clic en el botón **"Mostrar X Registros en el Mapa"** para:
1. Convertir los registros a marcadores en OpenLayers
2. Navegar automáticamente al visor de mapas
3. Ver los puntos ubicados en su correcta posición geográfica

### 6. Descargar reporte

Usa el botón **"Descargar Excel"** en la esquina superior para:
1. Generar un archivo .xlsx con los registros
2. Incluye todas las columnas: Proyecto, Usuario, Cargo, Correo, Fecha, Formato, Coordenadas, Clasificación, etc.
3. Descargar automáticamente el archivo

## Estructura de datos esperados

### Registros en MongoDB

Cada registro debe tener:

```javascript
{
 _id: ObjectId,
 project_id: "id_del_proyecto",
 user: "email@usuario.com",
 date: "2026-03-12T10:30:00Z",
 format: "KML",
 coordinates_google: "4.711,-74.006", // ← Formato esperado: "lat,lon"
 coords: { // ← O en este formato
 lat: 4.711,
 lon: -74.006
 },
 // ... otros campos
}
```

## Características visuales

- **Colores por clasificación**:
 - 🟢 **EN OBRA**: Verde (#51cf66)
 - 🟡 **EN OFICINA**: Amarillo (#ffd43b)
 - **UBICACIÓN EXTERNA**: Azul (#74c0fc)

- **Tabla interactiva**:
 - Filas con fondo tenue cuando tienen coordenadas
 - Íconos indicadores para navegación
 - Información clara de ubicación

## Personalización

### Cambiar colores de clasificación

Edita [geographic-records.css](frontend/src/app/components/geographic-records/geographic-records.css):

```css
.classification.en-obra {
 background: rgba(81, 207, 102, 0.2);
 color: #51cf66;
}
```

### Agregar campos adicionales

En [geographic-records.service.ts](frontend/src/app/services/geographic-records.service.ts), método `recordsToGeoJSON`:

```typescript
properties: {
 user: record.user,
 date: record.date,
 // Agregar más campos aquí
}
```

## Troubleshooting

### Los registros no aparecen en el mapa

1. Verifica que los registros tengan coordenadas válidas
2. Asegúrate que están en formato: `"lat,lon"` o con objeto `{lat, lon}`
3. Revisa la consola del navegador (F12) para errores

### El mapa no aparece

- Recarga la página (F5)
- Verifica que el servidor FastAPI está corriendo
- Comprueba los logs en la consola del navegador

### Error "No hay registros con coordenadas"

- Los registros deben tener coordenadas válidas en MongoDB
- Verifica que el campo `coordinates_google` o `coords` está poblado
- Revisa que no hay valores nulos o inválidos

## Archivos modificados

### Backend
- `backend/main.py` - Actualizado endpoint generar-reporte
- `backend/requirements.txt` - Ya incluye todas las dependencias

### Frontend
- `frontend/src/app/services/geographic-records.service.ts` - **NUEVO**
- `frontend/src/app/components/geographic-records/geographic-records.ts` - Actualizado
- `frontend/src/app/components/geographic-records/geographic-records.html` - **NUEVO CONTENIDO**
- `frontend/src/app/components/geographic-records/geographic-records.css` - **NUEVO CONTENIDO**
- `frontend/src/app/app.routes.ts` - Ruta agregada
- `frontend/src/app/components/header/header.component.ts` - Menú actualizado

## Próximos pasos (Opcional)

1. **Clustered markers** - Agrupar puntos cercanos en zoom out
2. **Popup con información** - Al hacer clic en un marcador
3. **Filtros en tiempo real** - Actualizar mapa mientras escribes
4. **Exportar como KML** - Guardar los registros como archivo KML
5. **Estadísticas por zona** - Mostrar gráficos de distribución

## Soporte

Si encuentras problemas:
1. Revisa los logs del backend: `uvicorn main:app --reload`
2. Abre la consola del navegador (F12) para errores de JavaScript
3. Verifica la conexión a MongoDB: `python backend/run_geographic_analysis.py --info`

---

**Versión**: 1.0 
**Fecha**: 12 de marzo de 2026 
**Estado**: 🟢 Funcional y listo para producción
