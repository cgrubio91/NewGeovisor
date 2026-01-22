import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProjectService } from '../../services/project.service';
import { ToastService } from '../../services/toast.service';
import { ProjectContextService } from '../../services/project-context.service';
import { AuthService } from '../../services/auth.service';
import { Project } from '../../models/models';
import { finalize } from 'rxjs/operators';
import { Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-project-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './project-manager.html',
  styleUrl: './project-manager.css',
})
export class ProjectManager implements OnInit {
  projects: Project[] = [];
  isLoading = false;
  showCreateForm = false;

  newProjectName = '';
  newProjectDesc = '';
  newProjectContract = '';
  newProjectPhoto = '';
  newProjectStart = '';
  newProjectEnd = '';

  @Output() onNavigate = new EventEmitter<string>();

  private projectService = inject(ProjectService);
  private toastService = inject(ToastService);
  private projectContext = inject(ProjectContextService);
  private authService = inject(AuthService);

  ngOnInit() {
    this.loadProjects();
  }

  loadProjects() {
    this.isLoading = true;
    this.projectService.getProjects()
      .pipe(finalize(() => this.isLoading = false))
      .subscribe({
        next: (data) => {
          this.projects = data;
        },
        error: (err) => {
          console.error('Error loading projects', err);
          this.toastService.show('Error al cargar proyectos. Verifique la conexión.', 'error');
        }
      });
  }

  toggleCreateForm() {
    this.showCreateForm = !this.showCreateForm;
  }

  createProject() {
    if (!this.newProjectName.trim()) {
      this.toastService.show('El nombre del proyecto es obligatorio', 'warning');
      return;
    }

    this.isLoading = true;
    this.projectService.createProject({
      name: this.newProjectName,
      description: this.newProjectDesc,
      contract_number: this.newProjectContract,
      photo_url: this.newProjectPhoto,
      start_date: this.newProjectStart ? new Date(this.newProjectStart).toISOString() : undefined,
      end_date: this.newProjectEnd ? new Date(this.newProjectEnd).toISOString() : undefined
    })
      .pipe(finalize(() => this.isLoading = false))
      .subscribe({
        next: (project) => {
          this.projects = [project, ...this.projects];
          this.toastService.show('Proyecto creado exitosamente', 'success');
          this.resetForm();
          this.showCreateForm = false;
        },
        error: (err) => {
          console.error('Error creating project', err);
          this.toastService.show('Error al crear el proyecto. Reintente.', 'error');
        }
      });
  }

  deleteProject(project: Project) {
    if (!confirm(`¿Eliminar el proyecto "${project.name}"? Esta acción borrará todas sus capas.`)) return;

    this.isLoading = true;
    this.projectService.deleteProject(project.id)
      .pipe(finalize(() => this.isLoading = false))
      .subscribe({
        next: () => {
          this.projects = this.projects.filter(p => p.id !== project.id);
          this.toastService.show('Proyecto eliminado', 'success');
          if (this.projectContext.getActiveProjectId() === project.id) {
            this.projectContext.setActiveProject(null);
          }
        }
      });
  }

  resetForm() {
    this.newProjectName = '';
    this.newProjectDesc = '';
    this.newProjectContract = '';
    this.newProjectPhoto = '';
    this.newProjectStart = '';
    this.newProjectEnd = '';
  }

  selectProject(project: Project) {
    this.projectContext.setActiveProject(project);
    this.toastService.show(`Proyecto "${project.name}" seleccionado`, 'info');
    this.onNavigate.emit('map');
  }
}

