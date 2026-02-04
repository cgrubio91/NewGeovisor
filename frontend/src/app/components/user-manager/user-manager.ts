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
  isEditing = false;
  editingUserId: number | null = null;

  // Search and Filter
  searchQuery = '';
  roleFilter = 'all';

  // Form Fields (used for both create and edit)
  newUsername = '';
  newEmail = '';
  newFullName = '';
  newPassword = '';
  newRole = 'usuario';
  isActive = true;

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

  get filteredUsers(): User[] {
    return this.users.filter(user => {
      const matchesSearch =
        user.username.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        (user.full_name || '').toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(this.searchQuery.toLowerCase());

      const matchesRole = this.roleFilter === 'all' || user.role === this.roleFilter;

      return matchesSearch && matchesRole;
    });
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
    if (!this.newUsername || !this.newEmail || (!this.isEditing && !this.newPassword)) {
      this.toastService.show('Complete los campos obligatorios', 'warning');
      return;
    }

    this.isLoading = true;
    this.cdr.detectChanges();

    if (this.isEditing && this.editingUserId) {
      // Logic for Update
      const updateData: any = {
        full_name: this.newFullName,
        role: this.newRole,
        is_active: this.isActive
      };
      if (this.newPassword) updateData.password = this.newPassword;

      this.authService.updateUser(this.editingUserId, updateData)
        .pipe(finalize(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        }))
        .subscribe({
          next: (updatedUser) => {
            this.users = this.users.map(u => u.id === updatedUser.id ? updatedUser : u);
            this.toastService.show('Usuario actualizado correctamente', 'success');
            this.cancelEdit();
            this.cdr.detectChanges();
          },
          error: (err) => this.toastService.show('Error al actualizar usuario', 'error')
        });
    } else {
      // Logic for Create
      this.authService.createUser({
        username: this.newUsername,
        email: this.newEmail,
        full_name: this.newFullName,
        password: this.newPassword,
        role: this.newRole
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
            this.cdr.detectChanges();
          },
          error: (err) => this.toastService.show('Error al crear usuario', 'error')
        });
    }
  }

  editUser(user: User) {
    this.isEditing = true;
    this.showCreateForm = true;
    this.editingUserId = user.id;

    this.newUsername = user.username;
    this.newEmail = user.email;
    this.newFullName = user.full_name || '';
    this.newRole = user.role || 'usuario';
    this.isActive = user.is_active;
    this.newPassword = ''; // Clear password field for security

    this.cdr.detectChanges();
  }

  cancelEdit() {
    this.isEditing = false;
    this.showCreateForm = false;
    this.editingUserId = null;
    this.resetForm();
    this.cdr.detectChanges();
  }

  toggleUserStatus(user: User) {
    this.isLoading = true;
    this.authService.updateUser(user.id, { is_active: !user.is_active })
      .pipe(finalize(() => {
        this.isLoading = false;
        this.cdr.detectChanges();
      }))
      .subscribe({
        next: (updatedUser) => {
          this.users = this.users.map(u => u.id === updatedUser.id ? updatedUser : u);
          this.toastService.show(
            `Usuario ${updatedUser.is_active ? 'activado' : 'desactivado'} correctamente`,
            'success'
          );
          this.cdr.detectChanges();
        },
        error: (err) => this.toastService.show('Error al cambiar estado del usuario', 'error')
      });
  }

  deleteUser(user: User) {
    if (user.id === this.authService.currentUser()?.id) {
      this.toastService.show('No puedes borrarte a ti mismo', 'warning');
      return;
    }
    if (!confirm(`¿Eliminar al usuario ${user.username}? Esta acción es irreversible.`)) return;

    this.authService.deleteUser(user.id).subscribe({
      next: () => {
        this.users = this.users.filter(u => u.id !== user.id);
        this.toastService.show('Usuario eliminado', 'success');
        if (this.selectedUserId === user.id) this.selectedUserId = null;
        this.cdr.detectChanges();
      },
      error: (err) => this.toastService.show('Error al eliminar usuario', 'error')
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
    this.newRole = 'usuario';
    this.isActive = true;
  }
}
