import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProjectService } from '../../services/project.service';
import { ToastService } from '../../services/toast.service';
import { ProjectContextService } from '../../services/project-context.service';
import { AuthService } from '../../services/auth.service';
import { Project, User } from '../../models/models';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-project-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './project-manager.html',
  styleUrl: './project-manager.css',
})
export class ProjectManager implements OnInit {
  projects: Project[] = [];
  users: User[] = [];
  isLoading = false;
  showCreateForm = false;
  isEditing = false;
  editingProjectId: number | null = null;

  // Staging for users (Multi-selection simulation)
  stagedUsers: User[] = [];

  newProjectName = '';
  newProjectDesc = '';
  newProjectContract = '';
  newProjectPhoto = '';
  newProjectStart = '';
  newProjectEnd = '';

  selectedUserIdForAssignment: number | null = null;
  userSearchQuery = '';

  private router = inject(Router);

  private projectService = inject(ProjectService);
  private toastService = inject(ToastService);
  private projectContext = inject(ProjectContextService);
  public authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);

  get isAdmin(): boolean {
    const role = this.authService.currentUser()?.role?.toLowerCase();
    return role === 'administrador';
  }

  ngOnInit() {
    this.loadProjects();
    this.loadUsers();
  }

  loadProjects() {
    this.isLoading = true;
    this.cdr.detectChanges();
    this.projectService.getProjects()
      .pipe(finalize(() => {
        this.isLoading = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: (data) => {
          this.projects = data;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error loading projects', err);
          this.toastService.show('Error al cargar proyectos.', 'error');
        }
      });
  }

  loadUsers() {
    this.authService.getUsers().subscribe({
      next: (data) => {
        this.users = data.filter(u => u.is_active);
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Error loading users', err)
    });
  }

  get availableUsers(): User[] {
    return this.users.filter(u =>
      !this.stagedUsers.find(su => su.id === u.id) &&
      (u.full_name || u.username).toLowerCase().includes(this.userSearchQuery.toLowerCase())
    );
  }

  toggleCreateForm() {
    this.showCreateForm = !this.showCreateForm;
    this.isEditing = false;
    this.editingProjectId = null;
    this.stagedUsers = [];
    this.resetForm();
    this.cdr.detectChanges();
  }

  // Local addition to staged list
  addStagedUser(user: User) {
    if (!this.stagedUsers.find(u => u.id === user.id)) {
      this.stagedUsers.push(user);
    }
    this.userSearchQuery = '';
    this.cdr.detectChanges();
  }

  removeStagedUser(userId: number) {
    this.stagedUsers = this.stagedUsers.filter(u => u.id !== userId);
    this.cdr.detectChanges();
  }

  createProject() {
    if (!this.newProjectName.trim()) {
      this.toastService.show('El nombre del proyecto es obligatorio', 'warning');
      return;
    }

    this.isLoading = true;
    this.cdr.detectChanges();

    const projectData: any = {
      name: this.newProjectName,
      description: this.newProjectDesc,
      contract_number: this.newProjectContract,
      photo_url: this.newProjectPhoto,
      start_date: this.newProjectStart ? new Date(this.newProjectStart).toISOString() : undefined,
      end_date: this.newProjectEnd ? new Date(this.newProjectEnd).toISOString() : undefined,
      assigned_user_ids: this.stagedUsers.map(u => u.id)
    };

    if (this.isEditing && this.editingProjectId) {
      this.projectService.updateProject(this.editingProjectId, projectData)
        .pipe(finalize(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        }))
        .subscribe({
          next: (updatedProject) => {
            this.projects = this.projects.map(p => p.id === updatedProject.id ? updatedProject : p);
            this.toastService.show('Proyecto actualizado exitosamente', 'success');
            this.showCreateForm = false;
            this.cdr.detectChanges();
          },
          error: (err) => {
            this.toastService.show('Error al actualizar el proyecto', 'error');
          }
        });
    } else {
      this.projectService.createProject(projectData)
        .pipe(finalize(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        }))
        .subscribe({
          next: (project) => {
            this.projects = [project, ...this.projects];
            this.toastService.show('Proyecto creado exitosamente', 'success');
            this.showCreateForm = false;
            this.cdr.detectChanges();
          },
          error: (err) => {
            this.toastService.show('Error al crear el proyecto', 'error');
          }
        });
    }
  }

  editProject(project: Project) {
    this.isEditing = true;
    this.showCreateForm = true;
    this.editingProjectId = project.id;

    this.newProjectName = project.name;
    this.newProjectDesc = project.description || '';
    this.newProjectContract = project.contract_number || '';
    this.newProjectPhoto = project.photo_url || '';
    this.newProjectStart = project.start_date ? new Date(project.start_date).toISOString().split('T')[0] : '';
    this.newProjectEnd = project.end_date ? new Date(project.end_date).toISOString().split('T')[0] : '';

    // Load existing users into staged list
    this.stagedUsers = [...(project.assigned_users || [])];

    this.cdr.detectChanges();
  }

  deleteProject(project: Project) {
    if (!confirm(`¿Eliminar el proyecto "${project.name}"? Esta acción borrará todas sus capas.`)) return;

    this.isLoading = true;
    this.projectService.deleteProject(project.id)
      .pipe(finalize(() => {
        this.isLoading = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: () => {
          this.projects = this.projects.filter(p => p.id !== project.id);
          this.toastService.show('Proyecto eliminado', 'success');
          if (this.projectContext.getActiveProjectId() === project.id) {
            this.projectContext.setActiveProject(null);
          }
          this.cdr.detectChanges();
        },
        error: (err) => this.toastService.show('Error al eliminar el proyecto', 'error')
      });
  }

  resetForm() {
    this.newProjectName = '';
    this.newProjectDesc = '';
    this.newProjectContract = '';
    this.newProjectPhoto = '';
    this.newProjectStart = '';
    this.newProjectEnd = '';
    this.stagedUsers = [];
    this.cdr.detectChanges();
  }

  selectProject(project: Project) {
    this.projectContext.setActiveProject(project);
    this.toastService.show(`Proyecto "${project.name}" seleccionado`, 'info');
    this.router.navigate(['/map']);
  }
}
