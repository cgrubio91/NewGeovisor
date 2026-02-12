import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MapService } from '../../services/map.service';

@Component({
    selector: 'app-basemap-selector',
    standalone: true,
    imports: [CommonModule],
    template: `
    <div class="basemap-selector" [class.expanded]="isExpanded">
      <button class="selector-btn" (click)="isExpanded = !isExpanded" title="Cambiar Mapa Base">
        <i class="fas fa-layer-group"></i>
      </button>
      
      <div class="options-panel" *ngIf="isExpanded">
        <div class="option" 
             [class.active]="currentBasemap === 'osm'" 
             (click)="setBasemap('osm')">
          <div class="preview osm"></div>
          <span>Mapa</span>
        </div>
        <div class="option" 
             [class.active]="currentBasemap === 'satellite'" 
             (click)="setBasemap('satellite')">
          <div class="preview satellite"></div>
          <span>Satélite</span>
        </div>
      </div>
    </div>
  `,
    styles: [`
    .basemap-selector {
      position: absolute;
      bottom: 24px;
      right: 24px;
      z-index: 100;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 12px;
    }

    .selector-btn {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      background: var(--bg-card);
      border: 1px solid rgba(0, 193, 210, 0.3);
      color: var(--color-primary-cyan);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.2rem;
      box-shadow: var(--shadow-lg);
      transition: all 0.2s;
    }

    .selector-btn:hover {
      background: var(--bg-hover);
      transform: scale(1.05);
      border-color: var(--color-primary-cyan);
    }

    .options-panel {
      background: var(--bg-card);
      border-radius: 16px;
      padding: 12px;
      display: flex;
      gap: 12px;
      box-shadow: var(--shadow-xl);
      border: 1px solid rgba(0, 193, 210, 0.2);
      animation: slideIn 0.3s ease-out;
    }

    .option {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      padding: 4px;
      border-radius: 8px;
      transition: all 0.2s;
    }

    .option:hover .preview {
      transform: scale(1.05);
      border-color: var(--color-primary-cyan);
    }

    .option.active span {
      color: var(--color-primary-cyan);
      font-weight: 600;
    }

    .preview {
      width: 60px;
      height: 60px;
      border-radius: 8px;
      border: 2px solid transparent;
      background-size: cover;
      transition: all 0.2s;
    }

    .preview.osm {
      background-image: url('https://a.tile.openstreetmap.org/12/2117/2334.png');
      background-color: #eee;
    }

    .preview.satellite {
      background-image: url('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/12/2334/2117');
      background-color: #111;
    }

    .option.active .preview {
      border-color: var(--color-primary-cyan);
      box-shadow: 0 0 10px rgba(0, 193, 210, 0.4);
    }

    span {
      font-size: 0.75rem;
      color: var(--text-secondary);
    }

    @keyframes slideIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `]
})
export class BasemapSelectorComponent {
    isExpanded = false;
    currentBasemap = 'osm';
    private mapService = inject(MapService);

    setBasemap(id: string) {
        this.currentBasemap = id;
        this.mapService.toggleLayerVisibility(id);
        this.isExpanded = false;
    }
}
