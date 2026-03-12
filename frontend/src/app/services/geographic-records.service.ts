import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface GeoRecord {
  _id?: string;
  project_id?: string;
  user: string;
  coords?: {
    lat: number;
    lon: number;
  };
  coordinates_google?: string;
  date?: string;
  format?: string;
  [key: string]: any;
}

export interface ReportResponse {
  status: string;
  mensaje: string;
  archivo?: string;
  total_registros: number;
  estadisticas?: {
    [key: string]: number;
  };
  records?: GeoRecord[];
  url_descarga?: string;
}

@Injectable({
  providedIn: 'root'
})
export class GeographicRecordsService {
  private apiUrl: string;

  constructor(
    private http: HttpClient,
    private apiService: ApiService
  ) {
    this.apiUrl = `${this.apiService.getApiUrl()}/api/v1/geographic-records`;
  }

  /**
   * Genera reporte con filtros opcionales
   */
  generateReport(
    fechaInicio: string,
    fechaFin: string,
    pidFiltro?: string,
    userFiltro?: string,
    nombreProyectoFiltro?: string
  ): Observable<ReportResponse> {
    const body: any = {
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin
    };

    if (pidFiltro) body.pid_filtro = pidFiltro;
    if (userFiltro) body.user_filtro = userFiltro;
    if (nombreProyectoFiltro) body.nombre_proyecto_filtro = nombreProyectoFiltro;

    return this.http.post<ReportResponse>(
      `${this.apiUrl}/generar-reporte`,
      body
    );
  }

  /**
   * Obtiene registros para mostrar en el mapa
   * Retorna los registros con coordenadas para ubicarlos en el mapa
   */
  getRecordsForMap(
    fechaInicio: string,
    fechaFin: string,
    pidFiltro?: string,
    userFiltro?: string,
    nombreProyectoFiltro?: string
  ): Observable<ReportResponse> {
    // Reutilizamos el endpoint de generar-reporte
    return this.generateReport(
      fechaInicio,
      fechaFin,
      pidFiltro,
      userFiltro,
      nombreProyectoFiltro
    );
  }

  /**
   * Obtiene información de configuración del analizador
   */
  getAnalyzerInfo(): Observable<any> {
    return this.http.get(`${this.apiUrl}/info`);
  }

  /**
   * Descarga el archivo de reporte
   */
  downloadReport(filename: string): Observable<Blob> {
    return this.http.get(
      `${this.apiUrl}/descargar/${filename}`,
      { responseType: 'blob' }
    );
  }

  /**
   * Convierte coordenadas Google Maps (string) a lat/lon
   * Formato esperado: "4.711,-74.006" o "4.711, -74.006"
   */
  parseCoordinates(coordString: string | undefined): { lat: number; lon: number } | undefined {
    if (!coordString) return undefined;

    try {
      const parts = coordString.split(',').map(s => parseFloat(s.trim()));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        return { lat: parts[0], lon: parts[1] };
      }
    } catch (e) {
      console.error('Error parsing coordinates:', e);
    }

    return undefined;
  }

  /**
   * Convierte registros a formato GeoJSON para OpenLayers
   */
  recordsToGeoJSON(records: GeoRecord[]): any {
    const features = records
      .filter(record => {
        // Intentar obtener coordenadas de diferentes fuentes
        let coords = record.coords;
        if (!coords && record.coordinates_google) {
          coords = this.parseCoordinates(record.coordinates_google);
        }
        return coords && coords.lat && coords.lon;
      })
      .map(record => {
        let coords = record.coords;
        if (!coords) {
          coords = this.parseCoordinates(record.coordinates_google);
        }

        return {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [coords!.lon, coords!.lat]
          },
          properties: {
            ...record,
            user: record.user || 'Desconocido',
            date: record.date || 'N/A',
            format: record.format || 'N/A',
            project_id: record.project_id || 'N/A'
          }
        };
      });

    return {
      type: 'FeatureCollection',
      features: features
    };
  }
}
