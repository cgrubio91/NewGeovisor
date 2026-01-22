import { Component, OnInit, AfterViewInit } from '@angular/core';
import { ProjectContextService } from '../../services/project-context.service';
import { ApiService } from '../../services/api.service';
import { Project } from '../../models/models';
import { MapService } from '../../services/map.service';

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
  constructor(
    private mapService: MapService,
    private projectContext: ProjectContextService,
    private apiService: ApiService
  ) { }

  ngOnInit(): void { }

  ngAfterViewInit(): void {
    this.mapService.initMap('map');

    // Sincronizar capas del proyecto activo
    this.projectContext.activeProject$.subscribe(project => {
      if (project) {
        this.loadProjectLayers(project);
      }
    });
  }

  private loadProjectLayers(project: Project) {
    this.mapService.clearLayers();
    if (!project.layers) return;

    project.layers.forEach(layer => {
      const metadata = layer.metadata;
      if (!metadata) return;

      if (layer.layer_type === 'raster') {
        const filename = layer.file_path.split(/[\\/]/).pop();
        const tileUrl = `${this.apiService.getApiUrl()}/tiles/${filename}/{z}/{x}/{y}.png`;
        this.mapService.addRasterLayer(layer.name, tileUrl, metadata.bounds);
      } else if (layer.layer_type === 'vector') {
        this.mapService.addVectorLayer(layer.name, metadata);
      }
    });
  }
}
