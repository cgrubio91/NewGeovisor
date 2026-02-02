import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { ProjectService } from '../../services/project.service';
import { ToastService } from '../../services/toast.service';
import { User, Project } from '../../models/models';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-user-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-manager.html',
  styleUrl: './user-manager.css'
})
export class UserManager implements OnInit {
  users: User[] = [];
  projects: Project[] = [];
  isLoading = false;
  showCreateForm = false;

  // New User Form
  newUsername = '';
  newEmail = '';
  newFullName = '';
  newPassword = '';

  // Assignment info
  selectedUserId: number | null = null;
  selectedProjectId: number | null = null;

  private authService = inject(AuthService);
  private projectService = inject(ProjectService);
  private toastService = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);

  ngOnInit() {
    this.loadUsers();
    this.loadAllProjects();
  }

  loadUsers() {
    this.isLoading = true;
    this.cdr.detectChanges();
    this.authService.getUsers()
      .pipe(finalize(() => {
        this.isLoading = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: (data) => {
          this.users = [...data];
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.toastService.show('Error al cargar usuarios', 'error');
        }
      });
  }

  loadAllProjects() {
    this.projectService.getProjects().subscribe({
      next: (data) => {
        this.projects = data;
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Error cargando proyectos', err)
    });
  }

  createUser() {
    if (!this.newUsername || !this.newEmail || !this.newPassword) {
      this.toastService.show('Complete los campos obligatorios', 'warning');
      return;
    }

    this.isLoading = true;
    this.cdr.detectChanges();
    this.authService.createUser({
      username: this.newUsername,
      email: this.newEmail,
      full_name: this.newFullName,
      password: this.newPassword
    }).pipe(finalize(() => {
      this.isLoading = false;
      this.cdr.detectChanges();
    }))
      .subscribe({
        next: (user) => {
          this.users = [user, ...this.users];
          this.toastService.show('Usuario creado exitosamente', 'success');
          this.resetForm();
          this.showCreateForm = false;
          this.loadUsers();
        },
        error: (err) => this.toastService.show('Error al crear usuario', 'error')
      });
  }

  deleteUser(user: User) {
    if (user.id === this.authService.currentUser()?.id) {
      this.toastService.show('No puedes borrarte a ti mismo', 'warning');
      return;
    }
    if (!confirm(`¿Eliminar al usuario ${user.username}?`)) return;

    this.authService.deleteUser(user.id).subscribe({
      next: () => {
        this.users = this.users.filter(u => u.id !== user.id);
        this.toastService.show('Usuario eliminado', 'success');
        if (this.selectedUserId === user.id) this.selectedUserId = null;
        this.cdr.detectChanges();
      }
    });
  }

  assignProject() {
    if (!this.selectedUserId || !this.selectedProjectId) {
      this.toastService.show('Seleccione usuario y proyecto', 'warning');
      return;
    }

    this.isLoading = true;
    this.cdr.detectChanges();
    this.projectService.assignUserToProject(this.selectedUserId, this.selectedProjectId)
      .pipe(finalize(() => {
        this.isLoading = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: () => {
          this.toastService.show('Proyecto asignado correctamente', 'success');
          this.selectedProjectId = null;
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.toastService.show('Error en la asignación', 'error');
        }
      });
  }

  resetForm() {
    this.newUsername = '';
    this.newEmail = '';
    this.newFullName = '';
    this.newPassword = '';
  }
}
