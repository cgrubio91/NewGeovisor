import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface DashboardStats {
    users: number;
    projects: number;
    layers: number;
    db_size: string;
    top_projects: Array<{ name: string, visits: number }>;
    top_users: Array<{ name: string, logins: number }>;
}

@Injectable({
    providedIn: 'root'
})
export class DashboardService {
    private http = inject(HttpClient);
    private baseUrl = 'http://localhost:8000';

    getStats(): Observable<DashboardStats> {
        return this.http.get<DashboardStats>(`${this.baseUrl}/dashboard/stats`);
    }
}
