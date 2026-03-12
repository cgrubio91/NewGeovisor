# Guía de Integración: Componente Angular para Análisis Geográfico

## 📋 Descripción

Este documento proporciona instrucciones paso a paso para integrar el componente Angular de análisis geográfico de registros en la aplicación Geovisor.

## 📁 Archivos Incluidos

1. **COMPONENT_EXAMPLE_TypeScript.ts** - Lógica del componente (CoTS)
2. **COMPONENT_EXAMPLE_Template.html** - Plantilla HTML
3. **COMPONENT_EXAMPLE_Styles.scss** - Estilos SCSS

## 🚀 Pasos de Integración

### Paso 1: Crear el Componente

```bash
cd frontend

# Usando Angular CLI
ng generate component components/geographic-records --module=app
```

Este comando crea:
```
src/app/components/geographic-records/
├── geographic-records.component.ts
├── geographic-records.component.html
├── geographic-records.component.scss
└── geographic-records.component.spec.ts
```

### Paso 2: Reemplazar el Archivo TypeScript

Abre `src/app/components/geographic-records/geographic-records.component.ts` y reemplaza su contenido con el contenido de `COMPONENT_EXAMPLE_TypeScript.ts`.

### Paso 3: Reemplazar la Plantilla HTML

Abre `src/app/components/geographic-records/geographic-records.component.html` y reemplaza su contenido con el de `COMPONENT_EXAMPLE_Template.html`.

### Paso 4: Agregar los Estilos SCSS

Abre `src/app/components/geographic-records/geographic-records.component.scss` y reemplaza su contenido con el de `COMPONENT_EXAMPLE_Styles.scss`.

### Paso 5: Actualizar el Módulo de la Aplicación

Si es necesario, importa el componente en tu módulo principal. El componente debería estar disponible automáticamente si se generó con `ng generate`.

En `src/app/app.module.ts`:

```typescript
import { GeographicRecordsComponent } from './components/geographic-records/geographic-records.component';

@NgModule({
  declarations: [
    // ... otros componentes
    GeographicRecordsComponent
  ],
  imports: [
    // ... otros módulos
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatTableModule,
    MatChipsModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    ReactiveFormsModule,
    CommonModule,
    HttpClientModule
  ]
})
export class AppModule { }
```

### Paso 6: Agregar la Ruta (Opcional)

Si deseas que sea una página independiente, agrega la ruta en `src/app/app-routing.module.ts`:

```typescript
const routes: Routes = [
  // ... otras rutas
  {
    path: 'reportes/registros-geograficos',
    component: GeographicRecordsComponent
  }
];
```

Luego agrega un enlace en el menú de navegación:

```html
<a mat-list-item routerLink="/reportes/registros-geograficos">
  <mat-icon matListItemIcon>public</mat-icon>
  <span matListItemTitle>Análisis Geográfico</span>
</a>
```

## 📦 Dependencias Requeridas

Asegúrate de que tu `package.json` tiene estas dependencias:

```json
{
  "dependencies": {
    "@angular/common": ">=15.0.0",
    "@angular/core": ">=15.0.0",
    "@angular/forms": ">=15.0.0",
    "@angular/material": ">=15.0.0",
    "@angular/platform-browser": ">=15.0.0",
    "@angular/platform-browser-dynamic": ">=15.0.0",
    "rxjs": ">=7.5.0",
    "file-saver": "^2.0.5"
  }
}
```

Si no están instaladas, ejecuta:

```bash
npm install
npm install file-saver
npm install --save-dev @types/file-saver
```

## 🔌 Servicios HTTP

El componente usa `HttpClient` para llamar a los endpoints de la API. Asegúrate de tener un interceptor HTTP que:

1. **Agregue el Token JWT** a cada solicitud
2. **Maneje errores globales** apropiadamente
3. **Configure la URL base** correctamente

### Ejemplo de Interceptor

Si no tienes un interceptor, crea uno:

```typescript
import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor
} from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  
  constructor(private authService: AuthService) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const token = this.authService.getToken();
    
    if (token) {
      request = request.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      });
    }
    
    return next.handle(request);
  }
}
```

Registra el interceptor en `app.module.ts`:

```typescript
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { AuthInterceptor } from './interceptors/auth.interceptor';

@NgModule({
  // ...
  providers: [
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true
    }
  ]
})
export class AppModule { }
```

## 🎨 Customización

### Cambiar Colores

Los colores están definidos en los gradientes y en las variables SCSS. Para cambiarlos:

En `COMPONENT_EXAMPLE_Styles.scss`:

```scss
// Cambiar colores principales
.en-obra {
  border-left-color: #tu-color !important;
  background: rgba(tu-color, 0.05);
}

.en-oficina {
  border-left-color: #tu-color !important;
  background: rgba(tu-color, 0.05);
}

.externa {
  border-left-color: #tu-color !important;
  background: rgba(tu-color, 0.05);
}
```

### Cambiar Textos

En `COMPONENT_EXAMPLE_TypeScript.ts`, modifica los strings asociados a cada clasificación:

```typescript
obtenerIconoClasificacion(clasificacion: string): string {
  const iconos: { [key: string]: string } = {
    'EN OBRA': 'construction',  // Cambiar icono
    'EN OFICINA': 'business',   // Cambiar icono
    'UBICACIÓN EXTERNA': 'location_on'  // Cambiar icono
  };
  return iconos[clasificacion] || 'question_mark';
}
```

### Agregar Filtros Adicionales

Para agregar un nuevo filtro:

1. En el formulario HTML:
```html
<mat-form-field class="form-field">
  <mat-label>Mi Nuevo Filtro</mat-label>
  <input matInput formControlName="nuevoFiltro">
</mat-form-field>
```

2. En el TypeScript:
```typescript
crearFormulario(): FormGroup {
  return this.fb.group({
    // ... otros campos
    nuevoFiltro: ['']
  });
}
```

3. En la llamada a la API:
```typescript
const payload = {
  // ... otros campos
  nuevo_filtro: this.form.get('nuevoFiltro')?.value || null
};
```

## 🧪 Testing

### Prueba Manual en Desarrollo

1. Inicia el servidor Angular:
```bash
cd frontend
ng serve --open
```

2. Navega al componente (si está en una ruta):
```
http://localhost:4200/reportes/registros-geograficos
```

3. Prueba los filtros:
   - Ingresa fechas válidas
   - Deja filtros opcionales en blanco
   - Haz clic en "Generar Reporte"

### Prueba con datos reales

1. Verifica que el backend esté corriendo:
```bash
cd backend
uvicorn main:app --reload --port 8000
```

2. Verifica las credenciales SSH en `.env`

3. Ejecuta el reporte desde el CLI para validar:
```bash
python run_geographic_analysis.py --info
```

## 📡 Integración API

El componente llama a estos endpoints:

### Generar Reporte
```
POST /api/v1/geographic-records/generar-reporte
```

Request:
```json
{
  "fecha_inicio": "2026-01-01",
  "fecha_fin": "2026-03-31",
  "pid_filtro": null,
  "user_filtro": null,
  "nombre_proyecto_filtro": null
}
```

### Descargar Reporte
```
GET /api/v1/geographic-records/descargar/{filename}
```

## 🔐 Seguridad

### CORS
Asegúrate de que tu backend permite solicitudes desde el frontend:

En `main.py`:
```python
allowed_origins = [
    "http://localhost:4200",  # Desarrollo
    "http://localhost:8080",  # Desarrollo alternativo
    "https://tu-dominio.com"  # Producción
]
```

### Autenticación
El componente asume que hay un interceptor HTTP que agrega el token JWT.
Si no lo tienes, la solicitud fallará con error 401.

## 🐛 Troubleshooting

### Error: "Cannot find module 'file-saver'"
**Solución:**
```bash
npm install file-saver
npm install --save-dev @types/file-saver
```

### Error: "mat-spinner not found"
**Solución:** Agrega MatProgressSpinnerModule a los imports del módulo

### Error: "No provider for HttpClient"
**Solución:** Importa HttpClientModule en app.module.ts

### Los datos no se cargan
**Solución:**
1. Abre la consola (F12)
2. Ve a la pestaña Network
3. Verifica que la solicitud a `/api/v1/geographic-records/generar-reporte` sea exitosa
4. Si hay error, verifica que el backend esté corriendo en puerto 8000
5. Verifica el archivo `.env` en el backend

### El botón descargar no funciona
**Solución:**
1. Verifica que el archivo existe en `backend/report/`
2. Verifica que el nombre del archivo en la respuesta sea correcto
3. Abre la consola del navegador para ver si hay errores

## 📚 Recursos Adicionales

- [Documentación de Angular Material](https://material.angular.io/)
- [Documentación de Angular Forms](https://angular.io/guide/reactive-forms)
- [Documentación de RxJS](https://rxjs.dev/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)

## ✅ Checklist Final

- [ ] Componente creado con `ng generate`
- [ ] Archivos TypeScript, HTML y SCSS reemplazados
- [ ] Módulo importa todas las dependencias Material necesarias
- [ ] HttpClientModule está importado
- [ ] Rutas configuradas (si es una página independiente)
- [ ] Menú de navegación actualizado
- [ ] Interceptor HTTP configurado
- [ ] Backend corriendo en puerto 8000
- [ ] Variables de entorno configuradas
- [ ] Archivos KML en `backend/uploads/`
- [ ] Credenciales SSH validadas
- [ ] Prueba manual completada

## 📞 Soporte

Si encuentras problemas:

1. Revisa la consola del navegador (F12 → Console)
2. Revisa los logs del backend (terminal donde corre `uvicorn`)
3. Ejecuta `python run_geographic_analysis.py --info` para diagnosticar
4. Verifica que todos los archivos están en su lugar
5. Verifica que las variables de entorno están correctas

---

**Versión**: 1.0  
**Última actualización**: 12 de marzo de 2026  
**Pronto a funcionar**: ✅ Listo
