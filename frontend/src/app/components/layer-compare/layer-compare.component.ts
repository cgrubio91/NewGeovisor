import { Component, OnInit, OnDestroy, ElementRef, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MapService } from '../../services/map.service';
import { Map3dService } from '../../services/map3d.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-layer-compare',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- Compare Panel - triggered from layer control -->
    <div class="compare-container" *ngIf="isActive">
      <div class="compare-header">
        <h4>Comparar Capas</h4>
        <button class="btn-close" (click)="closeCompare()">×</button>
      </div>

      <div class="compare-controls">
        <div class="control-group">
          <label>Capa Superior (Izquierda):</label>
          <select [(ngModel)]="leftLayerId" (change)="onLayerChange()">
            <option [ngValue]="null">Seleccionar capa...</option>
            <option *ngFor="let layer of availableLayers" [ngValue]="layer.id">
              {{ layer.name }}
            </option>
          </select>
        </div>

        <div class="control-group">
          <label>Capa Base (Derecha):</label>
          <select [(ngModel)]="rightLayerId" (change)="onLayerChange()">
            <option [ngValue]="null">Seleccionar capa...</option>
            <option *ngFor="let layer of availableLayers" [ngValue]="layer.id">
              {{ layer.name }}
            </option>
          </select>
        </div>

        <div class="control-group">
          <label>Modo de Comparación:</label>
          <div class="mode-buttons">
            <button 
              [class.active]="compareMode === 'swipe'"
              (click)="setCompareMode('swipe')"
              class="mode-btn"
            >
              <i class="icon-swipe"></i> Cortinilla
            </button>
            <button 
              [class.active]="compareMode === 'opacity'"
              (click)="setCompareMode('opacity')"
              class="mode-btn"
            >
              <i class="icon-layers"></i> Opacidad
            </button>
          </div>
        </div>

        <!-- Control de cortinilla -->
        <div class="control-group" *ngIf="compareMode === 'swipe'">
          <label>Posición: {{ swipePosition }}%</label>
          <input 
            type="range" 
            min="0" 
            max="100" 
            [(ngModel)]="swipePosition"
            (input)="onSwipeChange()"
            class="swipe-slider"
          />
        </div>

        <!-- Control de opacidad para modo overlay -->
        <div class="control-group" *ngIf="compareMode === 'opacity'">
          <label>Opacidad Capa Superior: {{ overlayOpacity }}%</label>
          <input 
            type="range" 
            min="0" 
            max="100" 
            [(ngModel)]="overlayOpacity"
            (input)="onOpacityChange()"
            class="opacity-slider"
          />
        </div>
      </div>
    </div>

    <!-- Visual Swipe Line Overlay -->
    <div class="swipe-visual-line" 
         *ngIf="isActive && compareMode === 'swipe'" 
         [style.left.%]="swipePosition"
         (mousedown)="startDrag($event)"
         (touchstart)="startDrag($event)">
         <div class="swipe-handle">
             <i class="fas fa-arrows-alt-h"></i>
         </div>
    </div>
  `,
  styles: [`
    .compare-container {
      position: absolute;
      top: 100px;
      right: 20px;
      width: 320px;
      background: rgba(10, 25, 41, 0.95);
      backdrop-filter: blur(12px);
      border-radius: 12px;
      border: 1px solid rgba(0, 193, 210, 0.4);
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
      z-index: 1000;
      overflow: hidden;
      font-family: 'Outfit', sans-serif;
    }

    .compare-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 16px;
      background: rgba(0, 193, 210, 0.1);
      border-bottom: 1px solid rgba(0, 193, 210, 0.2);
      color: #00c1d2;
    }

    .compare-header h4 {
      margin: 0;
      font-size: 15px;
      font-weight: 600;
    }

    .btn-close {
      background: none;
      border: none;
      color: #94a3b8;
      font-size: 22px;
      cursor: pointer;
      padding: 0;
      line-height: 1;
      transition: color 0.2s;
    }
    .btn-close:hover { color: #ef4444; }

    .compare-controls {
      padding: 16px;
    }

    .control-group {
      margin-bottom: 16px;
    }

    .control-group label {
      display: block;
      margin-bottom: 6px;
      font-weight: 500;
      color: #94a3b8;
      font-size: 12px;
    }

    .control-group select {
      width: 100%;
      padding: 10px;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 6px;
      font-size: 13px;
      background: rgba(0,0,0,0.2);
      color: white;
    }
    .control-group select:focus {
      outline: none;
      border-color: #00c1d2;
    }

    .mode-buttons {
      display: flex;
      gap: 8px;
    }

    .mode-btn {
      flex: 1;
      padding: 10px 12px;
      border: 1px solid rgba(255,255,255,0.1);
      background: rgba(0,0,0,0.2);
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      color: #94a3b8;
      transition: all 0.2s;
    }

    .mode-btn.active {
      background: rgba(0, 193, 210, 0.2);
      color: #00c1d2;
      border-color: #00c1d2;
    }
    .mode-btn:hover:not(.active) {
      background: rgba(255,255,255,0.05);
      color: white;
    }

    input[type=range] {
        width: 100%;
        cursor: pointer;
        accent-color: #00c1d2;
    }

    /* Swipe Visual Line */
    .swipe-visual-line {
      position: fixed;
      top: 0;
      bottom: 0;
      width: 4px;
      transform: translateX(-50%);
      background: linear-gradient(to bottom, #00c1d2 0%, rgba(0,193,210,0.5) 50%, #00c1d2 100%);
      z-index: 999;
      pointer-events: auto;
      cursor: col-resize;
      box-shadow: 0 0 10px rgba(0,193,210,0.5);
    }
    
    .swipe-handle {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 36px;
      height: 36px;
      background: rgba(10, 25, 41, 0.95);
      border: 2px solid #00c1d2;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #00c1d2;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
      font-size: 14px;
    }
  `]
})
export class LayerCompareComponent implements OnInit, OnDestroy {
  availableLayers: any[] = [];
  isActive: boolean = false;
  leftLayerId: any = null;
  rightLayerId: any = null;
  compareMode: 'swipe' | 'opacity' = 'swipe';
  swipePosition: number = 50;
  overlayOpacity: number = 50;

  private originalZIndexes: Map<string | number, number> = new Map();
  private previouslyHiddenLayers: Set<string | number> = new Set();
  private layersSub: Subscription | undefined;
  private compareSub: Subscription | undefined;

  private dragActive = false;

  constructor(
    private mapService: MapService,
    private map3dService: Map3dService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.layersSub = this.mapService.layersChanged.subscribe(layers => {
      this.availableLayers = layers;
    });

    this.compareSub = this.mapService.compareToolTrigger.subscribe(layerId => {
      console.log('Layer Compare Component: Received trigger for layer', layerId);
      if (layerId !== undefined) {
        this.isActive = true;
        this.leftLayerId = layerId;

        // Find another visible layer for comparison if one isn't already set
        if (!this.rightLayerId) {
          const otherLayer = this.availableLayers.find(l => l.id !== layerId && l.visible && l.type !== 'base');
          if (otherLayer) {
            this.rightLayerId = otherLayer.id;
          }
        }

        this.applyComparison();
        this.cdr.detectChanges();
      }
    });

    // Add global event listeners for drag
    window.addEventListener('mousemove', this.onDrag.bind(this));
    window.addEventListener('mouseup', this.endDrag.bind(this));
    window.addEventListener('touchmove', this.onDrag.bind(this));
    window.addEventListener('touchend', this.endDrag.bind(this));
  }

  ngOnDestroy(): void {
    if (this.layersSub) this.layersSub.unsubscribe();
    if (this.compareSub) this.compareSub.unsubscribe();

    this.resetComparison();

    window.removeEventListener('mousemove', this.onDrag.bind(this));
    window.removeEventListener('mouseup', this.endDrag.bind(this));
    window.removeEventListener('touchmove', this.onDrag.bind(this));
    window.removeEventListener('touchend', this.endDrag.bind(this));
  }

  startDrag(event: MouseEvent | TouchEvent): void {
    this.dragActive = true;
    event.preventDefault();
  }

  onDrag(event: MouseEvent | TouchEvent): void {
    if (!this.dragActive) return;

    let clientX;
    if (event instanceof MouseEvent) {
      clientX = event.clientX;
    } else {
      clientX = event.touches[0].clientX;
    }

    const mapSize = this.mapService.getMap()?.getSize();
    const width = mapSize ? mapSize[0] : window.innerWidth;
    let percent = (clientX / width) * 100;
    percent = Math.max(0, Math.min(100, percent));

    this.swipePosition = percent;
    this.onSwipeChange();
  }

  endDrag(): void {
    this.dragActive = false;
  }

  closeCompare(): void {
    this.isActive = false;
    this.resetComparison();
  }

  setCompareMode(mode: 'swipe' | 'opacity'): void {
    this.compareMode = mode;
    // Cleanup swipe listeners before changing mode
    this.mapService.disableAllSwipe();
    this.map3dService.disableAllSwipe();

    this.applyComparison();
  }

  onLayerChange(): void {
    this.applyComparison();
  }

  onSwipeChange(): void {
    if (this.compareMode === 'swipe') {
      this.mapService.setSwipePosition(this.swipePosition);
      this.map3dService.setSwipePosition(this.swipePosition);
    }
  }

  onOpacityChange(): void {
    if (this.compareMode === 'opacity' && this.leftLayerId) {
      this.mapService.setLayerOpacity(this.leftLayerId, this.overlayOpacity / 100);
      this.map3dService.setLayerOpacity(this.leftLayerId, this.overlayOpacity / 100);
    }
  }

  applyComparison(): void {
    if (!this.leftLayerId || !this.rightLayerId) return;

    // Avoid comparing same layer
    if (this.leftLayerId == this.rightLayerId) {
      console.warn('LayerCompare: Cannot compare a layer with itself');
      return;
    }

    console.log(`LayerCompare: Applying comparison between ${this.leftLayerId} and ${this.rightLayerId}`);

    // Reset currently active effects to avoid state mess
    this.mapService.disableAllSwipe();
    this.map3dService.disableAllSwipe();

    // 1. Hide all OTHER non-base layers
    this.availableLayers.forEach(layer => {
      const isSelected = layer.id == this.leftLayerId || layer.id == this.rightLayerId;
      if (layer.type !== 'base' && !isSelected) {
        if (layer.visible) {
          this.previouslyHiddenLayers.add(layer.id);
          this.mapService.setLayerVisibility(layer.id, false);
          this.map3dService.setLayerVisibility(layer.id, false);
        }
      }
    });

    // 2. Save original z-indexes
    if (!this.originalZIndexes.has(this.leftLayerId)) {
      const l = this.availableLayers.find(layer => layer.id == this.leftLayerId);
      if (l) this.originalZIndexes.set(this.leftLayerId, l.z_index || 0);
    }
    if (!this.originalZIndexes.has(this.rightLayerId)) {
      const r = this.availableLayers.find(layer => layer.id == this.rightLayerId);
      if (r) this.originalZIndexes.set(this.rightLayerId, r.z_index || 0);
    }

    // 3. Ensure both selected layers are VISIBLE
    const leftLayer = this.availableLayers.find(l => l.id == this.leftLayerId);
    if (leftLayer && !leftLayer.visible) {
      this.mapService.setLayerVisibility(this.leftLayerId, true);
      this.map3dService.setLayerVisibility(this.leftLayerId, true);
    }

    const rightLayer = this.availableLayers.find(l => l.id == this.rightLayerId);
    if (rightLayer && !rightLayer.visible) {
      this.mapService.setLayerVisibility(this.rightLayerId, true);
      this.map3dService.setLayerVisibility(this.rightLayerId, true);
    }

    // 4. Set stack order (Z-index)
    this.mapService.setLayerZIndex(this.rightLayerId, 100);
    this.mapService.setLayerZIndex(this.leftLayerId, 200);

    // In 3D
    this.map3dService.bringToFront(this.rightLayerId); // Lower first
    this.map3dService.bringToFront(this.leftLayerId);  // Top second

    // 5. Apply mode effects
    if (this.compareMode === 'swipe') {
      this.mapService.setLayerOpacity(this.leftLayerId, 1);
      this.mapService.setLayerOpacity(this.rightLayerId, 1);
      this.map3dService.setLayerOpacity(this.leftLayerId, 1);
      this.map3dService.setLayerOpacity(this.rightLayerId, 1);

      this.mapService.enableSwipe(this.leftLayerId, 'left');
      this.mapService.enableSwipe(this.rightLayerId, 'right');
      this.mapService.setSwipePosition(this.swipePosition);

      this.map3dService.enableSwipe(this.leftLayerId, 'left');
      this.map3dService.enableSwipe(this.rightLayerId, 'right');
      this.map3dService.setSwipePosition(this.swipePosition);
    } else {
      // Opacity Mode
      this.mapService.setLayerOpacity(this.leftLayerId, this.overlayOpacity / 100);
      this.mapService.setLayerOpacity(this.rightLayerId, 1);
      this.map3dService.setLayerOpacity(this.leftLayerId, this.overlayOpacity / 100);
      this.map3dService.setLayerOpacity(this.rightLayerId, 1);
    }

    this.cdr.detectChanges();
  }

  resetComparison(): void {
    // Disable all swipe listeners
    this.mapService.disableAllSwipe();
    this.map3dService.disableAllSwipe();

    // Restore original z-indexes and opacities
    this.originalZIndexes.forEach((z, id) => {
      this.mapService.setLayerZIndex(id, z);
      const layer = this.availableLayers.find(l => l.id == id);
      if (layer) {
        this.mapService.setLayerOpacity(id, layer.opacity !== undefined ? layer.opacity : 1);
        this.map3dService.setLayerOpacity(id, layer.opacity !== undefined ? layer.opacity : 1);
      }
    });

    // Restore visibility of layers we hid
    this.previouslyHiddenLayers.forEach(id => {
      this.mapService.setLayerVisibility(id, true);
      this.map3dService.setLayerVisibility(id, true);
    });

    this.originalZIndexes.clear();
    this.previouslyHiddenLayers.clear();
    this.leftLayerId = null;
    this.rightLayerId = null;
    this.swipePosition = 50;
    this.overlayOpacity = 50;
  }
}
