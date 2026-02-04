import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="login-container">
      <div class="login-card">
        <div class="login-header">
          <img src="assets/logo.png" alt="Logo" class="logo" (error)="onLogoError($event)">
          <h1>GIS Geovisor Pro</h1>
          <p>Potente visualización geoespacial 2D y 3D</p>
        </div>

        <form (ngSubmit)="onSubmit()" #loginForm="ngForm">
          <div class="form-group">
            <label for="username">Correo Electrónico</label>
            <div class="input-wrapper">
              <i class="fas fa-envelope"></i>
              <input type="text" id="username" name="username" [(ngModel)]="username" required placeholder="tu@correo.com">
            </div>
          </div>

          <div class="form-group">
            <label for="password">Contraseña / Código de Acceso</label>
            <div class="input-wrapper">
              <i class="fas fa-lock"></i>
              <input type="password" id="password" name="password" [(ngModel)]="password" required placeholder="••••••••">
            </div>
          </div>

          <button type="submit" [disabled]="loading() || !loginForm.form.valid" class="login-btn">
            <span *ngIf="!loading()">Acceder al Sistema</span>
            <span *ngIf="loading()" class="loader"></span>
          </button>
        </form>

        <div class="login-footer">
          <p>© 2026 GIS Geovisor Pro. Todos los derechos reservados.</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .login-container {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      width: 100vw;
      background: radial-gradient(circle at top right, #0a1929, #050b14);
      font-family: 'Inter', sans-serif;
    }

    .login-card {
      background: rgba(13, 31, 51, 0.7);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(0, 193, 210, 0.2);
      border-radius: 24px;
      padding: 40px;
      width: 100%;
      max-width: 450px;
      box-shadow: 0 20px 50px rgba(0,0,0,0.5), 0 0 20px rgba(0, 193, 210, 0.1);
      animation: fadeIn 0.6s ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .login-header {
      text-align: center;
      margin-bottom: 35px;
    }

    .logo {
      width: 80px;
      height: 80px;
      margin-bottom: 15px;
      filter: drop-shadow(0 0 10px rgba(0, 193, 210, 0.5));
    }

    h1 {
      color: #fff;
      font-size: 2rem;
      font-weight: 700;
      margin: 0;
      letter-spacing: -0.5px;
      background: linear-gradient(90deg, #00c1d2, #7702FF);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    p {
      color: #94a3b8;
      font-size: 0.9rem;
      margin-top: 8px;
    }

    .form-group {
      margin-bottom: 22px;
    }

    label {
      display: block;
      color: #cbd5e1;
      font-size: 0.85rem;
      font-weight: 600;
      margin-bottom: 8px;
      margin-left: 4px;
    }

    .input-wrapper {
      position: relative;
    }

    input {
      width: 100%;
      background: rgba(10, 25, 41, 0.5);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px;
      padding: 14px 16px;
      color: #fff;
      font-size: 1rem;
      transition: all 0.3s;
      box-sizing: border-box;
    }

    input:focus {
      outline: none;
      border-color: #00c1d2;
      background: rgba(10, 25, 41, 0.8);
      box-shadow: 0 0 0 4px rgba(0, 193, 210, 0.1);
    }

    .login-btn {
      width: 100%;
      background: linear-gradient(90deg, #00c1d2, #0089ff);
      color: #fff;
      border: none;
      border-radius: 12px;
      padding: 16px;
      font-size: 1rem;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.3s;
      margin-top: 10px;
      box-shadow: 0 10px 20px rgba(0, 193, 210, 0.2);
    }

    .login-btn:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 15px 30px rgba(0, 193, 210, 0.3);
    }

    .login-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .login-footer {
      margin-top: 30px;
      text-align: center;
      border-top: 1px solid rgba(255,255,255,0.05);
      padding-top: 20px;
    }

    .login-footer p {
      font-size: 0.75rem;
      color: #64748b;
    }

    .loader {
      width: 20px;
      height: 20px;
      border: 3px solid rgba(255,255,255,0.3);
      border-top: 3px solid #fff;
      border-radius: 50%;
      display: inline-block;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `]
})
export class LoginComponent {
  username = '';
  password = '';
  loading = signal(false);

  constructor(
    private authService: AuthService,
    private toastService: ToastService
  ) { }

  onSubmit() {
    this.loading.set(true);
    this.authService.login(this.username, this.password).subscribe({
      next: () => {
        this.loading.set(false);
        this.toastService.show('Bienvenido al sistema', 'success');
      },
      error: (err) => {
        this.loading.set(false);
        this.toastService.show('Error de autenticación: ' + (err.error?.detail || 'Credenciales inválidas'), 'error');
      }
    });
  }

  onLogoError(event: any) {
    event.target.src = 'https://cdn-icons-png.flaticon.com/512/854/854878.png';
  }
}
