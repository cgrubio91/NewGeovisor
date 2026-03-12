import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';
import { saveAs } from 'file-saver';


/**
 * Componente para generar reportes geográficos de registros
 * Interfaz para consultar registros de colaboradores desde MongoDB,
 * clasificarlos por ubicación (EN OBRA, EN OFICINA, UBICACIÓN EXTERNA)
 * y descargar reportes en Excel.
 */
@Component({
  selector: 'app-geographic-records',
  templateUrl: './geographic-records.component.html',
  styleUrls: ['./geographic-records.component.scss']
})
export class GeographicRecordsComponent implements OnInit {
  
  form: FormGroup;
  loading = false;
  generando = false;
  
  // Datos del último reporte generado
  ultimoReporte: any = null;
  
  // Columnas a mostrar en la tabla de resumen
  columnasResumen = ['clasificacion', 'cantidad', 'porcentaje'];
  
  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private snackBar: MatSnackBar
  ) {
    this.form = this.crearFormulario();
  }
  
  ngOnInit(): void {
    // Inicialización si es necesaria
  }
  
  /**
   * Crea el formulario reactivo para los filtros
   */
  crearFormulario(): FormGroup {
    const hoy = new Date();
    const hace30Dias = new Date(hoy.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    return this.fb.group({
      fechaInicio: [this.formatoFecha(hace30Dias), Validators.required],
      fechaFin: [this.formatoFecha(hoy), Validators.required],
      pidFiltro: ['', Validators.pattern(/^[a-f0-9]{24}$|^$/)],
      usuarioFiltro: ['', Validators.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$|^$/)],
      nombreProyectoFiltro: ['']
    });
  }
  
  /**
   * Formatea una fecha a YYYY-MM-DD
   */
  formatoFecha(date: Date): string {
    const año = date.getFullYear();
    const mes = String(date.getMonth() + 1).padStart(2, '0');
    const dia = String(date.getDate()).padStart(2, '0');
    return `${año}-${mes}-${dia}`;
  }
  
  /**
   * Genera el reporte geográfico
   */
  generarReporte(): void {
    if (this.form.invalid) {
      this.mostrarError('Por favor completa los campos requeridos');
      return;
    }
    
    this.generando = true;
    this.loading = true;
    
    const payload = {
      fecha_inicio: this.form.get('fechaInicio')?.value,
      fecha_fin: this.form.get('fechaFin')?.value,
      pid_filtro: this.form.get('pidFiltro')?.value || null,
      user_filtro: this.form.get('usuarioFiltro')?.value || null,
      nombre_proyecto_filtro: this.form.get('nombreProyectoFiltro')?.value || null
    };
    
    this.http.post<any>(
      '/api/v1/geographic-records/generar-reporte',
      payload
    ).subscribe(
      (respuesta) => {
        this.generando = false;
        this.loading = false;
        
        if (respuesta.status === 'success') {
          this.ultimoReporte = respuesta;
          this.mostrarExito(
            `Reporte generado con ${respuesta.total_registros} registros`
          );
        } else if (respuesta.status === 'sin_datos') {
          this.mostrarAdvertencia(respuesta.mensaje);
        } else {
          this.mostrarError(respuesta.mensaje);
        }
      },
      (error) => {
        this.generando = false;
        this.loading = false;
        console.error('Error generando reporte:', error);
        this.mostrarError('Error al conectarse con el servidor');
      }
    );
  }
  
  /**
   * Descarga el último reporte generado
   */
  descargarReporte(): void {
    if (!this.ultimoReporte?.url_descarga) {
      this.mostrarError('No hay reporte disponible para descargar');
      return;
    }
    
    this.loading = true;
    
    this.http.get(
      this.ultimoReporte.url_descarga,
      { responseType: 'blob' }
    ).subscribe(
      (blob) => {
        this.loading = false;
        const nombreArchivo = `Reporte_Registros_${this.ultimoReporte.timestamp}.xlsx`;
        saveAs(blob, nombreArchivo);
        this.mostrarExito(`Archivo descargado: ${nombreArchivo}`);
      },
      (error) => {
        this.loading = false;
        console.error('Error descargando archivo:', error);
        this.mostrarError('Error al descargar el archivo');
      }
    );
  }
  
  /**
   * Obtiene el icono de clasificación
   */
  obtenerIconoClasificacion(clasificacion: string): string {
    const iconos: { [key: string]: string } = {
      'EN OBRA': 'construction',
      'EN OFICINA': 'business',
      'UBICACIÓN EXTERNA': 'location_on'
    };
    return iconos[clasificacion] || 'question_mark';
  }
  
  /**
   * Obtiene el color de clasificación para el chip
   */
  obtenerColorClasificacion(clasificacion: string): string {
    const colores: { [key: string]: string } = {
      'EN OBRA': 'accent',
      'EN OFICINA': 'primary',
      'UBICACIÓN EXTERNA': 'warn'
    };
    return colores[clasificacion] || '';
  }
  
  /**
   * Calccula el porcentaje para una clasificación
   */
  calcularPorcentaje(valor: number): string {
    if (!this.ultimoReporte?.total_registros || this.ultimoReporte.total_registros === 0) {
      return '0%';
    }
    const porcentaje = (valor / this.ultimoReporte.total_registros) * 100;
    return `${porcentaje.toFixed(1)}%`;
  }
  
  /**
   * Retorna los datos de estadísticas formateados
   */
  obtenerDatosEstadisticas(): any[] {
    if (!this.ultimoReporte?.estadisticas) {
      return [];
    }
    
    return [
      {
        clasificacion: 'EN OBRA',
        cantidad: this.ultimoReporte.estadisticas['EN OBRA'],
        porcentaje: this.calcularPorcentaje(this.ultimoReporte.estadisticas['EN OBRA'])
      },
      {
        clasificacion: 'EN OFICINA',
        cantidad: this.ultimoReporte.estadisticas['EN OFICINA'],
        porcentaje: this.calcularPorcentaje(this.ultimoReporte.estadisticas['EN OFICINA'])
      },
      {
        clasificacion: 'UBICACIÓN EXTERNA',
        cantidad: this.ultimoReporte.estadisticas['UBICACIÓN EXTERNA'],
        porcentaje: this.calcularPorcentaje(this.ultimoReporte.estadisticas['UBICACIÓN EXTERNA'])
      }
    ];
  }
  
  /**
   * Muestra un mensaje de error
   */
  private mostrarError(mensaje: string): void {
    this.snackBar.open(mensaje, 'Cerrar', {
      duration: 5000,
      panelClass: ['snackbar-error']
    });
  }
  
  /**
   * Muestra un mensaje de éxito
   */
  private mostrarExito(mensaje: string): void {
    this.snackBar.open(mensaje, 'Cerrar', {
      duration: 5000,
      panelClass: ['snackbar-success']
    });
  }
  
  /**
   * Muestra un mensaje de advertencia
   */
  private mostrarAdvertencia(mensaje: string): void {
    this.snackBar.open(mensaje, 'Cerrar', {
      duration: 5000,
      panelClass: ['snackbar-warning']
    });
  }
}
