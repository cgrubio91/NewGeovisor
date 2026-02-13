import { Routes } from '@angular/router';
import { DashboardComponent } from './components/dashboard/dashboard';
import { ProjectManager } from './components/project-manager/project-manager';
import { UserManager } from './components/user-manager/user-manager';

// Lazy-loaded component para la vista de mapa
const MapViewComponent = () => import('./views/map-view/map-view.component').then(m => m.MapViewComponent);

export const routes: Routes = [
    // Ruta por defecto
    { path: '', redirectTo: '/dashboard', pathMatch: 'full' },

    // Rutas principales
    { path: 'dashboard', component: DashboardComponent },
    { path: 'projects', component: ProjectManager },
    { path: 'map', loadComponent: MapViewComponent },
    { path: 'users', component: UserManager },

    // Ruta 404 - redirige al dashboard
    { path: '**', redirectTo: '/dashboard' }
];
