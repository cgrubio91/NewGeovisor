import { Component, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MapComponent } from './components/map/map.component';
import { LayerControlComponent } from './components/layer-control/layer-control.component';
import { UploadComponent } from './components/upload/upload.component';
import { HeaderComponent } from './components/header/header.component';
import { ProjectManager } from './components/project-manager/project-manager';
import { ToastComponent } from './components/toast/toast.component';
import { Map3dComponent } from './components/map3d/map3d.component';
import { UserManager } from './components/user-manager/user-manager';
import { LoginComponent } from './components/login/login';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    MapComponent,
    LayerControlComponent,
    UploadComponent,
    HeaderComponent,
    ProjectManager,
    ToastComponent,
    Map3dComponent,
    UserManager,
    LoginComponent
  ],
  template: `
    <app-toast></app-toast>
    
    <ng-container *ngIf="!authService.currentUser()">
      <app-login></app-login>
    </ng-container>

    <ng-container *ngIf="authService.currentUser()">
      <app-header (onNavigate)="currentView = $event"></app-header>
      <main class="main-content">
        <ng-container *ngIf="currentView === 'map' || currentView === 'analysis'">
            <div class="map-wrapper" [class.map-3d]="viewMode === '3d'">
              <app-map *ngIf="viewMode === '2d'"></app-map>
              <app-map3d *ngIf="viewMode === '3d'"></app-map3d>
              
              <!-- Engine Toggle -->
              <div class="engine-toggle">
                <button class="toggle-btn" 
                        [class.active]="viewMode === '2d'" 
                        (click)="viewMode = '2d'"
                        title="Vista 2D">2D</button>
                <button class="toggle-btn" 
                        [class.active]="viewMode === '3d'" 
                        (click)="viewMode = '3d'"
                        title="Vista 3D">3D</button>
              </div>
            </div>
            <app-layer-control></app-layer-control>
            <app-upload></app-upload>
        </ng-container>

        <ng-container *ngIf="currentView === 'projects' || currentView === 'dashboard'">
            <app-project-manager (onNavigate)="currentView = $event"></app-project-manager>
        </ng-container>

        <ng-container *ngIf="currentView === 'users'">
            <app-user-manager></app-user-manager>
        </ng-container>
      </main>
    </ng-container>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      height: 100vh;
      width: 100vw;
      overflow: hidden;
      background-color: var(--bg-primary);
    }
    
    .main-content { 
      position: relative; 
      flex: 1;
      width: 100%; 
      overflow: hidden;
    }

    .map-wrapper {
      position: relative;
      width: 100%;
      height: 100%;
    }

    .engine-toggle {
      position: absolute;
      top: 20px;
      right: 20px;
      z-index: 1500;
      background: rgba(10, 25, 41, 0.8);
      backdrop-filter: blur(8px);
      padding: 4px;
      border-radius: var(--border-radius-lg);
      border: 1px solid rgba(0, 193, 210, 0.3);
      display: flex;
      gap: 4px;
    }

    .toggle-btn {
      padding: 6px 12px;
      border: none;
      background: transparent;
      color: var(--text-secondary);
      font-weight: 600;
      font-size: 0.8rem;
      border-radius: var(--border-radius-md);
      cursor: pointer;
      transition: all var(--transition-normal);
    }

    .toggle-btn.active {
      background: var(--color-primary-cyan);
      color: var(--color-primary-navy);
      box-shadow: var(--shadow-glow-cyan);
    }

    .toggle-btn:hover:not(.active) {
      background: rgba(0, 193, 210, 0.1);
      color: var(--text-primary);
    }
  `]
})
export class App {
  title = 'GIS Geovisor Pro';
  currentView = 'map';
  viewMode: '2d' | '3d' = '2d';

  authService = inject(AuthService);

  constructor() {
    effect(() => {
      const user = this.authService.currentUser();
      if (!user) {
        this.currentView = 'map';
      }
    });
  }
}

