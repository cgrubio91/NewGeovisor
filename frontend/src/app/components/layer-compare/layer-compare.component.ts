import { Component, OnInit, Input, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-layer-compare',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
    <div class="compare-container" *ngIf="isActive">
      <div class="compare-header">
        <h4>Comparar Capas</h4>
        <button class="btn-close" (click)="closeCompare()">×</button>
      </div>

      <div class="compare-controls">
        <div class="control-group">
          <label>Capa Izquierda:</label>
          <select [(ngModel)]="leftLayerId" (change)="onLayerChange()">
            <option [value]="null">Seleccionar capa...</option>
            <option *ngFor="let layer of availableLayers" [value]="layer.id">
              {{ layer.name }}
            </option>
          </select>
        </div>

        <div class="control-group">
          <label>Capa Derecha:</label>
          <select [(ngModel)]="rightLayerId" (change)="onLayerChange()">
            <option [value]="null">Seleccionar capa...</option>
            <option *ngFor="let layer of availableLayers" [value]="layer.id">
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
            <button 
              [class.active]="compareMode === 'split'"
              (click)="setCompareMode('split')"
              class="mode-btn"
            >
              <i class="icon-split"></i> División
            </button>
          </div>
        </div>

        <!-- Control de cortinilla -->
        <div class="control-group" *ngIf="compareMode === 'swipe'">
          <label>Posición de Cortinilla: {{ swipePosition }}%</label>
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

        <!-- Control de división para modo split -->
        <div class="control-group" *ngIf="compareMode === 'split'">
          <label>Orientación:</label>
          <div class="mode-buttons">
            <button 
              [class.active]="splitOrientation === 'vertical'"
              (click)="setSplitOrientation('vertical')"
              class="mode-btn"
            >
              Vertical
            </button>
            <button 
              [class.active]="splitOrientation === 'horizontal'"
              (click)="setSplitOrientation('horizontal')"
              class="mode-btn"
            >
              Horizontal
            </button>
          </div>
        </div>
      </div>

      <!-- Visualización de la comparación -->
      <div class="compare-preview" #comparePreview>
        <div class="preview-info">
          <span class="layer-label left">{{ getLayerName(leftLayerId) }}</span>
          <span class="layer-label right">{{ getLayerName(rightLayerId) }}</span>
        </div>
      </div>
    </div>
  `,
    styles: [`
    .compare-container {
      position: absolute;
      top: 80px;
      right: 20px;
      width: 350px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 1000;
      overflow: hidden;
    }

    .compare-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .compare-header h4 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
    }

    .btn-close {
      background: none;
      border: none;
      color: white;
      font-size: 24px;
      cursor: pointer;
      padding: 0;
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      transition: background 0.2s;
    }

    .btn-close:hover {
      background: rgba(255,255,255,0.2);
    }

    .compare-controls {
      padding: 16px;
      max-height: 500px;
      overflow-y: auto;
    }

    .control-group {
      margin-bottom: 16px;
    }

    .control-group label {
      display: block;
      margin-bottom: 8px;
      font-weight: 500;
      color: #333;
      font-size: 14px;
    }

    .control-group select {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
      background: white;
    }

    .mode-buttons {
      display: flex;
      gap: 8px;
    }

    .mode-btn {
      flex: 1;
      padding: 8px 12px;
      border: 1px solid #ddd;
      background: white;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
    }

    .mode-btn:hover {
      background: #f5f5f5;
      border-color: #667eea;
    }

    .mode-btn.active {
      background: #667eea;
      color: white;
      border-color: #667eea;
    }

    .swipe-slider,
    .opacity-slider {
      width: 100%;
      cursor: pointer;
    }

    .compare-preview {
      position: relative;
      height: 200px;
      background: #f5f5f5;
      border-top: 1px solid #e0e0e0;
    }

    .preview-info {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      display: flex;
      justify-content: space-between;
      padding: 8px;
      background: linear-gradient(to bottom, rgba(0,0,0,0.5), transparent);
      z-index: 10;
    }

    .layer-label {
      font-size: 12px;
      color: white;
      background: rgba(0,0,0,0.6);
      padding: 4px 8px;
      border-radius: 4px;
    }

    .layer-label.left {
      margin-right: auto;
    }

    .layer-label.right {
      margin-left: auto;
    }
  `]
})
export class LayerCompareComponent implements OnInit, AfterViewInit {
    @Input() availableLayers: any[] = [];
    @ViewChild('comparePreview') comparePreview!: ElementRef;

    isActive: boolean = false;
    leftLayerId: number | null = null;
    rightLayerId: number | null = null;
    compareMode: 'swipe' | 'opacity' | 'split' = 'swipe';
    swipePosition: number = 50;
    overlayOpacity: number = 50;
    splitOrientation: 'vertical' | 'horizontal' = 'vertical';

    ngOnInit(): void {
        // Inicialización
    }

    ngAfterViewInit(): void {
        // Configuración después de la vista
    }

    openCompare(): void {
        this.isActive = true;
    }

    closeCompare(): void {
        this.isActive = false;
        this.resetComparison();
    }

    setCompareMode(mode: 'swipe' | 'opacity' | 'split'): void {
        this.compareMode = mode;
        this.applyComparison();
    }

    setSplitOrientation(orientation: 'vertical' | 'horizontal'): void {
        this.splitOrientation = orientation;
        this.applyComparison();
    }

    onLayerChange(): void {
        if (this.leftLayerId && this.rightLayerId) {
            this.applyComparison();
        }
    }

    onSwipeChange(): void {
        this.applyComparison();
    }

    onOpacityChange(): void {
        this.applyComparison();
    }

    applyComparison(): void {
        if (!this.leftLayerId || !this.rightLayerId) {
            return;
        }

        // Emitir evento para que el componente del mapa aplique la comparación
        const comparisonConfig = {
            leftLayerId: this.leftLayerId,
            rightLayerId: this.rightLayerId,
            mode: this.compareMode,
            swipePosition: this.swipePosition,
            overlayOpacity: this.overlayOpacity,
            splitOrientation: this.splitOrientation
        };

        // Aquí se debería emitir un evento o llamar a un servicio
        console.log('Applying comparison:', comparisonConfig);
    }

    resetComparison(): void {
        this.leftLayerId = null;
        this.rightLayerId = null;
        this.swipePosition = 50;
        this.overlayOpacity = 50;
    }

    getLayerName(layerId: number | null): string {
        if (!layerId) return '';
        const layer = this.availableLayers.find(l => l.id === layerId);
        return layer ? layer.name : '';
    }
}
