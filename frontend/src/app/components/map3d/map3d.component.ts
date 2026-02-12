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

    // Aplicar Modo Estudio si está activo por defecto
    setTimeout(() => {
      this.map3dService.toggleLocalMode(this.map3dService.localModeEnabled);
    }, 1000);

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
      const metadata = layer.settings || layer.metadata;
      // Para KML no es estrictamente necesario tener metadata/settings para intentar cargar
      if (!metadata && layer.layer_type !== 'kml') return;

      const filePath = layer.file_path || '';
      const normalizedPath = filePath.replace(/\\/g, '/');
      const uploadsIndex = normalizedPath.indexOf('/uploads/');

      let fileUrl = '';
      if (uploadsIndex !== -1) {
        const relativePath = normalizedPath.substring(uploadsIndex + 8).replace(/^\/+/, ''); // Borrar 'uploads/' o 'uploads\'
        fileUrl = `${this.apiService.getApiUrl()}/uploads/${relativePath}`;
      } else {
        const filename = filePath.split(/[\\/]/).pop();
        fileUrl = `${this.apiService.getApiUrl()}/uploads/${filename}`;
      }

      if (layer.layer_type === 'raster') {
        const filename = filePath.split(/[\\/]/).pop() || '';
        const tileUrl = `${this.apiService.getApiUrl()}/tiles/${filename}/{z}/{x}/{y}.png`;
        // Extraer y normalizar bounds
        let extent: number[] | undefined;
        if (metadata && metadata.bounds_wgs84) {
          const b = metadata.bounds_wgs84;
          extent = [Number(b.minx), Number(b.miny), Number(b.maxx), Number(b.maxy)];
        } else if (metadata && metadata.bounds) {
          const b = metadata.bounds;
          extent = [
            Number(b.left !== undefined ? b.left : b[0]),
            Number(b.bottom !== undefined ? b.bottom : b[1]),
            Number(b.right !== undefined ? b.right : b[2]),
            Number(b.top !== undefined ? b.top : b[3])
          ];
        }
        if (extent && extent.some(v => isNaN(v))) extent = undefined;

        this.map3dService.addRasterLayer(layer.name, tileUrl, extent, layer.id);
      } else if (layer.layer_type === 'point_cloud') {
        const isConverted = filePath.toLowerCase().endsWith('tileset.json') || filePath.toLowerCase().endsWith('.json');
        if (isConverted) {
          this.map3dService.add3DTileset(fileUrl, layer.id);
        } else {
          console.warn('Nube de puntos no convertida: Cesium no puede renderizar .las directamente.', layer.name);
        }
      } else if (layer.layer_type === '3d_model') {
        // Si es tileset (malla de realidad), usar add3DTileset
        if (filePath.toLowerCase().endsWith('tileset.json')) {
          this.map3dService.add3DTileset(fileUrl, layer.id);
        } else {
          // Para modelos GLB/GLTF/OBJ
          const pos: [number, number, number] = metadata.center || [-74.006, 4.711, 0];
          this.map3dService.addModel(fileUrl, pos);
        }
      } else if (layer.layer_type === 'kml') {
        this.map3dService.addKmlLayer(layer.name, fileUrl, layer.id);
      }
    });
  }

  ngOnDestroy(): void {
    // Viewer cleanup
  }
}
