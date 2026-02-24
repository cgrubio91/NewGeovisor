import { Component, inject, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MeasurementService } from '../../services/measurement.service';
import { ProjectContextService } from '../../services/project-context.service';
import { ProjectService } from '../../services/project.service';
import { Measurement } from '../../models/models';
import { firstValueFrom } from 'rxjs';

/**
 * Componente para realizar y gestionar mediciones en el mapa 2D
 */
@Component({
    selector: 'app-measurement-panel',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './measurement-panel.html',
    styleUrl: './measurement-panel.css'
})
export class MeasurementPanelComponent implements OnInit {
    measurementService = inject(MeasurementService);
    projectContext = inject(ProjectContextService);
    projectService = inject(ProjectService);
    cdr = inject(ChangeDetectorRef);
    ngZone = inject(NgZone);

    measurements: Measurement[] = [];
    activeTool: 'length' | 'area' | 'point' | null = null;
    panelOpen = false;
    lineTemplate: 'solid' | 'dashed' | 'dotted' = 'solid';

    editingMeasurement: Measurement | null = null;
    availableIcons = [
        { id: 'flag', icon: 'flag', label: 'Bandera' },
        { id: 'book', icon: 'menu_book', label: 'Documento' },
        { id: 'build', icon: 'build', label: 'Herramienta' },
        { id: 'engineering', icon: 'engineering', label: 'Ingeniería' }
    ];

    // Grouping
    folders: any[] = [];
    rootMeasurements: Measurement[] = [];
    folderExpanded: Record<number, boolean> = {};

    ngOnInit() {
        this.measurementService.measurements$.subscribe((m: Measurement[]) => {
            console.log('[MeasurementPanel] Recibidas medidas:', m.length);
            this.ngZone.run(() => {
                this.measurements = m;
                this.updateGrouping();
                this.cdr.detectChanges();
            });
        });

        this.projectContext.activeProject$.subscribe((project: any) => {
            if (project) {
                console.log('[MeasurementPanel] Proyecto actualizado (carpetas):', project.folders?.length);
                this.ngZone.run(() => {
                    this.folders = project.folders || [];
                    this.updateGrouping();
                    this.cdr.detectChanges();
                });
            }
        });

        this.measurementService.selectedMeasurement$.subscribe((m: Measurement | null) => {
            if (m) {
                this.panelOpen = true;
                this.editMeasurement(m);
            }
        });
    }

    updateGrouping() {
        this.rootMeasurements = this.measurements.filter(m => !m.folder_id);
    }

    getMeasurementsInFolder(folderId: number) {
        return this.measurements.filter(m => m.folder_id === folderId);
    }

    toggleFolder(id: number) {
        this.folderExpanded[id] = !this.folderExpanded[id];
    }

    async deleteFolder(folder: any) {
        if (!confirm(`¿Eliminar la carpeta "${folder.name}"? las medidas se moverán a la raíz.`)) return;
        try {
            await firstValueFrom(this.projectService.deleteFolder(folder.id));
            const projectId = this.projectContext.getActiveProjectId();
            if (projectId) {
                const updated = await firstValueFrom(this.projectService.getProjectById(projectId));
                this.projectContext.setActiveProject(updated);
            }
        } catch (error) {
            console.error('Error deleting folder:', error);
        }
    }

    async renameFolder(folder: any) {
        const newName = prompt('Nuevo nombre para la carpeta:', folder.name);
        if (!newName || newName === folder.name) return;
        try {
            await firstValueFrom(this.projectService.updateFolder(folder.id, { name: newName }));
            const projectId = this.projectContext.getActiveProjectId();
            if (projectId) {
                const updated = await firstValueFrom(this.projectService.getProjectById(projectId));
                this.projectContext.setActiveProject(updated);
            }
        } catch (error) {
            console.error('Error renaming folder:', error);
        }
    }

    async createNewFolder() {
        const name = prompt('Nombre de la nueva carpeta:');
        if (!name) return;

        const project = await firstValueFrom(this.projectContext.activeProject$);
        if (project && project.id) {
            try {
                await firstValueFrom(this.projectService.createFolder(name, project.id));
                // Refrescar el proyecto para ver la nueva carpeta en toda la app
                const updated = await firstValueFrom(this.projectService.getProjectById(project.id));
                this.projectContext.setActiveProject(updated);
            } catch (error) {
                console.error('Error creating folder:', error);
                alert('Error al crear la carpeta');
            }
        }
    }

    async moveToFolder(m: Measurement, folderId: number | null) {
        if (m.id) {
            await this.measurementService.updateMeasurement(m.id, { folder_id: folderId });
        }
    }

    toggleTool(tool: 'length' | 'area' | 'point') {
        if (this.activeTool === tool) {
            this.activeTool = null;
            this.measurementService.stopDrawing();
        } else {
            this.activeTool = tool;
            this.measurementService.startDrawing(tool);
        }
    }

    editMeasurement(m: Measurement) {
        this.editingMeasurement = {
            ...m,
            style: { ...(m.style || { color: '#e91e63', stroke_width: 2, filled: true, fill_color: 'rgba(233, 30, 99, 0.2)' }) }
        };

        // Detectar template basado en line_dash
        const dash = this.editingMeasurement.style?.line_dash;
        if (!dash) this.lineTemplate = 'solid';
        else if (dash[0] === 10) this.lineTemplate = 'dashed';
        else if (dash[0] === 2) this.lineTemplate = 'dotted';
    }

    updateLineDash() {
        if (this.editingMeasurement && this.editingMeasurement.style) {
            switch (this.lineTemplate) {
                case 'solid': this.editingMeasurement.style.line_dash = undefined; break;
                case 'dashed': this.editingMeasurement.style.line_dash = [10, 10]; break;
                case 'dotted': this.editingMeasurement.style.line_dash = [2, 5]; break;
            }
        }
    }

    saveEdit() {
        if (this.editingMeasurement && this.editingMeasurement.id) {
            this.measurementService.updateMeasurement(this.editingMeasurement.id, {
                name: this.editingMeasurement.name,
                style: this.editingMeasurement.style,
                description: this.editingMeasurement.description,
                link: this.editingMeasurement.link,
                icon: this.editingMeasurement.icon
            });
            this.editingMeasurement = null;
        }
    }

    cancelEdit() {
        this.editingMeasurement = null;
    }

    deleteMeasurement(m: Measurement) {
        if (m.id && confirm(`¿Seguro que desea eliminar la medida "${m.name}"?`)) {
            this.measurementService.deleteMeasurement(m.id);
        }
    }

    toggleVisibility(m: Measurement) {
        this.measurementService.toggleVisibility(m);
    }

    getIcon(iconId: string | undefined): string {
        const iconMap: Record<string, string> = {
            'flag': 'flag',
            'book': 'menu_book',
            'build': 'build',
            'engineering': 'engineering',
            'tree': 'park'
        };
        return iconMap[iconId || 'flag'] || 'flag';
    }

    zoomTo(m: Measurement) {
        this.measurementService.zoomToMeasurement(m);
    }

    openLink(link: string | undefined) {
        if (!link) return;

        let url = link;
        if (!url.startsWith('http')) {
            url = 'https://' + url;
        }
        window.open(url, '_blank');
    }

    updateFillColor() {
        if (this.editingMeasurement && this.editingMeasurement.style) {
            // Si cambia el color base, actualizamos el color de relleno manteniendo opacidad
            const hex = this.editingMeasurement.style.color;
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            this.editingMeasurement.style.fill_color = `rgba(${r}, ${g}, ${b}, 0.2)`;
        }
    }
}
