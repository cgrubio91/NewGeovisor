import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MapComponent } from '../../components/map/map.component';
import { Map3dComponent } from '../../components/map3d/map3d.component';
import { LayerControlComponent } from '../../components/layer-control/layer-control.component';
import { UploadComponent } from '../../components/upload/upload.component';
import { LayerCompareComponent } from '../../components/layer-compare/layer-compare.component';
import { TransformControlComponent } from '../../components/transform-control/transform-control.component';
import { BasemapSelectorComponent } from '../../components/basemap-selector/basemap-selector.component';
import { Map3dService } from '../../services/map3d.service';

@Component({
  selector: 'app-map-view',
  standalone: true,
  imports: [
    CommonModule,
    MapComponent,
    Map3dComponent,
    LayerControlComponent,
    UploadComponent,
    LayerCompareComponent,
    TransformControlComponent,
    BasemapSelectorComponent
  ],
  template: `
    <div class="map-container">
      <div class="map-wrapper" [class.map-3d]="viewMode === '3d'">
        <app-map *ngIf="viewMode === '2d'"></app-map>
        <app-basemap-selector *ngIf="viewMode === '2d'"></app-basemap-selector>
        <app-map3d *ngIf="viewMode === '3d'"></app-map3d>
        
        <!-- Engine Toggle -->
        <div class="engine-toggle">
          <button class="toggle-btn" 
                  [class.active]="viewMode === '2d'" 
                  (click)="viewMode = '2d'"
                  title="Vista 2D">2D</button>
          <button class="toggle-btn" 
                  [class.active]="viewMode === '3d' && map3dService.localModeEnabled" 
                  (click)="switchTo3D('studio')"
                  title="Entorno 3D (Studio)">3D Studio</button>
          <button class="toggle-btn" 
                  [class.active]="viewMode === '3d' && !map3dService.localModeEnabled" 
                  (click)="switchTo3D('globe')"
                  title="Globo Terráqueo">Globo</button>
        </div>
        
        <!-- Transform Gizmo Tools -->
        <app-transform-control *ngIf="viewMode === '3d'"></app-transform-control>
      </div>
      
      <app-layer-control></app-layer-control>
      <app-upload></app-upload>
      <app-layer-compare></app-layer-compare>
    </div>
  `,
  styles: [`
    .map-container {
      display: flex;
      height: 100%;
      width: 100%;
      overflow: hidden;
    }

    .map-wrapper {
      flex: 1;
      position: relative;
      overflow: hidden;
    }

    .map-wrapper.map-3d {
      background: #000;
    }

    .engine-toggle {
      position: absolute;
      top: 20px;
      left: 20px;
      z-index: 1000;
      display: flex;
      gap: 8px;
      background: rgba(0, 0, 0, 0.7);
      padding: 8px;
      border-radius: 8px;
      backdrop-filter: blur(10px);
    }

    .toggle-btn {
      padding: 8px 16px;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.3);
      color: white;
      cursor: pointer;
      border-radius: 4px;
      transition: all 0.3s;
      font-weight: 500;
    }

    .toggle-btn:hover {
      background: rgba(255, 255, 255, 0.2);
      transform: translateY(-2px);
    }

    .toggle-btn.active {
      background: #00d4ff;
      border-color: #00d4ff;
      color: #000;
      box-shadow: 0 4px 12px rgba(0, 212, 255, 0.4);
    }
  `]
})
export class MapViewComponent {
  map3dService = inject(Map3dService);
  viewMode: '2d' | '3d' = '2d';

  switchTo3D(mode: 'studio' | 'globe') {
    this.viewMode = '3d';
    setTimeout(() => {
      if (mode === 'studio') {
        this.map3dService.toggleLocalMode(true);
      } else {
        this.map3dService.toggleLocalMode(false);
      }
    }, 100);
  }
}
