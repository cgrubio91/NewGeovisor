import { Component, OnInit, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Map3dService } from '../../services/map3d.service';
import { ProjectContextService } from '../../services/project-context.service';
import { ProjectService } from '../../services/project.service';
import { ToastService } from '../../services/toast.service';
import { Layer } from '../../models/models';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-transform-control',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="transform-control card" *ngIf="layer && isVisible" [class.collapsed]="isCollapsed">
      <!-- Collapsed Icon View -->
      <div class="collapsed-trigger" *ngIf="isCollapsed" (click)="toggleCollapse()" title="Abrir Herramientas de Transformación">
        <i class="fas fa-cube"></i>
      </div>

      <!-- Full Panel View -->
      <ng-container *ngIf="!isCollapsed">
        <div class="panel-header" (click)="toggleCollapse()">
          <i class="fas fa-cube rot-icon"></i>
          <h3>Transformar</h3>
          <div class="header-actions">
            <button class="action-btn" (click)="closeControl(); $event.stopPropagation()" title="Cerrar y Deseleccionar">
                <i class="fas fa-times"></i>
            </button>
          </div>
        </div>

        <div class="content-wrapper">
            <div class="layer-info">
              <span class="l-name">{{ layer.name }}</span>
            </div>

            <div class="rotation-section">
                <div class="rotation-row">
                  <span class="rot-label">Rotación Z (Heading)</span>
                  <div class="rot-buttons">
                    <button class="rot-btn" (click)="rotate('heading', -5)">
                      <i class="fas fa-undo"></i> -5°
                    </button>
                    <button class="rot-btn" (click)="rotate('heading', 5)">
                      <i class="fas fa-redo"></i> +5°
                    </button>
                  </div>
                </div>

                <div class="rotation-row">
                  <span class="rot-label">Inclinación X (Pitch)</span>
                  <div class="rot-buttons">
                    <button class="rot-btn accent-x" (click)="rotate('pitch', -5)">
                      <i class="fas fa-undo"></i>
                    </button>
                    <button class="rot-btn accent-x" (click)="rotate('pitch', 5)">
                      <i class="fas fa-redo"></i>
                    </button>
                  </div>
                </div>

                <div class="rotation-row">
                  <span class="rot-label">Balanceo Y (Roll)</span>
                  <div class="rot-buttons">
                    <button class="rot-btn accent-y" (click)="rotate('roll', -5)">
                      <i class="fas fa-undo"></i>
                    </button>
                    <button class="rot-btn accent-y" (click)="rotate('roll', 5)">
                      <i class="fas fa-redo"></i>
                    </button>
                  </div>
                </div>
                
                <div class="save-actions">
                  <button class="save-btn" [disabled]="isSaving" (click)="saveRotation()">
                      <i class="fas" [class.fa-save]="!isSaving" [class.fa-spinner]="isSaving" [class.fa-spin]="isSaving"></i> 
                      {{ isSaving ? 'Guardando...' : 'Guardar Posición' }}
                  </button>
                  <button class="reset-btn" (click)="resetRotation()" title="Restablecer">
                      <i class="fas fa-sync-alt"></i>
                  </button>
                </div>
            </div>
        </div>
      </ng-container>
    </div>
  `,
  styles: [`
    .transform-control {
      position: absolute;
      top: 150px;
      right: 20px;
      width: 240px;
      z-index: 1500;
      background: rgba(10, 25, 41, 0.9);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(0, 193, 210, 0.4);
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .transform-control.collapsed {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        padding: 0;
    }
    .transform-control.collapsed:hover {
        background: rgba(0, 193, 210, 0.2);
        border-color: #00c1d2;
        transform: scale(1.05);
    }

    .collapsed-trigger {
        font-size: 1.2rem;
        color: var(--color-primary-cyan);
    }

    .panel-header {
      padding: 10px 14px;
      background: rgba(0, 193, 210, 0.1);
      display: flex;
      align-items: center;
      gap: 10px;
      cursor: pointer;
      border-bottom: 1px solid rgba(0, 193, 210, 0.2);
    }

    .header-actions { margin-left: auto; }
    .rot-icon { color: var(--color-primary-cyan); font-size: 1rem; }
    h3 { font-size: 0.85rem; margin: 0; flex: 1; color: white; }
    
    .content-wrapper { padding: 12px; display: flex; flex-direction: column; gap: 12px; }
    
    .layer-info {
        padding: 4px 8px;
        background: rgba(255,255,255,0.05);
        border-radius: 4px;
        margin-bottom: 4px;
    }
    .l-name { font-size: 0.75rem; color: #cbd5e1; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; }

    .rotation-row { display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; }
    .rot-label { font-size: 0.7rem; color: #94a3b8; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; }
    .rot-buttons { display: flex; gap: 8px; }
    
    .rot-btn {
      flex: 1;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      color: white;
      padding: 6px;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s;
      font-size: 0.75rem;
    }
    .rot-btn:hover { background: rgba(0, 193, 210, 0.2); border-color: #00c1d2; }
    
    .accent-x { border-color: rgba(239, 68, 68, 0.3); }
    .accent-y { border-color: rgba(34, 197, 94, 0.3); }

    .save-actions { display: flex; gap: 8px; margin-top: 8px; }
    .save-btn {
        flex: 1;
        padding: 10px;
        background: var(--color-primary-cyan);
        color: var(--color-primary-navy);
        border: none;
        border-radius: 6px;
        font-weight: 700;
        font-size: 0.8rem;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        transition: all 0.2s;
    }
    .save-btn:hover:not(:disabled) {
        background: #00e0f3;
        box-shadow: 0 0 15px rgba(0, 193, 210, 0.4);
        transform: translateY(-1px);
    }
    .save-btn:disabled { opacity: 0.6; cursor: not-allowed; }

    .reset-btn {
        padding: 10px;
        aspect-ratio: 1/1;
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.1);
        color: #94a3b8;
        border-radius: 6px;
        cursor: pointer;
    }
    .reset-btn:hover { color: white; background: rgba(255,255,255,0.1); }

    .action-btn { background: none; border: none; color: #94a3b8; cursor: pointer; padding: 4px; }
    .action-btn:hover { color: white; }
  `]
})
export class TransformControlComponent implements OnInit, OnDestroy {
  layer: Layer | null = null;
  isVisible = false;
  isCollapsed = false;
  isSaving = false;
  private subs = new Subscription();

  private map3dService = inject(Map3dService);
  private projectContext = inject(ProjectContextService);
  private projectService = inject(ProjectService);
  private toastService = inject(ToastService);

  ngOnInit() {
    this.subs.add(
      this.projectContext.selectedLayerId$.subscribe(id => {
        const project = this.projectContext.getActiveProject();
        if (project && id) {
          const found = project.layers.find(l => l.id == id);
          if (found && (found.layer_type === 'point_cloud' || found.layer_type === '3d_model')) {
            this.layer = found;

            // IMPORTANTE: Asegurar que los valores de rotación actuales se carguen 
            // desde settings antes de empezar a mover para que no salte al inicio.
            if (!this.layer.rotation && this.layer.settings?.rotation) {
              this.layer.rotation = { ...this.layer.settings.rotation };
            } else if (!this.layer.rotation) {
              this.layer.rotation = { heading: 0, pitch: 0, roll: 0 };
            }

            this.isVisible = true;
            return;
          }
        }
        this.isVisible = false;
      })
    );
  }

  toggleCollapse() {
    this.isCollapsed = !this.isCollapsed;
  }

  closeControl() {
    this.projectContext.setSelectedLayerId(null);
  }

  rotate(axis: 'heading' | 'pitch' | 'roll', delta: number) {
    if (!this.layer) return;
    if (!this.layer.rotation) {
      this.layer.rotation = { heading: 0, pitch: 0, roll: 0 };
    }
    this.layer.rotation[axis] = (this.layer.rotation[axis] + delta) % 360;
    this.map3dService.rotateLayer(this.layer.id!, this.layer.rotation);
  }

  resetRotation() {
    if (!this.layer) return;
    this.layer.rotation = { heading: 0, pitch: 0, roll: 0 };
    this.map3dService.rotateLayer(this.layer.id!, this.layer.rotation);
  }

  saveRotation() {
    if (!this.layer || !this.layer.id) return;
    this.isSaving = true;

    // Guardar en settings para persistencia en DB
    const settings = {
      ...(this.layer.settings || {}),
      rotation: this.layer.rotation
    };

    this.projectService.updateLayer(this.layer.id, { settings }).subscribe({
      next: () => {
        this.isSaving = false;
        this.toastService.show('Orientación guardada permanentemente', 'success');

        // Actualizar el objeto local para que no parezca que hay cambios pendientes
        if (this.layer) this.layer.settings = settings;
      },
      error: (err) => {
        this.isSaving = false;
        this.toastService.show('Error al guardar orientación', 'error');
        console.error(err);
      }
    });
  }

  ngOnDestroy() {
    this.subs.unsubscribe();
  }
}
