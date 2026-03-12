import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MapService } from '../../services/map.service';
import { GeographicRecordsService, GeoRecord, ReportResponse } from '../../services/geographic-records.service';
import { ProjectService } from '../../services/project.service';
import { ToastService } from '../../services/toast.service';
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
  private destroy$ = new Subject<void>();
  private map: OlMap | null = null;

  // Datos para selects
  projects: any[] = [];
  users: any[] = [];

  ngOnInit() {
    this.initializeForm();
    this.loadProjectsAndUsers();
    
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
   * Carga proyectos y usuarios para los select
   */
  private loadProjectsAndUsers() {
    this.projectService.getProjects()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (projects) => {
          this.projects = projects;
        },
        error: (err) => {
          console.error('Error loading projects:', err);
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

    this.geoService.getRecordsForMap(
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
   * Carga los registros en el mapa
   */
  loadToMap() {
    if (!this.map) {
      this.toastService.show('El mapa no está disponible', 'warning');
      return;
    }

    if (this.recordsForMap.length === 0) {
      this.toastService.show('No hay registros con coordenadas para mostrar', 'warning');
      return;
    }

    // Convertir registros a GeoJSON
    const geoJson = this.geoService.recordsToGeoJSON(this.recordsForMap);

    // Agregar capa al mapa
    this.mapService.addVectorLayer(
      'Registros Geográficos',
      geoJson,
      999999, // ID único
      null // Sin folder
    );

    this.showMap = true;
    this.toastService.show(
      `${this.recordsForMap.length} registros agregados al mapa`,
      'success'
    );

    // Navegar a la vista del mapa
    setTimeout(() => {
      this.router.navigate(['/map']);
    }, 500);
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
          const filename = response.archivo.split('\\').pop() || 'reporte.xlsx';
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
