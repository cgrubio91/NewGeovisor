import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MapService } from '../../services/map.service';
import { Map3dService } from '../../services/map3d.service';
import { ProjectContextService } from '../../services/project-context.service';
import { ProjectService } from '../../services/project.service';
import { ToastService } from '../../services/toast.service';
import { Layer, Folder } from '../../models/models';

@Component({
  selector: 'app-layer-control',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="layer-control card" [class.collapsed]="isCollapsed">
      <div class="panel-header" (click)="toggleCollapse()">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
          <polyline points="2 17 12 22 22 17"></polyline>
          <polyline points="2 12 12 17 22 12"></polyline>
        </svg>
        <h3 *ngIf="!isCollapsed">Capas del Proyecto</h3>
        <button class="action-btn toggle-btn" (click)="toggleCollapse(); $event.stopPropagation()">
            <i class="fas" [class.fa-chevron-left]="!isCollapsed" [class.fa-chevron-right]="isCollapsed"></i>
        </button>
        <div class="header-actions" *ngIf="!isCollapsed">
           <button class="action-btn" (click)="showNewFolderInput = !showNewFolderInput; $event.stopPropagation()" title="Nueva Carpeta">
             <i class="fas fa-folder-plus"></i>
           </button>
           <button class="action-btn" (click)="zoomToAll(); $event.stopPropagation()" title="Zoom a Todas">
             <i class="fas fa-search-location"></i>
           </button>
        </div>
      </div>

      <div class="content-wrapper" *ngIf="!isCollapsed">
          <div class="search-bar" *ngIf="!showNewFolderInput">
            <i class="fas fa-search"></i>
            <input type="text" placeholder="Buscar..." [(ngModel)]="searchTerm" (input)="filterItems()">
          </div>

          <div class="new-folder-bar" *ngIf="showNewFolderInput">
             <input type="text" #folderInput placeholder="Nombre de carpeta..." (keyup.enter)="createFolder(folderInput.value); folderInput.value=''">
             <button (click)="createFolder(folderInput.value); folderInput.value=''"><i class="fas fa-check"></i></button>
             <button (click)="showNewFolderInput = false"><i class="fas fa-times"></i></button>
          </div>

          <div class="layers-container">
            <!-- Root Layers (No Folder) -->
            <div class="folder-content root-layers-content">
              <ng-container *ngFor="let layer of rootLayers; trackBy: trackLayer">
                 <ng-container *ngTemplateOutlet="layerItem; context: { $implicit: layer }"></ng-container>
              </ng-container>
            </div>

            <!-- Folders -->
            <div class="folder-item" *ngFor="let folder of folders; trackBy: trackFolder">
              <div class="folder-header" (click)="toggleFolder(folder)">
                <i class="fas" [class.fa-chevron-down]="folderExpanded[folder.id]" [class.fa-chevron-right]="!folderExpanded[folder.id]"></i>
                <i class="fas fa-folder"></i>
                <span class="folder-name">{{ folder.name }}</span>
                <div class="folder-actions" (click)="$event.stopPropagation()">
                   <button class="action-btn mini" (click)="deleteFolder(folder)" title="Eliminar Carpeta">
                     <i class="fas fa-trash"></i>
                   </button>
                </div>
              </div>
              <div class="folder-content" *ngIf="folderExpanded[folder.id]">
                 <ng-container *ngFor="let layer of getLayersInFolder(folder.id); trackBy: trackLayer">
                    <ng-container *ngTemplateOutlet="layerItem; context: { $implicit: layer }"></ng-container>
                 </ng-container>
                 <div class="empty-folder" *ngIf="getLayersInFolder(folder.id).length === 0">
                   Carpeta vacía
                 </div>
              </div>
            </div>

            <div class="empty-state" *ngIf="layers.length === 0 && folders.length === 0">
              <p>No hay elementos cargados</p>
            </div>
          </div>

          <!-- Compare Layers Button - Below all layers -->
          <div class="compare-section" *ngIf="layers.length >= 2">
            <button class="compare-btn" (click)="openGlobalCompareTool()" title="Comparar capas mediante cortinilla u opacidad">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="8" height="18" rx="1"></rect>
                <rect x="13" y="3" width="8" height="18" rx="1"></rect>
                <line x1="12" y1="3" x2="12" y2="21"></line>
              </svg>
              <span>Comparar Capas</span>
            </button>
          </div>
      </div>
      
      <!-- Reusable Layer Template -->
      <ng-template #layerItem let-layer>
        <div class="layer-item" [class.active]="layer.visible">
          <div class="layer-main">
            <label class="checkbox-container">
              <input type="checkbox" [checked]="layer.visible" (change)="toggleVisibility(layer.id)">
              <span class="checkmark"></span>
              <span class="layer-name" [title]="layer.name">{{ layer.name }}</span>
            </label>
            
            <div class="layer-actions">
              <!-- Reordering Buttons -->
              <button class="action-btn mini" (click)="reorderLayer(layer, 1); $event.stopPropagation()" title="Subir">
                <i class="fas fa-chevron-up"></i>
              </button>
              <button class="action-btn mini" (click)="reorderLayer(layer, -1); $event.stopPropagation()" title="Bajar">
                <i class="fas fa-chevron-down"></i>
              </button>

              <div class="dropdown" (click)="$event.stopPropagation()">
                <button class="action-btn dropbtn" title="Acciones">
                   <i class="fas fa-ellipsis-v"></i>
                </button>
                <div class="dropdown-content">
                  <a (click)="moveLayer(layer, undefined)">Mover a Raíz</a>
                  <a *ngFor="let f of folders" (click)="moveLayer(layer, f.id)">Mover a {{f.name}}</a>
                  <hr>
                  <a class="text-danger" (click)="deleteLayer(layer)">Eliminar Capa</a>
                </div>
              </div>
              
                <button class="action-btn" (click)="downloadLayer(layer); $event.stopPropagation()" title="Descargar">
                  <i class="fas fa-download"></i>
                </button>
                
                <button class="action-btn" (click)="zoomToLayer(layer); $event.stopPropagation()" title="Zoom">
                  <i class="fas fa-search-plus"></i>
                </button>
              </div>
          </div>
          
          <div class="layer-details" *ngIf="layer.visible">
            <div class="opacity-container">
               <i class="fas fa-adjust"></i>
              <input type="range" min="0" max="1" step="0.05" [value]="layer.opacity" (input)="setOpacity(layer.id, $event)">
              <span class="val">{{(layer.opacity * 100).toFixed(0)}}%</span>
            </div>
          </div>
        </div>
      </ng-template>
    </div>
  `,
  styles: [`
    .layer-control {
      position: absolute; 
      top: 100px;
      left: 20px;
      width: 320px;
      max-height: calc(100vh - 140px); 
      z-index: 1000;
      background: rgba(10, 25, 41, 0.95); 
      backdrop-filter: blur(12px);
      border: 1px solid rgba(0, 193, 210, 0.4); 
      display: flex; 
      flex-direction: column;
      overflow: hidden; 
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
      border-radius: 12px;
      transition: width 0.3s ease, height 0.3s ease;
    }
    
    .layer-control.collapsed {
        width: 60px;
        height: auto;
        overflow: hidden;
    }

    .panel-header { 
        padding: 16px; 
        border-bottom: 1px solid rgba(0, 255, 255, 0.1); 
        display: flex; 
        align-items: center; 
        gap: 10px; 
        cursor: pointer;
        justify-content: space-between;
    }
    .panel-header h3 { font-size: 1rem; margin: 0; flex: 1; color: var(--color-primary-cyan); white-space: nowrap; overflow: hidden; }
    .header-actions { display: flex; gap: 4px; }
    
    .toggle-btn { margin-left: auto; }

    .content-wrapper {
        display: flex;
        flex-direction: column;
        flex: 1;
        overflow: hidden;
    }

    .search-bar, .new-folder-bar { padding: 10px; background: rgba(255, 255, 255, 0.05); border-bottom: 1px solid rgba(255, 255, 255, 0.1); display: flex; gap: 8px; align-items: center; }
    .search-bar input, .new-folder-bar input { background: transparent; border: none; color: white; flex: 1; font-size: 0.85rem; outline: none; }
    .new-folder-bar button { background: none; border: none; color: #00c1d2; cursor: pointer; }

    .layers-container { overflow-y: auto; flex: 1; padding: 10px; }
    .layers-container::-webkit-scrollbar { width: 6px; }
    .layers-container::-webkit-scrollbar-track { background: rgba(0,0,0,0.1); }
    .layers-container::-webkit-scrollbar-thumb { background: rgba(0, 193, 210, 0.3); border-radius: 3px; }
    
    .folder-item { margin-bottom: 5px; }
    .folder-header { 
      padding: 8px; display: flex; align-items: center; gap: 8px; 
      cursor: pointer; background: rgba(255,255,255,0.03); border-radius: 6px;
      font-size: 0.85rem; font-weight: 600;
      color: white;
    }
    .folder-header:hover { background: rgba(255,255,255,0.08); }
    .folder-header i.fa-folder { color: #facc15; }
    .folder-header .folder-name { flex: 1; }
    .folder-content { padding-left: 15px; border-left: 1px dashed rgba(255,255,255,0.1); margin-top: 4px; }
    .root-layers-content { border-left: none; padding-left: 0; }
    
    .layer-item { 
       padding: 8px; border-radius: 6px; margin-bottom: 4px; 
       background: rgba(255,255,255,0.01); transition: all 0.2s;
    }
    .layer-item:hover { background: rgba(255,255,255,0.05); }
    
    .layer-main { 
        display: flex; 
        align-items: center; 
        justify-content: space-between; 
        gap: 8px;
    }
    .layer-name { 
        font-size: 0.8rem; 
        color: #cbd5e1; 
        overflow: hidden; 
        text-overflow: ellipsis; 
        white-space: nowrap; 
        flex: 1;
        min-width: 0;
    }
    .active .layer-name { color: white; font-weight: 500; }
    
    .layer-actions { 
        display: flex; 
        gap: 6px; 
        align-items: center; 
        flex-shrink: 0;
    }
    
    .action-btn { 
      background: none; border: none; color: #94a3b8; cursor: pointer; 
      width: 32px; height: 32px; border-radius: 6px; display: flex; align-items: center; justify-content: center;
      transition: all 0.2s;
    }
    .action-btn:hover { color: #00c1d2; background: rgba(0, 193, 210, 0.1); }
    .action-btn.mini { width: 24px; height: 24px; font-size: 0.75rem; }
    
    /* Swipe Button - Styled to match theme */
    .swipe-btn {
        color: #00c1d2;
        border: 1px solid rgba(0, 193, 210, 0.3);
    }
    .swipe-btn:hover {
        background: rgba(0, 193, 210, 0.2);
        color: white;
        box-shadow: 0 0 8px rgba(0, 193, 210, 0.4);
    }

    .checkbox-container { display: flex; align-items: center; gap: 8px; cursor: pointer; }
    .checkbox-container input { display: none; }
    .checkmark { width: 16px; height: 16px; border: 1px solid rgba(255,255,255,0.3); border-radius: 3px; }
    input:checked ~ .checkmark { background: #00c1d2; border-color: #00c1d2; }
    
    .layer-details { margin-top: 8px; padding-left: 24px; }
    .opacity-container { display: flex; align-items: center; gap: 8px; font-size: 0.7rem; color: #94a3b8; }
    .opacity-container input { flex: 1; height: 3px; accent-color: #00c1d2; }

    /* Dropdown */
    .dropdown { position: relative; display: inline-block; }
    .dropdown-content {
      display: none; position: absolute; right: 0; background-color: #1e293b;
      min-width: 140px; box-shadow: 0 8px 16px rgba(0,0,0,0.5); z-index: 1001;
      border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); overflow: hidden;
    }
    .dropdown:hover .dropdown-content { display: block; }
    .dropdown-content a {
      color: #94a3b8; padding: 10px 12px; text-decoration: none; display: block; font-size: 0.75rem;
      cursor: pointer;
    }
    .dropdown-content a:hover { background-color: rgba(255,255,255,0.1); color: white; }
    .text-danger { color: #ef4444 !important; }

    .empty-folder { font-size: 0.7rem; padding: 5px; color: #64748b; font-style: italic; }
    .empty-state { text-align: center; padding: 30px; color: #64748b; font-size: 0.85rem; }

    /* Compare Section */
    .compare-section {
      padding: 12px;
      border-top: 1px solid rgba(0, 193, 210, 0.2);
      margin-top: 8px;
    }

    .compare-btn {
      width: 100%;
      padding: 12px 16px;
      background: linear-gradient(135deg, rgba(0, 193, 210, 0.15), rgba(0, 193, 210, 0.05));
      border: 1px solid rgba(0, 193, 210, 0.4);
      border-radius: 8px;
      color: #00c1d2;
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      transition: all 0.3s ease;
    }

    .compare-btn:hover {
      background: linear-gradient(135deg, rgba(0, 193, 210, 0.3), rgba(0, 193, 210, 0.15));
      border-color: #00c1d2;
      box-shadow: 0 0 15px rgba(0, 193, 210, 0.3);
      transform: translateY(-2px);
    }

    .compare-btn svg {
      flex-shrink: 0;
    }
  `]
})
export class LayerControlComponent implements OnInit {
  layers: any[] = [];
  folders: Folder[] = [];
  rootLayers: any[] = [];
  folderExpanded: Record<number, boolean> = {};

  searchTerm = '';
  showNewFolderInput = false;
  isCollapsed = false;

  private mapService = inject(MapService);
  private map3dService = inject(Map3dService);
  private projectContext = inject(ProjectContextService);
  private projectService = inject(ProjectService);
  private toastService = inject(ToastService);

  ngOnInit(): void {
    console.log('LayerControlComponent initialized');

    // Sincronizar capas desde el MapService
    this.mapService.layersChanged.subscribe(layers => {
      this.layers = layers;
      this.filterItems();
    });

    // Sincronizar carpetas desde el Proyecto Activo
    this.projectContext.activeProject$.subscribe(project => {
      if (project) {
        this.folders = project.folders || [];
        this.filterItems();
      }
    });
  }

  toggleCollapse() {
    this.isCollapsed = !this.isCollapsed;
  }

  filterItems() {
    const term = this.searchTerm.toLowerCase();
    const allLayers = term ? this.layers.filter(l => l.name.toLowerCase().includes(term)) : this.layers;
    this.rootLayers = allLayers.filter(l => !l.folder_id);
  }

  getLayersInFolder(folderId: number) {
    const term = this.searchTerm.toLowerCase();
    return (term ? this.layers.filter(l => l.name.toLowerCase().includes(term)) : this.layers)
      .filter(l => l.folder_id === folderId);
  }

  toggleFolder(folder: Folder) {
    this.folderExpanded[folder.id] = !this.folderExpanded[folder.id];
  }

  createFolder(name: string) {
    if (!name) return;
    const projectId = this.projectContext.getActiveProjectId();
    if (!projectId) return;

    this.projectService.createFolder(name, projectId).subscribe({
      next: (folder) => {
        this.showNewFolderInput = false;
        this.toastService.show('Carpeta creada', 'success');

        const project = this.projectContext.getActiveProject();
        if (project) {
          project.folders = [...(project.folders || []), folder];
          this.projectContext.setActiveProject(project);
        }
      },
      error: (err) => {
        console.error('Error creating folder:', err);
        this.toastService.show('Error al crear carpeta', 'error');
      }
    });
  }

  deleteFolder(folder: Folder) {
    if (!confirm(`¿Eliminar la carpeta "${folder.name}"? Las capas volverán a la raíz.`)) return;

    this.projectService.deleteFolder(folder.id).subscribe({
      next: () => {
        this.folders = this.folders.filter(f => f.id !== folder.id);
        this.layers.forEach(l => {
          if (l.folder_id === folder.id) l.folder_id = null;
        });
        this.filterItems();
        this.toastService.show('Carpeta eliminada', 'success');
      }
    });
  }

  moveLayer(layer: any, folderId?: number) {
    if (typeof layer.id !== 'number') {
      this.toastService.show('No se puede mover esta capa (capa base o sistema)', 'info');
      return;
    }

    this.projectService.updateLayer(layer.id, { folder_id: folderId || null }).subscribe({
      next: () => {
        layer.folder_id = folderId || null;
        this.filterItems();
        this.toastService.show('Capa movida', 'success');
      }
    });
  }

  deleteLayer(layer: any) {
    if (!confirm(`¿Eliminar la capa "${layer.name}" permanentemente?`)) return;

    if (typeof layer.id !== 'number') {
      this.mapService.removeLayer(layer.id);
      return;
    }

    this.projectService.deleteLayer(layer.id).subscribe({
      next: () => {
        this.mapService.removeLayer(layer.id);
        this.toastService.show('Capa eliminada', 'success');
      }
    });
  }

  toggleVisibility(id: string | number) {
    this.mapService.toggleLayerVisibility(id);
    const layer = this.layers.find(l => l.id === id);
    if (layer) {
      this.map3dService.setLayerVisibility(id, !layer.visible);
    }
  }

  setOpacity(id: string | number, event: any) {
    const opacity = parseFloat(event.target.value);
    this.mapService.setLayerOpacity(id, opacity);
    this.map3dService.setLayerOpacity(id, opacity);
  }

  zoomToLayer(layer: any) {
    if (layer.instance) {
      this.mapService.zoomToLayer(layer.instance);
    }
  }

  zoomToAll() {
    if (this.layers.length === 0) return;
    this.mapService.zoomToAllLayers();
  }

  openCompareTool(id: any) {
    console.log('LayerControl: Opening compare tool for layer ID:', id);
    this.mapService.openCompareTool(id);
  }

  reorderLayer(layer: any, delta: number) {
    console.log(`LayerControl: Manual reorder request for layer ${layer.id} (name: ${layer.name}, current Z: ${layer.z_index}) with delta: ${delta}`);

    const currentZ = layer.z_index || 0;
    const newZ = Math.max(0, currentZ + delta);

    // Actualizar mapa localmente
    this.mapService.setLayerZIndex(layer.id, newZ);
    layer.z_index = newZ;

    // Sincronizar con base de datos si es una capa persistente
    if (typeof layer.id === 'number') {
      this.projectService.updateLayer(layer.id, { z_index: newZ }).subscribe({
        next: () => {
          this.toastService.show(`Orden actualizado: Nivel ${newZ}`, 'info');
        },
        error: (err) => {
          console.error('Error updating layer order:', err);
          this.toastService.show('Error al actualizar orden', 'error');
        }
      });
    }
  });
}
  }

downloadLayer(layer: any) {
  if (typeof layer.id !== 'number') return;
  const url = `${this.projectService.getApiUrl()}/layers/${layer.id}/download`;
  window.open(url, '_blank');
}

trackLayer(index: number, item: any) { return item.id; }
trackFolder(index: number, item: Folder) { return item.id; }

openGlobalCompareTool() {
  // Get first two visible layers or first two layers
  const visibleLayers = this.layers.filter(l => l.visible && l.type !== 'base');
  const layersToCompare = visibleLayers.length >= 2 ? visibleLayers : this.layers.filter(l => l.type !== 'base');

  if (layersToCompare.length >= 2) {
    // Open compare tool with the first layer
    this.mapService.openCompareTool(layersToCompare[0].id);
    this.toastService.show('Herramienta de comparación activada', 'info');
  } else {
    this.toastService.show('Necesitas al menos 2 capas para comparar', 'warning');
  }
}
}
