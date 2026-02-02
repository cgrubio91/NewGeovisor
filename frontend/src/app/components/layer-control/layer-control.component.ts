import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MapService } from '../../services/map.service';
import { ProjectContextService } from '../../services/project-context.service';
import { ProjectService } from '../../services/project.service';
import { ToastService } from '../../services/toast.service';
import { Layer, Folder } from '../../models/models';

@Component({
  selector: 'app-layer-control',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="layer-control card">
      <div class="panel-header">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
          <polyline points="2 17 12 22 22 17"></polyline>
          <polyline points="2 12 12 17 22 12"></polyline>
        </svg>
        <h3>Capas del Proyecto</h3>
        <div class="header-actions">
           <button class="action-btn" (click)="showNewFolderInput = !showNewFolderInput" title="Nueva Carpeta">
            <i class="fas fa-folder-plus"></i>
          </button>
          <button class="action-btn" (click)="zoomToAll()" title="Zoom Compartido">
            <i class="fas fa-search-location"></i>
          </button>
        </div>
      </div>

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
              <div class="dropdown" (click)="$event.stopPropagation()">
                <button class="action-btn dropbtn" title="Mover a...">
                   <i class="fas fa-ellipsis-v"></i>
                </button>
                <div class="dropdown-content">
                  <a (click)="moveLayer(layer, undefined)">Raíz</a>
                  <a *ngFor="let f of folders" (click)="moveLayer(layer, f.id)">{{f.name}}</a>
                  <hr>
                  <a class="text-danger" (click)="deleteLayer(layer)">Eliminar</a>
                </div>
              </div>
              <button class="action-btn" (click)="zoomToLayer(layer)" title="Zoom">
                <i class="fas fa-search-plus"></i>
              </button>
              <button *ngIf="layer.layer_type === 'raster'" class="action-btn" 
                      [class.active-swipe]="swipeActive && currentSwipeLayerId === layer.id"
                      (click)="enableSwipe(layer.id)" title="Swipe">
                <i class="fas fa-columns"></i>
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

      @if (swipeActive) {
        <div class="swipe-overlay slide-in-bottom">
           <div class="swipe-header">
             <span><i class="fas fa-columns"></i> Swipe Activo</span>
             <button title="Cerrar" (click)="disableSwipe()"><i class="fas fa-times"></i></button>
           </div>
           <input type="range" class="swipe-range" min="0" max="100" value="50" (input)="onSwipe($event)">
        </div>
      }
    </div>
  `,
  styles: [`
    .layer-control {
      position: absolute; top: 80px; right: 20px; width: 320px;
      max-height: calc(100vh - 120px); z-index: 1000;
      background: rgba(10, 25, 41, 0.9); backdrop-filter: blur(12px);
      border: 1px solid rgba(0, 193, 210, 0.2); display: flex; flex-direction: column;
      overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5);
      border-radius: 12px;
    }
    .panel-header { padding: 16px; border-bottom: 1px solid rgba(0, 255, 255, 0.1); display: flex; align-items: center; gap: 10px; }
    .panel-header h3 { font-size: 1rem; margin: 0; flex: 1; color: var(--color-primary-cyan); }
    .header-actions { display: flex; gap: 4px; }
    
    .search-bar, .new-folder-bar { padding: 10px; background: rgba(255, 255, 255, 0.05); border-bottom: 1px solid rgba(255, 255, 255, 0.1); display: flex; gap: 8px; align-items: center; }
    .search-bar input, .new-folder-bar input { background: transparent; border: none; color: white; flex: 1; font-size: 0.85rem; outline: none; }
    .new-folder-bar button { background: none; border: none; color: #00c1d2; cursor: pointer; }

    .layers-container { overflow-y: auto; flex: 1; padding: 10px; }
    
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
    .layer-main { display: flex; align-items: center; justify-content: space-between; }
    .layer-name { font-size: 0.8rem; color: #cbd5e1; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .active .layer-name { color: white; font-weight: 500; }
    
    .layer-actions { display: flex; gap: 4px; }
    .action-btn { 
      background: none; border: none; color: #94a3b8; cursor: pointer; 
      width: 28px; height: 28px; border-radius: 4px; display: flex; align-items: center; justify-content: center;
    }
    .action-btn:hover { color: #00c1d2; background: rgba(0, 193, 210, 0.1); }
    .action-btn.active-swipe { color: #fb923c; background: rgba(251, 146, 60, 0.1); }
    .action-btn.mini { width: 20px; height: 20px; font-size: 0.7rem; }

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

    .swipe-overlay { padding: 12px; background: rgba(251, 146, 60, 0.1); border-top: 1px solid rgba(251, 146, 60, 0.3); }
    .swipe-header { display: flex; justify-content: space-between; font-size: 0.75rem; color: #fb923c; margin-bottom: 8px; }
    .swipe-range { width: 100%; accent-color: #fb923c; }
  `]
})
export class LayerControlComponent implements OnInit {
  layers: any[] = [];
  folders: Folder[] = [];
  rootLayers: any[] = [];
  folderExpanded: Record<number, boolean> = {};

  searchTerm = '';
  showNewFolderInput = false;
  swipeActive = false;
  currentSwipeLayerId: string | null = null;

  private mapService = inject(MapService);
  private projectContext = inject(ProjectContextService);
  private projectService = inject(ProjectService);
  private toastService = inject(ToastService);

  ngOnInit(): void {
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

  filterItems() {
    const term = this.searchTerm.toLowerCase();
    const allLayers = term ? this.layers.filter(l => l.name.toLowerCase().includes(term)) : this.layers;

    // Capas en la raíz (sin folder_id o folder_id no existente)
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
        // No actualizamos this.folders manualmente para evitar duplicados,
        // ya que projectContext.setActiveProject disparará la actualización desde el backend/state.

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
        // Mover capas localmente
        this.layers.forEach(l => {
          if (l.folder_id === folder.id) l.folder_id = null;
        });
        this.filterItems();
        this.toastService.show('Carpeta eliminada', 'success');
      }
    });
  }

  moveLayer(layer: any, folderId?: number) {
    // Validar que sea una capa persistida (con ID numérico)
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

    // Validar ID numérico
    if (typeof layer.id !== 'number') {
      // Si es capa local/base, solo quitar del mapa
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

  toggleVisibility(id: string) { this.mapService.toggleLayerVisibility(id); }
  setOpacity(id: string, event: any) { this.mapService.setLayerOpacity(id, parseFloat(event.target.value)); }
  zoomToLayer(layer: any) {
    if (layer.instance) {
      this.mapService.zoomToLayer(layer.instance);
    }
  }

  zoomToAll() {
    if (this.layers.length === 0) return;
    this.mapService.zoomToAllLayers();
  }

  enableSwipe(id: string) {
    if (this.swipeActive && this.currentSwipeLayerId === id) {
      this.disableSwipe();
      return;
    }
    this.swipeActive = true;
    this.currentSwipeLayerId = id;
    this.mapService.enableSwipe(id);
  }

  disableSwipe() {
    this.swipeActive = false;
    this.currentSwipeLayerId = null;
    this.mapService.getMap().render();
  }

  onSwipe(event: any) {
    this.mapService.setSwipePosition(parseInt(event.target.value));
  }

  trackLayer(index: number, item: any) { return item.id; }
  trackFolder(index: number, item: Folder) { return item.id; }
}
