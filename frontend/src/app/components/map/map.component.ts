import { Component, OnInit, AfterViewInit, OnDestroy, inject } from '@angular/core';
import { ProjectContextService } from '../../services/project-context.service';
import { ApiService } from '../../services/api.service';
import { Project } from '../../models/models';
import { MapService } from '../../services/map.service';
import { LayerService } from '../../services/layer.service';

/**
 * Componente del mapa principal
 * Renderiza el mapa de OpenLayers y gestiona su inicialización
 */
@Component({
  selector: 'app-map',
  standalone: true,
  template: '<div id="map" class="map-container"></div>',
  styles: [`
    .map-container {
      width: 100%;
      height: 100%;
      background-color: var(--bg-primary);
    }
  `]
})
export class MapComponent implements OnInit, AfterViewInit {
  private layerService = inject(LayerService);
  private subscriptions: any[] = [];

  constructor(
    private mapService: MapService,
    private projectContext: ProjectContextService,
    private apiService: ApiService
  ) { }

  ngOnInit(): void { }

  ngAfterViewInit(): void {
    this.mapService.initMap('map');

    // Sincronizar capas desde el Proyecto Activo (Fuente de verdad única)
    this.subscriptions.push(
      this.projectContext.activeProject$.subscribe(project => {
        if (project) {
          this.loadLayers(project.layers || []);
        }
      })
    );
  }

  private loadLayers(layers: any[]) {
    this.mapService.clearLayers();
    layers.forEach(layer => {
      // El backend devuelve 'settings', pero el frontend a veces usaba 'metadata'.
      // Usamos settings como fuente principal.
      const metadata = layer.settings || layer.metadata;

      // Si no hay metadatos, intentamos seguir si es vector o kml
      if (!metadata && layer.layer_type !== 'vector' && layer.layer_type !== 'kml') return;

      if (layer.layer_type === 'raster') {
        const filename = layer.file_path.split(/[\\/]/).pop();
        const tileUrl = `${this.apiService.getApiUrl()}/tiles/${filename}/{z}/{x}/{y}.png`;

        // Extraer bounds correctamente. Priorizar WGS84 para el zoom.
        let extent: number[] | undefined;

        if (metadata && metadata.bounds_wgs84) {
          const b = metadata.bounds_wgs84;
          extent = [
            Number(b.minx),
            Number(b.miny),
            Number(b.maxx),
            Number(b.maxy)
          ];
        } else if (metadata && metadata.bounds) {
          const b = metadata.bounds;
          extent = [
            Number(b.left),
            Number(b.bottom),
            Number(b.right),
            Number(b.top)
          ];
        }

        // Verificar si el extent es válido (no contiene NaN)
        if (extent && extent.some(v => isNaN(v))) {
          extent = undefined;
        }

        this.mapService.addRasterLayer(layer.name, tileUrl, extent, layer.id, layer.folder_id);
      } else if (layer.layer_type === 'vector') {
        this.mapService.addVectorLayer(layer.name, metadata, layer.id, layer.folder_id);
      } else if (layer.layer_type === 'kml') {
        let kmlUrl = '';
        const filePath = layer.file_path || '';

        // Intentar extraer ruta relativa desde 'uploads' para soportar subcarpetas
        const normalizedPath = filePath.replace(/\\/g, '/');
        const uploadsMarker = 'uploads/';
        const uploadsIndex = normalizedPath.indexOf(uploadsMarker);

        if (uploadsIndex !== -1) {
          // Extraer todo lo que está después de 'uploads/'
          const relativePath = normalizedPath.substring(uploadsIndex + uploadsMarker.length).replace(/^\/+/, '');
          kmlUrl = `${this.apiService.getApiUrl()}/uploads/${relativePath}`;
        } else {
          // Si no hay 'uploads/', probar si es una ruta ya relativa
          const filename = filePath.split(/[\\/]/).pop();
          kmlUrl = `${this.apiService.getApiUrl()}/uploads/${filename}`;
        }

        this.mapService.addKmlLayer(layer.name, kmlUrl, layer.id, layer.folder_id);
      }
    });
  }
  ngOnDestroy(): void {
    this.subscriptions.forEach(s => s.unsubscribe());
  }
}
