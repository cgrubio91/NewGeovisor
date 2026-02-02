import { Component, EventEmitter, Output } from '@angular/core';

import { CommonModule } from '@angular/common';

/**
 * Componente de encabezado principal
 * Muestra el logo de GMab Geomática y navegación principal
 */
@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
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
          <button class="nav-item" [class.active]="activeTab === 'dashboard'" (click)="navigate('dashboard')">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
            <span>Dashboard</span>
          </button>
          
          <button class="nav-item" [class.active]="activeTab === 'projects'" (click)="navigate('projects')">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
              <line x1="12" y1="22.08" x2="12" y2="12"></line>
            </svg>
            <span>Proyectos</span>
          </button>
          
          <button class="nav-item" [class.active]="activeTab === 'map'" (click)="navigate('map')">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
            <span>Visor de Mapas</span>
          </button>
          
          <button class="nav-item" [class.active]="activeTab === 'users'" (click)="navigate('users')">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            <span>Usuarios</span>
          </button>
        </nav>

        <!-- Acciones del Usuario -->
        <div class="user-actions">
          <button class="icon-btn" title="Notificaciones">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
            <span class="notification-badge">3</span>
          </button>
          
          <button class="icon-btn" title="Configuración">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M12 1v6m0 6v6m5.66-13.66l-4.24 4.24m0 6.84l4.24 4.24M23 12h-6m-6 0H1m18.66 5.66l-4.24-4.24m0-6.84l4.24-4.24"></path>
            </svg>
          </button>
          
          <div class="user-profile">
            <div class="avatar">
              <span>U</span>
            </div>
            <div class="user-info">
              <span class="user-name">Usuario</span>
              <span class="user-role">Administrador</span>
            </div>
          </div>
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
      z-index: var(--z-sticky);
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

    /* Logo Section */
    .logo-section {
      display: flex;
      align-items: center;
      gap: 16px;
      min-width: 280px;
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
      font-family: var(--font-primary);
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--text-primary);
      letter-spacing: 0.5px;
    }

    .brand-subtitle {
      font-family: var(--font-secondary);
      font-size: 0.75rem;
      color: var(--color-primary-cyan);
      font-weight: 400;
      letter-spacing: 1px;
      text-transform: uppercase;
    }

    /* Navigation */
    .main-nav {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1;
      justify-content: center;
    }

    .nav-item {
      font-family: var(--font-primary);
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 20px;
      background: transparent;
      border: none;
      color: var(--text-secondary);
      cursor: pointer;
      border-radius: var(--border-radius-md);
      transition: all var(--transition-normal);
      font-size: 0.9rem;
      font-weight: 500;
      position: relative;
    }

    .nav-item::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 0;
      height: 2px;
      background: var(--color-primary-cyan);
      transition: width var(--transition-normal);
    }

    .nav-item:hover {
      color: var(--text-primary);
      background: rgba(0, 193, 210, 0.1);
    }

    .nav-item:hover::after {
      width: 80%;
    }

    .nav-item.active {
      color: var(--color-primary-cyan);
      background: rgba(0, 193, 210, 0.15);
    }

    .nav-item.active::after {
      width: 80%;
    }

    .nav-item svg {
      flex-shrink: 0;
    }

    /* User Actions */
    .user-actions {
      display: flex;
      align-items: center;
      gap: 16px;
      min-width: 280px;
      justify-content: flex-end;
    }

    .icon-btn {
      position: relative;
      width: 40px;
      height: 40px;
      border-radius: var(--border-radius-md);
      background: rgba(0, 193, 210, 0.1);
      border: 1px solid rgba(0, 193, 210, 0.2);
      color: var(--text-secondary);
      cursor: pointer;
      transition: all var(--transition-normal);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .icon-btn:hover {
      background: rgba(0, 193, 210, 0.2);
      border-color: var(--color-primary-cyan);
      color: var(--color-primary-cyan);
      transform: translateY(-2px);
      box-shadow: var(--shadow-glow-cyan);
    }

    .notification-badge {
      position: absolute;
      top: -4px;
      right: -4px;
      background: var(--color-primary-orange);
      color: white;
      font-size: 0.7rem;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: var(--border-radius-full);
      min-width: 18px;
      text-align: center;
      box-shadow: 0 2px 8px rgba(255, 103, 28, 0.4);
    }

    .user-profile {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 6px 12px 6px 6px;
      background: rgba(0, 193, 210, 0.1);
      border: 1px solid rgba(0, 193, 210, 0.2);
      border-radius: var(--border-radius-lg);
      cursor: pointer;
      transition: all var(--transition-normal);
    }

    .user-profile:hover {
      background: rgba(0, 193, 210, 0.15);
      border-color: var(--color-primary-cyan);
      box-shadow: var(--shadow-glow-cyan);
    }

    .avatar {
      width: 36px;
      height: 36px;
      border-radius: var(--border-radius-md);
      background: linear-gradient(135deg, var(--color-primary-cyan), var(--color-cyan-dark));
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: var(--font-primary);
      font-weight: 700;
      font-size: 1rem;
      color: white;
      box-shadow: var(--shadow-md);
    }

    .user-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .user-name {
      font-family: var(--font-primary);
      font-size: 0.9rem;
      font-weight: 600;
      color: var(--text-primary);
    }

    .user-role {
      font-size: 0.75rem;
      color: var(--text-muted);
    }

    /* Responsive */
    @media (max-width: 1200px) {
      .brand-subtitle {
        display: none;
      }
      
      .nav-item span {
        display: none;
      }
      
      .nav-item {
        padding: 10px;
      }
    }

    @media (max-width: 768px) {
      .header-container {
        padding: 8px 16px;
        gap: 16px;
      }
      
      .logo-section {
        min-width: auto;
      }
      
      .logo {
        height: 40px;
      }
      
      .brand-text {
        display: none;
      }
      
      .main-nav {
        gap: 4px;
      }
      
      .user-info {
        display: none;
      }
      
      .user-actions {
        min-width: auto;
        gap: 8px;
      }
    }
  `]
})
export class HeaderComponent {
  @Output() onNavigate = new EventEmitter<string>();
  activeTab = 'map'; // Default view

  navigate(tab: string) {
    this.activeTab = tab;
    this.onNavigate.emit(tab);
  }
}
