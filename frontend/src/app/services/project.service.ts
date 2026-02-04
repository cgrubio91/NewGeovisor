import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Project, Folder, Layer } from '../models/models';

@Injectable({
    providedIn: 'root'
})
export class ProjectService {
    private baseUrl = 'http://localhost:8000';

    constructor(private http: HttpClient) { }

    // --- Projects ---
    createProject(project: Partial<Project>): Observable<Project> {
        return this.http.post<Project>(`${this.baseUrl}/projects/`, project);
    }

    getProjects(): Observable<Project[]> {
        return this.http.get<Project[]>(`${this.baseUrl}/projects/`);
    }

    getProjectById(projectId: number): Observable<Project> {
        return this.http.get<Project>(`${this.baseUrl}/projects/by-id/${projectId}`);
    }

    deleteProject(projectId: number): Observable<any> {
        return this.http.delete(`${this.baseUrl}/projects/${projectId}`);
    }

    updateProject(projectId: number, project: Partial<Project>): Observable<Project> {
        return this.http.patch<Project>(`${this.baseUrl}/projects/${projectId}`, project);
    }

    assignUserToProject(userId: number, projectId: number): Observable<Project> {
        return this.http.post<Project>(`${this.baseUrl}/projects/assign`, { user_id: userId, project_id: projectId });
    }

    unassignUserFromProject(userId: number, projectId: number): Observable<any> {
        return this.http.post(`${this.baseUrl}/projects/unassign`, { user_id: userId, project_id: projectId });
    }

    // --- Folders ---
    createFolder(name: string, projectId: number, parentId?: number): Observable<Folder> {
        return this.http.post<Folder>(`${this.baseUrl}/folders/`, { name, project_id: projectId, parent_id: parentId });
    }

    getFolders(projectId: number): Observable<Folder[]> {
        return this.http.get<Folder[]>(`${this.baseUrl}/projects/${projectId}/folders`);
    }

    deleteFolder(folderId: number): Observable<any> {
        return this.http.delete(`${this.baseUrl}/folders/${folderId}`);
    }

    // --- Layers ---
    updateLayer(layerId: number, data: Partial<Layer>): Observable<Layer> {
        return this.http.patch<Layer>(`${this.baseUrl}/layers/${layerId}`, data);
    }

    deleteLayer(layerId: number): Observable<any> {
        return this.http.delete(`${this.baseUrl}/layers/${layerId}`);
    }
}
