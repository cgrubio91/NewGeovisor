import { Component, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { Map3dService } from '../../services/map3d.service';
import { ProjectContextService } from '../../services/project-context.service';
import { ApiService } from '../../services/api.service';
import { Project } from '../../models/models';

@Component({
  selector: 'app-map3d',
  standalone: true,
  template: '<div id="cesiumContainer" class="cesium-container"></div>',
  styles: [`
    .cesium-container {
      width: 100%;
      height: 100%;
      background-color: #000;
    }
  `]
})
export class Map3dComponent implements OnInit, AfterViewInit, OnDestroy {
  constructor(
    private map3dService: Map3dService,
    private projectContext: ProjectContextService,
    private apiService: ApiService
  ) { }

  ngOnInit(): void { }

  ngAfterViewInit(): void {
    this.map3dService.initViewer('cesiumContainer');

    // Sincronizar capas del proyecto activo
    this.projectContext.activeProject$.subscribe(project => {
      if (project) {
        this.loadProjectLayers(project);
      }
    });
  }

  private loadProjectLayers(project: Project) {
    this.map3dService.clearLayers();
    if (!project.layers) return;

    project.layers.forEach(layer => {
      const metadata = layer.metadata;
      if (!metadata) return;

      const filename = layer.file_path.split(/[\\/]/).pop();
      const fileUrl = `${this.apiService.getApiUrl()}/uploads/${filename}`;

      if (layer.layer_type === 'raster') {
        const tileUrl = `${this.apiService.getApiUrl()}/tiles/${filename}/{z}/{x}/{y}.png`;
        this.map3dService.addRasterLayer(layer.name, tileUrl, metadata.bounds, layer.id);
      } else if (layer.layer_type === '3d_model') {
        // Si es tileset, usar add3DTileset
        if (filename?.toLowerCase().endsWith('tileset.json')) {
          this.map3dService.add3DTileset(fileUrl);
        } else {
          // Para otros modelos, se necesita posición (asumimos centro de bounds si existen)
          const pos: [number, number, number] = metadata.center || [-74.006, 4.711, 0];
          this.map3dService.addModel(fileUrl, pos);
        }
      }
    });
  }

  ngOnDestroy(): void {
    // Viewer cleanup
  }
}
