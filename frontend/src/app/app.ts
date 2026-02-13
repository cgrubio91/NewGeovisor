import { Component, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './components/header/header.component';
import { ToastComponent } from './components/toast/toast.component';
import { LoginComponent } from './components/login/login';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    HeaderComponent,
    ToastComponent,
    LoginComponent
  ],
  template: `
    <app-toast></app-toast>
    
    <ng-container *ngIf="!authService.currentUser()">
      <app-login></app-login>
    </ng-container>

    <ng-container *ngIf="authService.currentUser()">
      <app-header></app-header>
      <main class="main-content">
        <!-- Router Outlet: Aquí se cargan las vistas según la URL -->
        <router-outlet></router-outlet>
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
  `]
})
export class App {
  title = 'GIS Geovisor Pro';
  authService = inject(AuthService);
}

