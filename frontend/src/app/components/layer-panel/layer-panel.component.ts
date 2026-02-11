import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { LayerService, Layer } from '../../services/layer.service';
import { ProjectContextService } from '../../services/project-context.service';
import { BaseMapService, BaseMapOption } from '../../services/basemap.service';
import { AuthService } from '../../services/auth.service';

interface LayerTreeNode {
  type: 'folder' | 'layer';
  id: number;
  name: string;
  visible?: boolean;
  opacity?: number;
  children?: LayerTreeNode[];
  layer?: Layer;
  processing_status?: 'pending' | 'processing' | 'completed' | 'failed';
  processing_progress?: number;
}

@Component({
  selector: 'app-layer-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="layer-panel">
      <div class="panel-header">
        <h3>Capas</h3>
        <button class="btn-icon" (click)="togglePanel()">
          <i class="icon-{{ panelExpanded ? 'collapse' : 'expand' }}"></i>
        </button>
      </div>

      <div class="panel-content" *ngIf="panelExpanded">
        <!-- Selector de mapa base -->
        <div class="basemap-selector">
          <label>Mapa Base:</label>
          <select [(ngModel)]="selectedBaseMap" (change)="onBaseMapChange()">
            <option *ngFor="let basemap of baseMaps" [value]="basemap.id">
              {{ basemap.name }}
            </option>
          </select>
        </div>

        <div class="divider"></div>

        <!-- Lista de capas -->
        <div class="layers-list">
          <div class="layers-header">
            <span>Capas del Proyecto</span>
            <button class="btn-sm" (click)="expandAll()">
              {{ allExpanded ? 'Contraer' : 'Expandir' }} Todo
            </button>
          </div>

          <div class="layer-tree">
            <div *ngFor="let layer of layers" class="layer-item">
              <div class="layer-controls">
                <!-- Checkbox de visibilidad -->
                <input 
                  type="checkbox" 
                  [checked]="layer.visible"
                  (change)="toggleLayerVisibility(layer.id)"
                  class="layer-checkbox"
                  [disabled]="!isAdminOrDirector"
                />

                <!-- Nombre de la capa -->
                <span class="layer-name" [title]="layer.name">
                  <i class="icon-{{ getLayerIcon(layer.layer_type) }}"></i>
                  {{ layer.name }}
                  <span *ngIf="layer.processing_status === 'processing'" class="processing-badge">
                    Procesando {{ layer.processing_progress }}%
                  </span>
                  <span *ngIf="layer.processing_status === 'failed'" class="error-badge">
                    Error
                  </span>
                </span>

                <!-- Botones de acción -->
                <div class="layer-actions">
                  <button 
                    class="btn-icon-sm" 
                    (click)="zoomToLayer(layer)"
                    title="Zoom a capa"
                  >
                    <i class="icon-zoom"></i>
                  </button>
                  <button 
                    *ngIf="isAdminOrDirector"
                    class="btn-icon-sm" 
                    (click)="deleteLayer(layer.id)"
                    title="Eliminar capa"
                  >
                    <i class="icon-delete"></i>
                  </button>
                </div>
              </div>

              <!-- Control de opacidad -->
              <div class="opacity-control" *ngIf="layer.visible">
                <label>Opacidad: {{ layer.opacity }}%</label>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  [value]="layer.opacity"
                  (input)="onOpacityChange(layer.id, $event)"
                  class="opacity-slider"
                  [disabled]="!isAdminOrDirector"
                />
              </div>

              <!-- Barra de progreso -->
              <div class="processing-bar" *ngIf="layer.processing_status === 'processing' || layer.processing_status === 'pending'">
                <div class="progress-track">
                  <div class="progress-fill" [style.width]="(layer.processing_progress || 0) + '%'"></div>
                </div>
              </div>

              <!-- Información de la capa -->
              <div class="layer-info" *ngIf="expandedLayers.has(layer.id)">
                <div class="info-row">
                  <span class="info-label">Tipo:</span>
                  <span class="info-value">{{ layer.layer_type }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Formato:</span>
                  <span class="info-value">{{ layer.file_format }}</span>
                </div>
                <div class="info-row" *ngIf="layer.crs">
                  <span class="info-label">CRS:</span>
                  <span class="info-value">{{ layer.crs }}</span>
                </div>
              </div>
            </div>
          </div>

          <div *ngIf="layers.length === 0" class="empty-state">
            <p>No hay capas en este proyecto</p>
            <p class="text-muted">Sube archivos para comenzar</p>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .layer-panel {
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      overflow: hidden;
    }

    .panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .panel-header h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
    }

    .panel-content {
      padding: 16px;
      max-height: 600px;
      overflow-y: auto;
    }

    .basemap-selector {
      margin-bottom: 16px;
    }

    .basemap-selector label {
      display: block;
      margin-bottom: 8px;
      font-weight: 500;
      color: #333;
    }

    .basemap-selector select {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
    }

    .divider {
      height: 1px;
      background: #e0e0e0;
      margin: 16px 0;
    }

    .layers-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }

    .layers-header span {
      font-weight: 600;
      color: #333;
    }

    .layer-item {
      margin-bottom: 12px;
      padding: 12px;
      background: #f8f9fa;
      border-radius: 6px;
      border-left: 3px solid #667eea;
    }

    .layer-controls {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .layer-checkbox {
      cursor: pointer;
    }

    .layer-name {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      color: #333;
    }

    .layer-actions {
      display: flex;
      gap: 4px;
    }

    .opacity-control {
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid #e0e0e0;
    }

    .opacity-control label {
      display: block;
      font-size: 12px;
      color: #666;
      margin-bottom: 4px;
    }

    .opacity-slider {
      width: 100%;
      cursor: pointer;
    }

    .layer-info {
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid #e0e0e0;
      font-size: 12px;
    }

    .info-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
    }

    .info-label {
      font-weight: 500;
      color: #666;
    }

    .info-value {
      color: #333;
    }

    .empty-state {
      text-align: center;
      padding: 32px 16px;
      color: #999;
    }

    .text-muted {
      font-size: 12px;
      color: #aaa;
    }

    .btn-icon, .btn-icon-sm, .btn-sm {
      background: none;
      border: none;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 4px;
      transition: background 0.2s;
    }

    .btn-icon:hover, .btn-icon-sm:hover, .btn-sm:hover {
      background: rgba(255,255,255,0.2);
    }

    .btn-sm {
      font-size: 12px;
      color: #667eea;
      background: white;
      border: 1px solid #667eea;
    }

    .btn-sm:hover {
      background: #667eea;
      color: white;
    }

    .progress-track {
      height: 4px;
      background: #e0e0e0;
      border-radius: 2px;
      overflow: hidden;
      margin-top: 4px;
    }

    .processing-bar {
       padding: 0 4px;
       margin-bottom: 8px;
    }

    .processing-badge {
       display: inline-block;
       font-size: 10px;
       padding: 2px 6px;
       border-radius: 10px;
       background: rgba(0, 193, 210, 0.1);
       color: #00c1d2;
       margin-left: 8px;
       border: 1px solid rgba(0, 193, 210, 0.2);
       font-weight: 600;
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #00c1d2, #00e676);
      transition: width 0.3s ease;
    }
  `]
})
export class LayerPanelComponent implements OnInit, OnDestroy {
  layers: Layer[] = [];
  baseMaps: BaseMapOption[] = [];
  selectedBaseMap: string = 'osm';
  panelExpanded: boolean = true;
  allExpanded: boolean = false;
  expandedLayers = new Set<number>();
  private pollInterval: any;

  private subscriptions: Subscription[] = [];

  private layerService = inject(LayerService);
  private projectContext = inject(ProjectContextService);
  private baseMapService = inject(BaseMapService);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);

  get isAdminOrDirector(): boolean {
    const role = this.authService.currentUser()?.role;
    return role === 'administrador' || role === 'director';
  }

  ngOnInit(): void {
    // Cargar mapas base disponibles
    this.baseMaps = this.baseMapService.baseMaps;
    this.selectedBaseMap = this.baseMapService.getCurrentBaseMap();

    // Suscribirse a cambios en las capas
    this.subscriptions.push(
      this.layerService.layers$.subscribe(layers => {
        this.layers = layers;
        this.checkProcessingStatus();
        this.cdr.detectChanges();
      })
    );

    // Cargar capas del proyecto actual
    const project = this.projectContext.getActiveProject();
    if (project) {
      this.layerService.getProjectLayers(project.id).subscribe();
    }

    // Iniciar polling
    this.startPolling();
  }

  ngOnDestroy(): void {
    this.stopPolling();
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  startPolling() {
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.pollInterval = setInterval(() => {
      const project = this.projectContext.getActiveProject();
      if (project && this.hasProcessingLayers()) {
        this.layerService.getProjectLayers(project.id).subscribe();
      }
    }, 3000);
  }

  stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  hasProcessingLayers(): boolean {
    return this.layers.some(l => (l as any).processing_status === 'processing' || (l as any).processing_status === 'pending');
  }

  checkProcessingStatus() {
    // Si ya no hay capas procesando, podríamos detener el polling o bajar la frecuencia
    // Pero por simplicidad mantenemos el polling si hay capas pendiente
  }

  togglePanel(): void {
    this.panelExpanded = !this.panelExpanded;
  }

  expandAll(): void {
    this.allExpanded = !this.allExpanded;
    if (this.allExpanded) {
      this.layers.forEach(layer => this.expandedLayers.add(layer.id));
    } else {
      this.expandedLayers.clear();
    }
  }

  toggleLayerVisibility(layerId: number): void {
    this.layerService.toggleLayerVisibility(layerId).subscribe();
  }

  onOpacityChange(layerId: number, event: any): void {
    const opacity = parseInt(event.target.value, 10);
    this.layerService.setLayerOpacity(layerId, opacity).subscribe();
  }

  onBaseMapChange(): void {
    this.baseMapService.setBaseMap(this.selectedBaseMap);
  }

  zoomToLayer(layer: Layer): void {
    // Implementar zoom a capa
    console.log('Zoom to layer:', layer);
  }

  deleteLayer(layerId: number): void {
    if (confirm('¿Estás seguro de que deseas eliminar esta capa?')) {
      this.layerService.deleteLayer(layerId).subscribe();
    }
  }

  getLayerIcon(layerType: string): string {
    const icons: { [key: string]: string } = {
      'raster': 'image',
      'vector': 'vector',
      '3d_model': 'cube',
      'point_cloud': 'cloud',
      'cad': 'draft',
      'kml': 'map-marker'
    };
    return icons[layerType] || 'layer';
  }
}
