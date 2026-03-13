import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MapService } from '../../services/map.service';
import { GeographicRecordsService, GeoRecord, ReportResponse } from '../../services/geographic-records.service';
import { ProjectService } from '../../services/project.service';
import { ToastService } from '../../services/toast.service';
import { MeasurementService } from '../../services/measurement.service';
import { finalize, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import OlMap from 'ol/Map';

interface FilterStats {
  totalRecords: number;
  enObra: number;
  enOficina: number;
  ubicacionExterna: number;
}

@Component({
  selector: 'app-geographic-records',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './geographic-records.html',
  styleUrl: './geographic-records.css'
})
export class GeographicRecordsComponent implements OnInit, OnDestroy {
  // Formulario de filtros
  filterForm!: FormGroup;
  
  // Datos
  records: GeoRecord[] = [];
  stats: FilterStats = {
    totalRecords: 0,
    enObra: 0,
    enOficina: 0,
    ubicacionExterna: 0
  };

  // Estado
  isLoading = false;
  showMap = false;
  selectedRecordIndex: number | null = null;
  recordsForMap: GeoRecord[] = [];

  // Referencias
  private mapService = inject(MapService);
  private geoService = inject(GeographicRecordsService);
  private projectService = inject(ProjectService);
  private toastService = inject(ToastService);
  private formBuilder = inject(FormBuilder);
  private router = inject(Router);
  private measurementService = inject(MeasurementService);

  // Filtros
  private destroy$ = new Subject<void>();
  private map: OlMap | null = null;

  // Datos para selects
  projects: any[] = [];
  users: any[] = [];

  ngOnInit() {
    this.initializeForm();
    this.loadProjects();
    this.loadUsers();
    
    // Suscribirse al mapa cuando esté disponible
    this.mapService.map$
      .pipe(takeUntil(this.destroy$))
      .subscribe(map => {
        this.map = map;
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Inicializa el formulario de filtros
   */
  private initializeForm() {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    this.filterForm = this.formBuilder.group({
      fechaInicio: [
        this.formatDate(firstDayOfMonth),
        [Validators.required]
      ],
      fechaFin: [
        this.formatDate(lastDayOfMonth),
        [Validators.required]
      ],
      proyecto: [''],
      usuario: [''],
      nombreProyecto: ['']
    });
  }

  /**
   * Carga proyectos directamente de MongoDB (Segmab)
   */
  private loadProjects() {
    this.geoService.getMongoDBProjects()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (projects) => {
          // Normalizar IDs de MongoDB (pueden venir como objeto o string)
          this.projects = projects.map(p => ({
            ...p,
            id: p._id // El template usa project.id
          }));
        },
        error: (err) => {
          console.error('Error loading MongoDB projects:', err);
          this.toastService.show('Error al cargar proyectos de MongoDB', 'error');
        }
      });
  }

  /**
   * Carga usuarios de PostgreSQL para el filtro
   */
  private loadUsers() {
    this.geoService.getUsers()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (users) => {
          this.users = users;
        },
        error: (err) => {
          console.error('Error loading users:', err);
        }
      });
  }

  /**
   * Sincroniza proyectos y usuarios de MongoDB a PostgreSQL
   */
  syncData() {
    this.isLoading = true;
    this.geoService.syncMongoDBData()
      .pipe(
        finalize(() => this.isLoading = false),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (response) => {
          const res = response.results;
          this.toastService.show(
            `Sincronización exitosa: ${res.projects_created} proyectos, ${res.users_created} usuarios.`,
            'success'
          );
        },
        error: (err) => {
          this.toastService.show('Error en la sincronización de datos', 'error');
        }
      });
  }

  /**
   * Formatea una fecha a formato YYYY-MM-DD
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Ejecuta la búsqueda de registros
   */
  submitFilter() {
    if (!this.filterForm.valid) {
      this.toastService.show('Por favor completa los campos requeridos', 'warning');
      return;
    }

    const formValue = this.filterForm.value;

    this.isLoading = true;
    this.records = [];
    this.recordsForMap = [];
    this.selectedRecordIndex = null;

    // Obtener ID del proyecto desde el datalist (si el usuario escribió el nombre, buscamos el ID)
    let projectId = formValue.proyecto;
    const selectedProject = this.projects.find(p => p.name === formValue.proyecto || p.id === formValue.proyecto || p._id === formValue.proyecto);
    if (selectedProject) {
      projectId = selectedProject.id || selectedProject._id;
    }

    this.geoService.getRecordsForMap(
      formValue.fechaInicio,
      formValue.fechaFin,
      projectId,
      formValue.usuario,
      formValue.nombreProyecto
    )
    .pipe(
      finalize(() => {
        this.isLoading = false;
      }),
      takeUntil(this.destroy$)
    )
    .subscribe({
      next: (response: ReportResponse) => {
        this.handleSuccess(response);
      },
      error: (error) => {
        this.toastService.show(
          error?.error?.detail || 'Error al consultar registros',
          'error'
        );
      }
    });
  }

  /**
   * Maneja la respuesta exitosa
   */
  private handleSuccess(response: ReportResponse) {
    // Extraer datos de respuesta (puede venir de diferentes formatos)
    const records = response.records || [];
    
    this.records = records;
    this.recordsForMap = records.filter(r => {
      const coords = r.coords || this.geoService.parseCoordinates(r.coordinates_google);
      return coords && coords.lat && coords.lon;
    });

    // Actualizar estadísticas
    this.updateStats(response);

    this.toastService.show(
      `${this.records.length} registros encontrados`,
      'success'
    );
  }

  /**
   * Actualiza las estadísticas de filtrado
   */
  private updateStats(response: ReportResponse) {
    this.stats = {
      totalRecords: response.total_registros || this.records.length,
      enObra: response.estadisticas?.['EN OBRA'] || 0,
      enOficina: response.estadisticas?.['EN OFICINA'] || 0,
      ubicacionExterna: response.estadisticas?.['UBICACIÓN EXTERNA'] || 0
    };
  }

  /**
   * Carga los registros filtrados en el sistema de mediciones
   */
  async loadToMap() {
    if (this.recordsForMap.length === 0) {
      this.toastService.show('No hay registros con coordenadas para mostrar', 'warning');
      return;
    }

    this.isLoading = true;
    const now = new Date();
    const dia = String(now.getDate()).padStart(2, '0');
    const folderName = `Consulta día ${dia} (${now.toLocaleTimeString()})`;

    try {
      this.toastService.show(`Creando carpeta y ${this.recordsForMap.length} marcadores...`, 'info');
      
      await this.measurementService.importRecordsAsMeasurements(this.recordsForMap, folderName);
      
      this.toastService.show(
        `Se ha creado la carpeta "${folderName}" en mediciones con los marcadores.`,
        'success'
      );

      // Navegar automáticamente al visor para ver los resultados
      setTimeout(() => {
        this.router.navigate(['/map']);
      }, 500);

    } catch (error) {
      console.error('Error al cargar a mediciones:', error);
      this.toastService.show('Error al importar registros al sistema de mediciones', 'error');
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Descarga el reporte en Excel
   */
  downloadReport() {
    if (!this.filterForm.valid) {
      this.toastService.show('Por favor ejecuta primero una búsqueda', 'warning');
      return;
    }

    const formValue = this.filterForm.value;
    this.isLoading = true;

    this.geoService.generateReport(
      formValue.fechaInicio,
      formValue.fechaFin,
      formValue.proyecto,
      formValue.usuario,
      formValue.nombreProyecto
    )
    .pipe(
      finalize(() => {
        this.isLoading = false;
      }),
      takeUntil(this.destroy$)
    )
    .subscribe({
      next: (response: ReportResponse) => {
        if (response.archivo) {
          const filename = response.archivo.split('\\').pop()?.split('/').pop() || 'reporte.xlsx';
          this.geoService.downloadReport(filename).subscribe({
            next: (blob) => {
              const url = window.URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = filename;
              link.click();
              window.URL.revokeObjectURL(url);
              this.toastService.show('Reporte descargado exitosamente', 'success');
            },
            error: () => {
              this.toastService.show('Error descargando el reporte', 'error');
            }
          });
        }
      },
      error: (error) => {
        this.toastService.show('Error generando el reporte', 'error');
      }
    });
  }

  /**
   * Descarga el reporte en KML
   */
  downloadKml() {
    if (!this.filterForm.valid) {
      this.toastService.show('Por favor ejecuta primero una búsqueda', 'warning');
      return;
    }

    const formValue = this.filterForm.value;
    this.isLoading = true;

    this.geoService.generateReport(
      formValue.fechaInicio,
      formValue.fechaFin,
      formValue.proyecto,
      formValue.usuario,
      formValue.nombreProyecto
    )
    .pipe(
      finalize(() => {
        this.isLoading = false;
      }),
      takeUntil(this.destroy$)
    )
    .subscribe({
      next: (response: ReportResponse) => {
        if (response.archivo_kml) {
          const filename = response.archivo_kml.split('\\').pop()?.split('/').pop() || 'reporte.kml';
          this.geoService.downloadReport(filename).subscribe({
            next: (blob) => {
              const url = window.URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = filename;
              link.click();
              window.URL.revokeObjectURL(url);
              this.toastService.show('KML descargado exitosamente', 'success');
            },
            error: () => {
              this.toastService.show('Error descargando el KML', 'error');
            }
          });
        } else {
          this.toastService.show('El servidor no generó el archivo KML', 'warning');
        }
      },
      error: (error) => {
        this.toastService.show('Error generando el reporte KML', 'error');
      }
    });
  }

  /**
   * Limpia los filtros
   */
  clearFilters() {
    this.initializeForm();
    this.records = [];
    this.recordsForMap = [];
    this.selectedRecordIndex = null;
    this.stats = {
      totalRecords: 0,
      enObra: 0,
      enOficina: 0,
      ubicacionExterna: 0
    };
  }

  /**
   * Obtiene el string de clasificación para un registro
   */
  getClassification(record: GeoRecord): string {
    // La clasificación puede venir en diferentes propiedades según la respuesta
    return record['Clasificación'] || record['classification'] || 'N/A';
  }
}
