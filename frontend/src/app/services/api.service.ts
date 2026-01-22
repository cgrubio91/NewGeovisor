import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

/**
 * Servicio para comunicación con el backend
 * Maneja la carga de archivos y obtención de URLs de tiles
 */
@Injectable({
    providedIn: 'root'
})
export class ApiService {
    /**
     * En producción, la URL suele ser relativa si el frontend y backend 
     * se sirven desde el mismo dominio/proxy, o una URL absoluta de API.
     * Para Docker/Nginx, usaremos una ruta que el proxy pueda redirigir.
     */
    public baseUrl = window.location.origin.includes('localhost') 
        ? 'http://localhost:8000' 
        : window.location.origin + '/api';

    getApiUrl(): string {
        return this.baseUrl;
    }

    constructor(private http: HttpClient) { }

    /**
     * Carga archivos al servidor asociados a un proyecto
     */
    uploadFiles(files: File[], projectId: number, folderId?: number): Observable<any> {
        const formData = new FormData();
        files.forEach(file => {
            formData.append('files', file, file.name);
        });
        formData.append('project_id', projectId.toString());
        if (folderId) {
            formData.append('folder_id', folderId.toString());
        }
        return this.http.post(`${this.baseUrl}/upload`, formData);
    }

    /**
     * Obtiene la URL para solicitar tiles de un archivo raster
     */
    getTilesUrl(filename: string): string {
        return `${this.baseUrl}/tiles/${filename}/{z}/{x}/{y}.png`;
    }

    /**
     * Obtiene la URL directa de un archivo cargado
     */
    getFileUrl(filename: string): string {
        return `${this.baseUrl}/uploads/${filename}`;
    }
}
