import { Injectable, inject, NgZone } from '@angular/core';
import { MapService } from './map.service';
import { ApiService } from './api.service';
import { ProjectContextService } from './project-context.service';
import { Measurement } from '../models/models';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, firstValueFrom, combineLatest } from 'rxjs';
import { take } from 'rxjs/operators';

import Draw from 'ol/interaction/Draw';
import VectorSource from 'ol/source/Vector';
import VectorLayer from 'ol/layer/Vector';
import { getArea, getLength } from 'ol/sphere';
import { LineString, Polygon } from 'ol/geom';
import { Style, Fill, Stroke, Circle as CircleStyle, Text } from 'ol/style';
import GeoJSON from 'ol/format/GeoJSON';
import Feature from 'ol/Feature';
import Overlay from 'ol/Overlay';

@Injectable({
    providedIn: 'root'
})
export class MeasurementService {
    private api = inject(ApiService);
    private http = inject(HttpClient);
    private mapService = inject(MapService);
    private projectContext = inject(ProjectContextService);
    private ngZone = inject(NgZone);

    private measurementsSubject = new BehaviorSubject<Measurement[]>([]);
    public measurements$ = this.measurementsSubject.asObservable();
    private activeProject_id: number | null = null;

    // --- NUEVO: Interacción y Selección ---
    private selectedMeasurementSubject = new BehaviorSubject<Measurement | null>(null);
    selectedMeasurement$ = this.selectedMeasurementSubject.asObservable();

    private tooltipOverlay: Overlay;
    private tooltipElement: HTMLElement;

    private drawSource = new VectorSource();
    private drawLayer: VectorLayer<any>;
    private drawInteraction: Draw | null = null;

    // Capa única persistente para las medidas guardadas
    private persistentSource = new VectorSource();
    private persistentLayer: VectorLayer<any>;

    constructor() {
        // Inicializar capas
        this.persistentLayer = new VectorLayer({
            source: this.persistentSource,
            zIndex: 9999, // Super alta prioridad
            properties: { id: 'measurements-persistent', name: 'Mediciones', type: 'overlay' }
        });

        this.drawLayer = new VectorLayer({
            source: this.drawSource,
            style: new Style({
                fill: new Fill({ color: 'rgba(255, 0, 0, 0.2)' }),
                stroke: new Stroke({ color: '#ff0000', width: 4 }),
                image: new CircleStyle({
                    radius: 8,
                    fill: new Fill({ color: '#ff0000' }),
                    stroke: new Stroke({ color: '#ffffff', width: 2 })
                })
            }),
            zIndex: 10000,
            properties: { name: 'Mediciones Temporales', id: 'measurements-temp', type: 'overlay' }
        });

        // Inicializar Tooltip (Estilo Premium y Compacto)
        this.tooltipElement = document.createElement('div');
        this.tooltipElement.className = 'ol-tooltip-measure';
        this.tooltipElement.style.background = 'rgba(10, 25, 41, 0.95)';
        this.tooltipElement.style.color = '#fff';
        this.tooltipElement.style.padding = '6px 10px';
        this.tooltipElement.style.borderRadius = '8px';
        this.tooltipElement.style.fontSize = '12px';
        this.tooltipElement.style.fontFamily = "'Outfit', sans-serif";
        this.tooltipElement.style.pointerEvents = 'none';
        this.tooltipElement.style.display = 'none';
        this.tooltipElement.style.zIndex = '10001';
        this.tooltipElement.style.border = '1px solid rgba(79, 195, 247, 0.4)';
        this.tooltipElement.style.boxShadow = '0 4px 12px rgba(0,0,0,0.5)';
        this.tooltipElement.style.whiteSpace = 'nowrap';
        this.tooltipElement.style.width = 'max-content';
        this.tooltipElement.style.maxWidth = '250px';
        this.tooltipElement.style.boxSizing = 'border-box';
        this.tooltipElement.style.height = 'auto';

        this.tooltipOverlay = new Overlay({
            element: this.tooltipElement,
            offset: [15, 0],
            positioning: 'center-left',
            stopEvent: false
        });

        // Suscribirse a cambios de proyecto Y mapa simultáneamente
        combineLatest([
            this.mapService.map$,
            this.projectContext.activeProject$
        ]).subscribe(([map, project]) => {
            if (map && project) {
                this.activeProject_id = project.id;
                this.loadMeasurements(project.id);

                if (!map.getLayers().getArray().includes(this.persistentLayer)) {
                    map.addLayer(this.persistentLayer);
                }

                if (!map.getOverlays().getArray().includes(this.tooltipOverlay)) {
                    map.addOverlay(this.tooltipOverlay);
                }

                this.setupInteractions(map);
            }
        });
    }

    private setupInteractions(map: any) {
        // Hover -> Tooltip
        map.on('pointermove', (evt: any) => {
            if (evt.dragging) {
                this.tooltipElement.style.display = 'none';
                return;
            }

            const feature = map.forEachFeatureAtPixel(evt.pixel, (f: any) => f, {
                layerFilter: (l: any) => l === this.persistentLayer
            });

            if (feature) {
                const props = feature.getProperties();
                const description = props.description || '';
                const name = props.name || '';

                if (description || name) {
                    this.tooltipElement.style.display = 'block';
                    this.tooltipElement.style.width = 'fit-content';
                    this.tooltipElement.style.whiteSpace = (description || '').length > 40 ? 'normal' : 'nowrap';
                    this.tooltipElement.style.padding = '8px 12px';
                    this.tooltipElement.style.textAlign = 'left';

                    this.tooltipElement.innerHTML = `
                        <div style="font-weight: 600; color: #4fc3f7; font-size: 13px;">${name}</div>
                        ${description ? '<div style="color: #ddd; font-size: 11px; margin-top: 4px; max-width: 220px; line-height: 1.4;">' + description.substring(0, 150) + '</div>' : ''}
                        <div style="color: #81d4fa; font-size: 10px; margin-top: 6px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 4px;">
                            ${props.link ? '🖱️ Doble clic para abrir enlace<br>🖱️ Clic para seleccionar' : '🖱️ Clic para seleccionar'}
                        </div>
                    `;
                    this.tooltipOverlay.setPosition(evt.coordinate);
                    map.getTargetElement().style.cursor = 'pointer';
                }
                else {
                    this.tooltipElement.style.display = 'none';
                    map.getTargetElement().style.cursor = '';
                }
            } else {
                this.tooltipElement.style.display = 'none';
                this.tooltipOverlay.setPosition(undefined);
                map.getTargetElement().style.cursor = '';
            }
        });

        // Click -> Seleccionar
        map.on('singleclick', (evt: any) => {
            const pixel = map.getEventPixel(evt.originalEvent);
            const feature = map.forEachFeatureAtPixel(pixel, (f: any) => f, {
                layerFilter: (l: any) => l === this.persistentLayer,
                hitTolerance: 5
            });

            if (feature) {
                const id = feature.getProperties().measurementId;
                const m = this.measurementsSubject.getValue().find(mx => mx.id === id);
                if (m) {
                    this.ngZone.run(() => {
                        this.selectedMeasurementSubject.next(m);
                    });
                }
            } else {
                this.ngZone.run(() => {
                    this.selectedMeasurementSubject.next(null);
                });
            }
        });

        // Double Click -> Abrir Enlace en ventana nueva
        map.on('dblclick', (evt: any) => {
            const feature = map.forEachFeatureAtPixel(evt.pixel, (f: any) => f, {
                layerFilter: (l: any) => l === this.persistentLayer,
                hitTolerance: 5
            });

            if (feature) {
                const props = feature.getProperties();
                if (props.link) {
                    let url = props.link;
                    if (!url.startsWith('http')) {
                        url = 'https://' + url;
                    }
                    window.open(url, '_blank');
                    // Prevenir el zoom por defecto del doble clic (en OpenLayers dblclick zoom es por defecto)
                    evt.originalEvent.stopPropagation();
                    return false;
                }
            }
            return true;
        });
    }

    async loadMeasurements(projectId: number) {
        try {
            const measurements = await firstValueFrom(
                this.http.get<Measurement[]>(`${this.api.getApiUrl()}/projects/${projectId}/measurements`)
            );
            console.log(`[MeasurementService] ${measurements.length} medidas cargadas:`, measurements);
            this.ngZone.run(() => {
                this.measurementsSubject.next(measurements);
                this.renderMeasurements(measurements);
            });
        } catch (error) {
            console.error('Error loading measurements:', error);
        }
    }

    private renderMeasurements(measurements: Measurement[]) {
        const map = this.mapService.getMap();
        if (!map) return;

        const format = new GeoJSON();
        this.persistentSource.clear();

        console.log(`[Measurements] Renderizando ${measurements.length} medidas en capa persistente`);

        measurements.forEach(m => {
            if (m.visible === false) return;

            try {
                // Si la geometría es un string, parsearlo
                const geomData = typeof m.geometry === 'string' ? JSON.parse(m.geometry) : m.geometry;

                const geom = format.readGeometry(geomData, {
                    dataProjection: 'EPSG:4326',
                    featureProjection: 'EPSG:3857'
                });

                const f = new Feature(geom);

                // IMPORTANTE: No propagar el objeto 'm' entero porque contiene 'geometry' (GeoJSON)
                // y sobreescribiría la geometría interna de OpenLayers rompiendo el objeto.
                const { geometry, ...metadata } = m;
                f.setProperties({ measurementId: m.id, ...metadata });

                // ESTILO DE ALTA VISIBILIDAD: Trazo grueso con puntos en los vértices
                let style: Style;

                if (m.measurement_type === 'point') {
                    // Estilo de PIN (Material Icon 'place') - Similar al Pin de Mapas
                    const iconMap: Record<string, string> = {
                        'flag': 'flag',
                        'book': 'menu_book',
                        'build': 'build',
                        'engineering': 'engineering',
                        'tree': 'park'
                    };
                    const iconName = iconMap[m.icon || 'flag'] || 'flag';
                    const markerColor = m.style?.color || '#e91e63';

                    style = [
                        new Style({
                            text: new Text({
                                text: 'location_on',
                                font: '40px "Material Icons"',
                                fill: new Fill({ color: markerColor }),
                                stroke: new Stroke({ color: '#ffffff', width: 2 }),
                                offsetY: -18
                            }),
                            zIndex: 1000
                        }),
                        new Style({
                            text: new Text({
                                text: iconName,
                                font: '20px "Material Icons"',
                                fill: new Fill({ color: '#ffffff' }),
                                offsetY: -25
                            }),
                            zIndex: 1001
                        })
                    ] as any;
                } else {
                    style = new Style({
                        stroke: new Stroke({
                            color: m.style?.color || '#ff0000',
                            width: 5,
                            lineDash: m.style?.line_dash
                        }),
                        fill: m.style?.filled ? new Fill({
                            color: m.style?.fill_color || 'rgba(255, 0, 0, 0.2)'
                        }) : undefined,
                        image: new CircleStyle({
                            radius: 6,
                            fill: new Fill({ color: m.style?.color || '#ff0000' }),
                            stroke: new Stroke({ color: '#ffffff', width: 2.5 })
                        })
                    });
                }

                f.setStyle(style);
                this.persistentSource.addFeature(f);

                if (measurements.indexOf(m) === 0) {
                    console.log(`[Measurements] Ejemplo coords (${m.name}):`, (geom as any).getCoordinates?.());
                }
            } catch (e) {
                console.error('[Measurements] Error rendering measurement:', e, m);
            }
        });

        console.log(`[Measurements] ${this.persistentSource.getFeatures().length} features añadidas. zIndex: ${this.persistentLayer.getZIndex()}`);
        map.render();
    }

    async toggleVisibility(m: Measurement) {
        if (m.id) {
            const newVisible = m.visible === false ? true : false;
            await this.updateMeasurement(m.id, { visible: newVisible });
        }
    }

    zoomToMeasurement(m: Measurement) {
        const map = this.mapService.getMap();
        if (!map) return;

        const format = new GeoJSON();
        const geom = format.readGeometry(m.geometry, {
            dataProjection: 'EPSG:4326',
            featureProjection: 'EPSG:3857'
        });

        if (geom) {
            const extent = geom.getExtent();
            if (extent) {
                map.getView().fit(extent, { padding: [50, 50, 50, 50], duration: 1000 });
            }
        }
    }

    startDrawing(type: 'length' | 'area' | 'point') {
        const map = this.mapService.getMap();
        if (!map) return;

        this.stopDrawing();

        // Asegurar que la capa de dibujo esté en el mapa
        const layers = map.getLayers().getArray();
        if (!layers.includes(this.drawLayer)) {
            this.drawLayer.setZIndex(10000);
            map.addLayer(this.drawLayer);
            console.log('[Drawing] Capa de dibujo añadida al mapa.');
        }

        const olType = type === 'length' ? 'LineString' : (type === 'area' ? 'Polygon' : 'Point');
        console.log(`[Drawing] Iniciando dibujo de: ${type}`);

        this.drawInteraction = new Draw({
            source: this.drawSource,
            type: olType as any,
            style: new Style({
                fill: new Fill({ color: 'rgba(255, 0, 0, 0.3)' }),
                stroke: new Stroke({ color: '#ff0000', width: 4 }),
                image: new CircleStyle({
                    radius: 8,
                    fill: new Fill({ color: '#ff0000' }),
                    stroke: new Stroke({ color: '#ffffff', width: 2 })
                })
            })
        });

        map.addInteraction(this.drawInteraction);

        this.drawInteraction.on('drawend', async (event) => {
            this.ngZone.run(async () => {
                const feature = event.feature;
                const geometry = feature.getGeometry();
                if (!geometry || !this.activeProject_id) return;

                let value = 0;
                let unit = '';

                if (geometry instanceof LineString) {
                    value = getLength(geometry);
                    unit = value > 1000 ? 'km' : 'm';
                    if (unit === 'km') value /= 1000;
                } else if (geometry instanceof Polygon) {
                    value = getArea(geometry);
                    unit = value > 1000000 ? 'km²' : 'm²';
                    if (unit === 'km²') value /= 1000000;
                }

                const format = new GeoJSON();
                const geojson = format.writeGeometryObject(geometry, {
                    featureProjection: 'EPSG:3857',
                    dataProjection: 'EPSG:4326'
                });

                const nameSuffix = type === 'length' ? 'Longitud' : (type === 'area' ? 'Área' : 'Marcador');
                const newMeasurement: Partial<Measurement> = {
                    name: `${nameSuffix} ${new Date().toLocaleTimeString()}`,
                    project_id: this.activeProject_id,
                    measurement_type: type,
                    geometry: geojson,
                    icon: type === 'point' ? 'flag' : undefined,
                    measurement_data: type === 'point' ? undefined : { value: Number(value.toFixed(2)), unit: unit },
                    style: {
                        color: type === 'point' ? '#e91e63' : '#ff0000', // Rosa por defecto para banderas
                        stroke_width: 4,
                        filled: type === 'area',
                        fill_color: type === 'area' ? 'rgba(255, 0, 0, 0.2)' : 'rgba(233, 30, 99, 0.2)'
                    }
                };

                try {
                    const saved = await firstValueFrom(
                        this.http.post<Measurement>(`${this.api.getApiUrl()}/measurements`, newMeasurement)
                    );
                    console.log('[Drawing] Medida guardada con éxito', saved);
                    await this.loadMeasurements(this.activeProject_id);
                } catch (error) {
                    console.error('Error saving measurement:', error);
                }

                this.stopDrawing();
                this.drawSource.clear();
            });
        });
    }

    stopDrawing() {
        const map = this.mapService.getMap();
        if (map && this.drawInteraction) {
            map.removeInteraction(this.drawInteraction);
            this.drawInteraction = null;
        }
    }

    async deleteMeasurement(id: number) {
        try {
            await firstValueFrom(this.http.delete(`${this.api.getApiUrl()}/measurements/${id}`));
        } catch (error: any) {
            // Si el servidor dice 404, la medición ya no existe en el servidor.
            // Igual recargamos la lista para limpiar la UI.
            if (error?.status !== 404) {
                console.error('Error deleting measurement:', error);
            }
        } finally {
            // Siempre recargamos para quitar de la UI cualquier medida obsoleta
            this.loadMeasurements(this.activeProject_id!);
        }
    }

    async updateMeasurement(id: number, update: Partial<Measurement>) {
        console.log(`[MeasurementService] Actualizando medida ${id}:`, update);
        try {
            const resp = await firstValueFrom(this.http.patch(`${this.api.getApiUrl()}/measurements/${id}`, update));
            console.log(`[MeasurementService] Medida ${id} actualizada con éxito:`, resp);
            await this.loadMeasurements(this.activeProject_id!);
        } catch (error) {
            console.error('Error updating measurement:', error);
            throw error;
        }
    }

    async exportKmz(ids?: number[]) {
        if (!this.activeProject_id) return;

        let url = `${this.api.getApiUrl()}/projects/${this.activeProject_id}/measurements/export/kmz`;
        if (ids && ids.length > 0) {
            url += `?measurement_ids=${ids.join(',')}`;
        }

        try {
            // Usar HttpClient para enviar el token en el header (Blob download)
            const blob = await firstValueFrom(this.http.get(url, { responseType: 'blob' }));
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = `medidas_proyecto_${this.activeProject_id}.kmz`;
            link.click();
            window.URL.revokeObjectURL(downloadUrl);
        } catch (error: any) {
            console.error('Error downloading KMZ:', error);
            let msg = 'Error al descargar KMZ.';
            if (error.status === 401) msg += ' Sesión expirada o no autenticado.';
            else if (error.status === 403) msg += ' No tiene permisos para este proyecto.';
            else if (error.status === 500) msg += ' Error interno del servidor al generar el archivo.';

            alert(msg);
        }
    }

    /**
     * Importa una lista de registros geográficos como mediciones reales en una subcarpeta
     */
    async importRecordsAsMeasurements(records: any[], folderName: string): Promise<void> {
        if (!this.activeProject_id || records.length === 0) return;

        try {
            // 1. Crear la carpeta
            const folder = await firstValueFrom(
                this.http.post<any>(`${this.api.getApiUrl()}/folders/`, {
                    name: folderName,
                    project_id: this.activeProject_id
                })
            );

            console.log(`[MeasurementService] Carpeta '${folderName}' creada:`, folder);

            // 2. Crear las mediciones para cada registro
            const promises = records.map(record => {
                // Obtener coordenadas analizando el string de Google o el objeto coords
                let lat = record['Norte (Lat)'] || (record.coords ? record.coords.lat : null);
                let lon = record['Este (Lon)'] || (record.coords ? record.coords.lon : null);
                
                if (lat === null || lon === null || isNaN(lat) || isNaN(lon)) return Promise.resolve();

                // --- Lógica de Semáforo ---
                // Verde (#4caf50): Obra / Área intervención
                // Amarillo (#ffeb3b): Oficina
                // Rojo (#f44336): Ubicación externa
                const clasif = (record['Clasificación'] || '').toLowerCase();
                let markerColor = '#f44336'; // Rojo por defecto
                
                if (clasif.includes('obra')) {
                    markerColor = '#4caf50';
                } else if (clasif.includes('oficina')) {
                    markerColor = '#ffeb3b';
                }

                // --- Título y Metadata (usando llaves exactas del backend) ---
                const fechaStr = record['Fecha del registro'] || 'S/F';
                const formatoStr = record['Formato'] || 'S/F';
                const colaborador = record['Colaborador'] || 'Desconocido';
                const link = record['URL Registro'] || null;

                const measurement: any = {
                    name: `${fechaStr} - ${formatoStr}`,
                    project_id: this.activeProject_id,
                    folder_id: folder.id,
                    measurement_type: 'point',
                    description: `Colaborador: ${colaborador}\nClasificación: ${record['Clasificación'] || 'N/A'}`,
                    geometry: {
                        type: 'Point',
                        coordinates: [lon, lat]
                    },
                    icon: 'flag',
                    link: link,
                    style: {
                        color: markerColor,
                        stroke_width: 2,
                        filled: true
                    }
                };

                return firstValueFrom(this.http.post(`${this.api.getApiUrl()}/measurements`, measurement));
            });

            await Promise.all(promises);
            console.log(`[MeasurementService] ${records.length} registros procesados.`);

            // 3. Notificar cambios y recargar proyecto (por sus carpetas)
            await this.loadMeasurements(this.activeProject_id);
            
            const updatedProject = await firstValueFrom(
                this.http.get<any>(`${this.api.getApiUrl()}/projects/by-id/${this.activeProject_id}`)
            );
            this.projectContext.setActiveProject(updatedProject);

        } catch (error) {
            console.error('Error importing records:', error);
            throw error;
        }
    }
}
