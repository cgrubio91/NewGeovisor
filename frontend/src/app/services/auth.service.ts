import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap, of } from 'rxjs';
import { User } from '../models/models';

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private baseUrl = window.location.origin.includes('localhost')
        ? 'http://localhost:8000'
        : window.location.origin + '/api';
    public currentUser = signal<User | null>(null);

    constructor(private http: HttpClient) {
        this.checkInitialAuth();
    }

    private checkInitialAuth() {
        const token = localStorage.getItem('token');
        if (token) {
            this.getCurrentUser().subscribe({
                next: (user) => this.currentUser.set(user),
                error: () => this.logout()
            });
        }
    }

    login(username: string, password: string): Observable<any> {
        const body = new HttpParams()
            .set('username', username)
            .set('password', password);

        return this.http.post<any>(`${this.baseUrl}/token`, body.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        }).pipe(
            tap(res => {
                localStorage.setItem('token', res.access_token);
                this.getCurrentUser().subscribe(user => this.currentUser.set(user));
            })
        );
    }

    logout() {
        localStorage.removeItem('token');
        this.currentUser.set(null);
    }

    getCurrentUser(): Observable<User> {
        return this.http.get<User>(`${this.baseUrl}/users/me`);
    }

    getUsers(): Observable<User[]> {
        return this.http.get<User[]>(`${this.baseUrl}/users/`);
    }

    createUser(user: any): Observable<User> {
        return this.http.post<User>(`${this.baseUrl}/users/`, user);
    }

    deleteUser(userId: number): Observable<any> {
        return this.http.delete(`${this.baseUrl}/users/${userId}`);
    }

    updateUser(userId: number, data: any): Observable<User> {
        return this.http.patch<User>(`${this.baseUrl}/users/${userId}`, data);
    }

    getToken(): string | null {
        return localStorage.getItem('token');
    }

    isAuthenticated(): boolean {
        return !!this.getToken();
    }
}
