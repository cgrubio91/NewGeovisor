import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { MapService } from '../../services/map.service';
import { ToastService } from '../../services/toast.service';
import { ProjectContextService } from '../../services/project-context.service';
import { ProjectService } from '../../services/project.service';
import { AuthService } from '../../services/auth.service';
import { finalize } from 'rxjs/operators';

/**
 * Componente para la carga de archivos geoespaciales
 * Permite seleccionar y cargar múltiples archivos (GeoTIFF, KML)
 * y agregarlos automáticamente al mapa
 */
@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div *ngIf="canUpload" class="upload-panel card" [class.collapsed]="isCollapsed">
      <div class="panel-header" (click)="toggleCollapse()">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="17 8 12 3 7 8"></polyline>
          <line x1="12" y1="3" x2="12" y2="15"></line>
        </svg>
        <h3 *ngIf="!isCollapsed">Carga de Archivos</h3>
        <button class="toggle-btn" (click)="toggleCollapse(); $event.stopPropagation()">
          <i class="fas" [class.fa-chevron-down]="isCollapsed" [class.fa-chevron-up]="!isCollapsed"></i>
        </button>
      </div>
      
      <div class="upload-content" *ngIf="!isCollapsed">
        <!-- Folder Selection -->
        <div class="folder-selector" *ngIf="folders.length > 0">
          <label>Cargar en carpeta:</label>
          <select [(ngModel)]="selectedFolderId">
            <option [value]="0">Raíz (sin carpeta)</option>
            <option *ngFor="let folder of folders" [value]="folder.id">{{folder.name}}</option>
          </select>
        </div>

        <div class="file-input-wrapper">
          <input 
            type="file" 
            id="file-upload" 
            (change)="onFileSelected($event)" 
            multiple
            accept=".tif,.geotiff,.tiff,.kml,.kmz,.ecw,.obj,.gltf,.glb"
            class="file-input">
          <label for="file-upload" class="file-label">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
              <polyline points="13 2 13 9 20 9"></polyline>
            </svg>
            <span class="label-text">Seleccionar Archivos</span>
            <span class="label-hint">TIFF, ECW, KML, KMZ, OBJ/3D</span>
          </label>
        </div>
        
        @if (selectedFiles.length > 0) {
          <div class="selected-files">
            <div class="files-header">
              <span class="files-count">{{selectedFiles.length}} archivo(s) seleccionado(s)</span>
            </div>
            <div class="files-list">
              @for (file of selectedFiles; track file.name) {
                <div class="file-item">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                    <polyline points="13 2 13 9 20 9"></polyline>
                  </svg>
                  <span class="file-name">{{file.name}}</span>
                  <span class="file-size">{{formatFileSize(file.size)}}</span>
                </div>
              }
            </div>
          </div>
        }
        
        <button 
          class="btn btn-primary upload-btn" 
          (click)="upload()" 
          [disabled]="!selectedFiles.length || uploading">
          @if (uploading) {
            <svg class="spinner" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="2" x2="12" y2="6"></line>
              <line x1="12" y1="18" x2="12" y2="22"></line>
              <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
              <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
              <line x1="2" y1="12" x2="6" y2="12"></line>
              <line x1="18" y1="12" x2="22" y2="12"></line>
              <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
              <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
            </svg>
            <span>Cargando...</span>
          } @else {
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            <span>Cargar y Visualizar</span>
          }
        </button>
      </div>
    </div>
  `,
  styles: [`
    .upload-panel {
      position: absolute;
      bottom: 20px;
      left: 20px;
      width: 320px;
      z-index: 1000;
      padding: 0;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      animation: slideInLeft 0.3s ease-out;
      transition: width 0.3s ease, height 0.3s ease;
    }

    .upload-panel.collapsed {
      width: 60px;
      height: auto;
    }

    .upload-panel.collapsed .panel-header {
      padding: 12px;
      justify-content: center;
    }

    .panel-header {
      padding: 16px;
      background: linear-gradient(135deg, var(--bg-tertiary), var(--bg-secondary));
      border-bottom: 1px solid rgba(0, 193, 210, 0.2);
      display: flex;
      align-items: center;
      gap: 12px;
      cursor: pointer;
      transition: background 0.2s;
    }

    .panel-header:hover {
      background: linear-gradient(135deg, var(--bg-secondary), var(--bg-tertiary));
    }

    .panel-header h3 {
      font-size: 1.1rem;
      margin: 0;
      color: var(--color-primary-cyan);
      flex: 1;
    }

    .panel-header svg {
      color: var(--color-primary-cyan);
    }

    .toggle-btn {
      background: none;
      border: none;
      color: var(--color-primary-cyan);
      cursor: pointer;
      padding: 4px;
      transition: transform 0.2s;
    }

    .toggle-btn:hover {
      transform: scale(1.2);
    }

    .upload-content {
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .file-input-wrapper {
      position: relative;
    }

    .file-input {
      position: absolute;
      width: 100%;
      height: 100%;
      opacity: 0;
      cursor: pointer;
    }

    .file-label {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      padding: 30px 20px;
      background: rgba(0, 193, 210, 0.05);
      border: 2px dashed rgba(0, 193, 210, 0.2);
      border-radius: var(--border-radius-lg);
      transition: all var(--transition-normal);
      text-align: center;
    }

    .file-input:hover + .file-label {
      background: rgba(0, 193, 210, 0.1);
      border-color: var(--color-primary-cyan);
    }

    .label-text {
      font-weight: 600;
      color: var(--text-primary);
    }

    .label-hint {
      font-size: 0.75rem;
      color: var(--text-secondary);
    }

    .selected-files {
      background: rgba(0, 0, 0, 0.2);
      border-radius: var(--border-radius-md);
      padding: 12px;
    }

    .files-header {
      margin-bottom: 8px;
      font-size: 0.8rem;
      color: var(--color-primary-cyan);
      font-weight: 500;
    }

    .files-list {
      max-height: 120px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .file-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.85rem;
      color: var(--text-secondary);
    }

    .file-name {
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: var(--text-primary);
    }

    .file-size {
      font-size: 0.75rem;
      opacity: 0.6;
    }

    .folder-selector {
      margin-bottom: 12px;
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    .folder-selector label {
      font-size: 0.8rem;
      color: var(--color-primary-cyan);
      font-weight: 500;
    }
    .folder-selector select {
      background: rgba(0,0,0,0.3);
      border: 1px solid rgba(0, 193, 210, 0.3);
      border-radius: 8px;
      padding: 8px;
      color: white;
      font-size: 0.85rem;
      outline: none;
    }

    @keyframes slideInLeft {
      from { transform: translateX(-100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }

    .spinner {
      animation: rotate 2s linear infinite;
    }

    @keyframes rotate {
      100% { transform: rotate(360deg); }
    }
  `]
})
export class UploadComponent {
  selectedFiles: File[] = [];
  uploading = false;
  isCollapsed = false;

  get canUpload(): boolean {
    const role = this.authService.currentUser()?.role;
    return role === 'administrador' || role === 'director';
  }

  toggleCollapse() {
    this.isCollapsed = !this.isCollapsed;
  }
  folders: any[] = [];
  selectedFolderId: number = 0;

  constructor(
    private apiService: ApiService,
    private mapService: MapService,
    private projectContext: ProjectContextService,
    private projectService: ProjectService,
    private toastService: ToastService,
    private authService: AuthService
  ) {
    this.projectContext.activeProject$.subscribe(project => {
      this.folders = project?.folders || [];
    });
  }


  /**
   * Maneja la selección de archivos
   * @param event Evento de cambio del input file
   */
  onFileSelected(event: any) {
    const files: FileList = event.target.files;
    if (files.length > 0) {
      // Agregar nuevos archivos a la lista existente
      Array.from(files).forEach(file => {
        const alreadyExists = this.selectedFiles.some(f => f.name === file.name && f.size === file.size);
        if (!alreadyExists) {
          this.selectedFiles.push(file);
        }
      });
    }
  }

  /**
   * Formatea el tamaño del archivo a una cadena legible
   * @param bytes Tamaño en bytes
   * @returns Cadena formateada (B, KB, MB, GB)
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * Carga los archivos seleccionados al servidor
   * y agrega las capas resultantes al mapa
   */
  upload() {
    if (this.selectedFiles.length === 0) return;

    const projectId = this.projectContext.getActiveProjectId();
    if (!projectId) {
      this.toastService.show('Por favor seleccione un proyecto primero', 'warning');
      return;
    }

    this.uploading = true;
    const folderId = this.selectedFolderId > 0 ? this.selectedFolderId : undefined;

    this.apiService.uploadFiles(this.selectedFiles, projectId, folderId)
      .pipe(finalize(() => this.uploading = false))
      .subscribe({
        next: (res: any) => {
          this.toastService.show(`${res.uploaded?.length} archivo(s) cargado(s) exitosamente`, 'success');

          // Recargar el proyecto activo para obtener todas las capas (nuevas y persistentes)
          this.projectService.getProjectById(projectId).subscribe(project => {
            this.projectContext.setActiveProject(project);
          });

          this.selectedFiles = [];
          this.selectedFolderId = 0;
        },
        error: (err) => {
          console.error('Error uploading files', err);
          this.toastService.show('Error al cargar archivos. Verifique el tamaño y formato.', 'error');
        }
      });
  }
}
