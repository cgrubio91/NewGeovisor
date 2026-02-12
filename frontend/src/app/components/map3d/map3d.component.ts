import { Component, OnInit, AfterViewInit, OnDestroy, inject } from '@angular/core';
import { Map3dService } from '../../services/map3d.service';
import { ProjectContextService } from '../../services/project-context.service';
import { ApiService } from '../../services/api.service';
import { LayerService } from '../../services/layer.service';
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
  private layerService = inject(LayerService);
  private subscriptions: any[] = [];

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
    console.log('Map3D: Cargando capas...', layers);
    this.map3dService.clearLayers();
    layers.forEach(layer => {
      const metadata = layer.settings || layer.metadata;
      console.log(`Map3D: Procesando capa "${layer.name}" (${layer.layer_type}). Status: ${layer.processing_status}`);

      // Para KML no es estrictamente necesario tener metadata/settings para intentar cargar
      if (!metadata && layer.layer_type !== 'kml') return;

      const filePath = layer.file_path || '';
      const normalizedPath = filePath.replace(/\\/g, '/');
      let relativePath = normalizedPath;

      const uploadsMarker = 'uploads/';
      const idx = normalizedPath.toLowerCase().indexOf(uploadsMarker);

      if (idx !== -1) {
        relativePath = normalizedPath.substring(idx + uploadsMarker.length);
      }

      // Eliminar barras iniciales sobrantes
      relativePath = relativePath.replace(/^\/+/, '');

      const fileUrl = `${this.apiService.getApiUrl()}/uploads/${relativePath}`;

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
        const filename = filePath.split(/[\\/]/).pop()?.toLowerCase() || '';
        const isConverted = filename === 'tileset.json' || filename.endsWith('.json');

        if (isConverted) {
          // Pequeño delay de cortesía para asegurar que el sistema de archivos del server soltó el lock
          setTimeout(() => {
            this.map3dService.add3DTileset(fileUrl, layer.id, metadata?.rotation);
          }, 500);
        } else if (layer.processing_status === 'completed') {
          // Si está completado pero el path sigue siendo .las, es que el polling no ha traído el nuevo path aún
          console.log('Map3D: Esperando actualización de ruta para tileset...');
        } else {
          console.warn('Nube de puntos en proceso o no convertida:', layer.name, filePath);
        }
      } else if (layer.layer_type === '3d_model') {
        const filename = filePath.split(/[\\/]/).pop()?.toLowerCase() || '';
        const isTileset = filename === 'tileset.json' || filename.endsWith('.json');

        // Si es tileset (malla de realidad), usar add3DTileset
        if (isTileset) {
          this.map3dService.add3DTileset(fileUrl, layer.id, metadata?.rotation);
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
    this.subscriptions.forEach(s => s.unsubscribe());
  }
}
