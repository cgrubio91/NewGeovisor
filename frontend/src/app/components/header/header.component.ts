import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth.service';

/**
 * Componente de encabezado principal
 * Muestra el logo de GMab Geomática y navegación principal.
 * Versión corregida: Remueve iconos innecesarios y añade logout.
 */
@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <header class="header">
      <div class="header-container">
        <!-- Logo -->
        <div class="logo-section">
          <img src="/assets/logo-gmab.png" alt="GMab Geomática" class="logo">
          <div class="brand-text">
            <span class="brand-name">Geovisor Pro</span>
            <span class="brand-subtitle">Análisis Geoespacial Avanzado</span>
          </div>
        </div>

        <!-- Navegación Principal -->
        <nav class="main-nav">
          <a routerLink="/dashboard" routerLinkActive="active" class="nav-item">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
            <span>Dashboard</span>
          </a>
          
          <a routerLink="/projects" routerLinkActive="active" class="nav-item">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
              <line x1="12" y1="22.08" x2="12" y2="12"></line>
            </svg>
            <span>Proyectos</span>
          </a>
          
          <a routerLink="/map" routerLinkActive="active" class="nav-item">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
            <span>Visor de Mapas</span>
          </a>
          
          <a *ngIf="authService.currentUser()?.role === 'administrador'" 
                  routerLink="/users" routerLinkActive="active" class="nav-item">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            <span>Usuarios</span>
          </a>
        </nav>

        <!-- Acciones del Usuario -->
        <div class="user-actions">
          <!-- Solo se muestra si hay un usuario autenticado -->
          <div class="user-profile" *ngIf="authService.currentUser() as user">
            <div class="avatar">
              <span>{{ (user.full_name || user.username).charAt(0).toUpperCase() }}</span>
            </div>
            <div class="user-info">
              <span class="user-name">{{ user.full_name || user.username }}</span>
              <span class="user-role" style="text-transform: capitalize;">{{ user.role || 'Usuario' }}</span>
            </div>
          </div>

          <!-- Botón de Logout -->
          <button class="icon-btn logout-btn" title="Cerrar Sesión" (click)="logout()">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
          </button>
        </div>
      </div>
    </header>
  `,
  styles: [`
    .header {
      background: linear-gradient(135deg, var(--bg-primary) 0%, var(--color-primary-navy) 100%);
      border-bottom: 2px solid var(--color-primary-cyan);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      position: sticky;
      top: 0;
      z-index: 1000;
      backdrop-filter: blur(10px);
    }

    .header-container {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 24px;
      max-width: 100%;
      gap: 32px;
    }

    .logo-section {
      display: flex;
      align-items: center;
      gap: 16px;
      min-width: 250px;
    }

    .logo {
      height: 50px;
      width: auto;
      filter: drop-shadow(0 2px 8px rgba(0, 193, 210, 0.3));
    }

    .brand-text {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .brand-name {
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--text-primary);
    }

    .brand-subtitle {
      font-size: 0.75rem;
      color: var(--color-primary-cyan);
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .main-nav {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1;
      justify-content: center;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 20px;
      background: transparent;
      border: none;
      color: var(--text-secondary);
      cursor: pointer;
      border-radius: 8px;
      transition: all 0.2s;
      font-size: 0.9rem;
      font-weight: 500;
    }

    .nav-item:hover {
      color: var(--text-primary);
      background: rgba(0, 193, 210, 0.1);
    }

    .nav-item.active {
      color: var(--color-primary-cyan);
      background: rgba(0, 193, 210, 0.15);
    }

    .user-actions {
      display: flex;
      align-items: center;
      gap: 16px;
      min-width: 280px;
      justify-content: flex-end;
    }

    .icon-btn {
      width: 40px;
      height: 40px;
      border-radius: 8px;
      background: rgba(0, 193, 210, 0.1);
      border: 1px solid rgba(0, 193, 210, 0.2);
      color: var(--text-secondary);
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .icon-btn:hover {
      background: rgba(0, 193, 210, 0.2);
      border-color: var(--color-primary-cyan);
      color: var(--color-primary-cyan);
      transform: translateY(-2px);
    }

    .logout-btn:hover {
      background: rgba(239, 68, 68, 0.1) !important;
      border-color: rgba(239, 68, 68, 0.5) !important;
      color: #ef4444 !important;
    }

    .user-profile {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 6px 12px;
      background: rgba(0, 193, 210, 0.1);
      border: 1px solid rgba(0, 193, 210, 0.2);
      border-radius: 12px;
    }

    .avatar {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      background: linear-gradient(135deg, var(--color-primary-cyan), #008ba3);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      color: white;
    }

    .user-info {
      display: flex;
      flex-direction: column;
    }

    .user-name {
      font-size: 0.9rem;
      font-weight: 600;
      color: var(--text-primary);
    }

    .user-role {
      font-size: 0.75rem;
      color: #94a3b8;
    }

    @media (max-width: 768px) {
      .brand-text, .user-info { display: none; }
      .nav-item span { display: none; }
      .user-actions, .logo-section { min-width: auto; }
    }
  `]
})
export class HeaderComponent {
  authService = inject(AuthService);
  router = inject(Router);

  logout() {
    this.authService.logout();
    this.router.navigate(['/dashboard']);
  }
}
