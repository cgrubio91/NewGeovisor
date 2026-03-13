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
  archivo_kml?: string;
  total_registros: number;
  estadisticas?: {
    [key: string]: number;
  };
  records?: GeoRecord[];
  url_descarga?: string;
  url_descarga_kml?: string;
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
   * Obtiene la lista de proyectos directamente de MongoDB
   */
  getMongoDBProjects(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/mongodb-projects`);
  }

  /**
   * Sincroniza datos de MongoDB a PostgreSQL
   */
  syncMongoDBData(): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/sync-mongodb-data`, {});
  }

  /**
   * Obtiene la lista de usuarios de PostgreSQL
   */
  getUsers(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiService.getApiUrl()}/users/`);
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
   * Convierte registros a formato GeoJSON para OpenLayers con lógica de semáforo
   */
  recordsToGeoJSON(records: GeoRecord[]): any {
    const features = records
      .filter(record => {
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

        // --- Lógica de Semáforo ---
        // Verde: Obra, Amarillo: Oficina, Rojo: Externo
        const clasificacion = (record['Clasificación'] || record['clasificacion'] || '').toLowerCase();
        let color = '#ff0000'; // Rojo por defecto (Externo)
        
        if (clasificacion.includes('obra')) {
          color = '#00ff00'; // Verde
        } else if (clasificacion.includes('oficina')) {
          color = '#ffff00'; // Amarillo
        }

        // --- Construcción de Título ---
        // "Fecha - Formato o codigo"
        const fechaStr = record['Fecha del registro'] || record['date'] || 'S/F';
        const formatoStr = record['Formato'] || record['format'] || record['codigo'] || 'S/C';
        const title = `${fechaStr} - ${formatoStr}`;

        // --- Construcción de Link ---
        // https://segmab.com/i40/home#!/proyecto/ID_PROYECTO/registro/ID_REGISTRO
        const projectId = record['project_id'] || record['id_proyecto'];
        const recordId = record['id'] || record['_id'];
        const link = (projectId && recordId) 
          ? `https://segmab.com/i40/home#!/proyecto/${projectId}/registro/${recordId}`
          : null;

        return {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [coords!.lon, coords!.lat]
          },
          properties: {
            ...record,
            title: title,
            user: record['Colaborador'] || record['user'] || 'Desconocido',
            color: color,
            link: link,
            description: `Colaborador: ${record['Colaborador'] || record['user'] || 'N/A'}`
          }
        };
      });

    return {
      type: 'FeatureCollection',
      features: features
    };
  }
}
