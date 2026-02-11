import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface Layer {
  id: number;
  name: string;
  layer_type: string;
  file_format: string;
  file_path: string;
  crs?: string;
  visible: boolean;
  opacity: number;
  z_index: number;
  settings?: any;
  project_id: number;
  folder_id?: number;
  created_at: string;
  updated_at?: string;
  processing_status?: 'pending' | 'processing' | 'completed' | 'failed' | 'processing_overviews';
  processing_progress?: number;
}

export interface LayerUpdate {
  name?: string;
  visible?: boolean;
  opacity?: number;
  z_index?: number;
  settings?: any;
  folder_id?: number | null;
}

@Injectable({
  providedIn: 'root'
})
export class LayerService {
  private apiUrl = `${environment.apiUrl}`;
  private layersSubject = new BehaviorSubject<Layer[]>([]);
  public layers$ = this.layersSubject.asObservable();

  constructor(private http: HttpClient) { }

  /**
   * Obtener todas las capas de un proyecto
   */
  getProjectLayers(projectId: number): Observable<Layer[]> {
    return this.http.get<Layer[]>(`${this.apiUrl}/projects/${projectId}/layers`).pipe(
      tap(layers => this.layersSubject.next(layers))
    );
  }

  /**
   * Actualizar una capa
   */
  updateLayer(layerId: number, update: LayerUpdate): Observable<Layer> {
    return this.http.patch<Layer>(`${this.apiUrl}/layers/${layerId}`, update).pipe(
      tap(updatedLayer => {
        const currentLayers = this.layersSubject.value;
        const index = currentLayers.findIndex(l => l.id === layerId);
        if (index !== -1) {
          currentLayers[index] = updatedLayer;
          this.layersSubject.next([...currentLayers]);
        }
      })
    );
  }

  /**
   * Alternar visibilidad de una capa
   */
  toggleLayerVisibility(layerId: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/layers/${layerId}/toggle-visibility`, {}).pipe(
      tap(response => {
        const currentLayers = this.layersSubject.value;
        const layer = currentLayers.find(l => l.id === layerId);
        if (layer) {
          layer.visible = response.visible;
          this.layersSubject.next([...currentLayers]);
        }
      })
    );
  }

  /**
   * Establecer opacidad de una capa
   */
  setLayerOpacity(layerId: number, opacity: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/layers/${layerId}/set-opacity`, null, {
      params: { opacity: opacity.toString() }
    }).pipe(
      tap(response => {
        const currentLayers = this.layersSubject.value;
        const layer = currentLayers.find(l => l.id === layerId);
        if (layer) {
          layer.opacity = response.opacity;
          this.layersSubject.next([...currentLayers]);
        }
      })
    );
  }

  /**
   * Eliminar una capa
   */
  deleteLayer(layerId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/layers/${layerId}`).pipe(
      tap(() => {
        const currentLayers = this.layersSubject.value.filter(l => l.id !== layerId);
        this.layersSubject.next(currentLayers);
      })
    );
  }

  /**
   * Mover capa a una carpeta
   */
  moveLayerToFolder(layerId: number, folderId: number | null): Observable<Layer> {
    return this.updateLayer(layerId, { folder_id: folderId === null ? undefined : folderId });
  }

  /**
   * Cambiar orden de capa (z-index)
   */
  changeLayerOrder(layerId: number, zIndex: number): Observable<Layer> {
    return this.updateLayer(layerId, { z_index: zIndex });
  }

  /**
   * Obtener capas visibles ordenadas por z-index
   */
  getVisibleLayers(): Layer[] {
    return this.layersSubject.value
      .filter(layer => layer.visible)
      .sort((a, b) => a.z_index - b.z_index);
  }

  /**
   * Obtener capas por carpeta
   */
  getLayersByFolder(folderId: number | null): Layer[] {
    return this.layersSubject.value.filter(layer => layer.folder_id === folderId);
  }

  /**
   * Limpiar estado
   */
  clearLayers(): void {
    this.layersSubject.next([]);
  }
}
