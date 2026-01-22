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
    public baseUrl = 'http://localhost:8000';

    getApiUrl(): string {
        return this.baseUrl;
    }

    constructor(private http: HttpClient) { }

    /**
     * Carga archivos al servidor asociados a un proyecto
     * @param files Array de archivos a cargar
     * @param projectId ID del proyecto
     * @param folderId ID opcional de la carpeta
     * @returns Observable con la respuesta del servidor
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
     * @param filename Nombre del archivo raster
     * @returns URL template para tiles (con placeholders {z}/{x}/{y})
     */
    getTilesUrl(filename: string): string {
        return `${this.baseUrl}/tiles/${filename}/{z}/{x}/{y}.png`;
    }

    /**
     * Obtiene la URL directa de un archivo cargado
     * @param filename Nombre del archivo
     * @returns URL del archivo
     */
    getFileUrl(filename: string): string {
        return `${this.baseUrl}/uploads/${filename}`;
    }
}
