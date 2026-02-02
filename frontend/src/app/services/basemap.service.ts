import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import XYZ from 'ol/source/XYZ';
import BingMaps from 'ol/source/BingMaps';

export interface BaseMapOption {
    id: string;
    name: string;
    description: string;
    thumbnail?: string;
    attribution?: string;
}

@Injectable({
    providedIn: 'root'
})
export class BaseMapService {
    private currentBaseMapSubject = new BehaviorSubject<string>('osm');
    public currentBaseMap$ = this.currentBaseMapSubject.asObservable();

    // Definición de mapas base disponibles
    public baseMaps: BaseMapOption[] = [
        {
            id: 'osm',
            name: 'OpenStreetMap',
            description: 'Mapa estándar de OpenStreetMap',
            attribution: '© OpenStreetMap contributors'
        },
        {
            id: 'satellite',
            name: 'Satélite',
            description: 'Imágenes satelitales',
            attribution: 'Imagery © Esri'
        },
        {
            id: 'terrain',
            name: 'Terreno',
            description: 'Mapa topográfico con relieve',
            attribution: '© OpenTopoMap'
        },
        {
            id: 'dark',
            name: 'Oscuro',
            description: 'Mapa con tema oscuro',
            attribution: '© CartoDB'
        },
        {
            id: 'light',
            name: 'Claro',
            description: 'Mapa con tema claro',
            attribution: '© CartoDB'
        },
        {
            id: 'none',
            name: 'Sin mapa base',
            description: 'Sin capa de fondo',
            attribution: ''
        }
    ];

    constructor() { }

    /**
     * Obtener el mapa base actual
     */
    getCurrentBaseMap(): string {
        return this.currentBaseMapSubject.value;
    }

    /**
     * Establecer el mapa base actual
     */
    setBaseMap(baseMapId: string): void {
        if (this.baseMaps.find(bm => bm.id === baseMapId)) {
            this.currentBaseMapSubject.next(baseMapId);
        }
    }

    /**
     * Crear capa de mapa base para OpenLayers
     */
    createBaseMapLayer(baseMapId: string): TileLayer<any> | null {
        switch (baseMapId) {
            case 'osm':
                return new TileLayer({
                    source: new OSM(),
                    properties: { name: 'basemap' }
                });

            case 'satellite':
                return new TileLayer({
                    source: new XYZ({
                        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
                        attributions: 'Tiles © Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
                    }),
                    properties: { name: 'basemap' }
                });

            case 'terrain':
                return new TileLayer({
                    source: new XYZ({
                        url: 'https://{a-c}.tile.opentopomap.org/{z}/{x}/{y}.png',
                        attributions: 'Map data: © OpenStreetMap contributors, SRTM | Map style: © OpenTopoMap'
                    }),
                    properties: { name: 'basemap' }
                });

            case 'dark':
                return new TileLayer({
                    source: new XYZ({
                        url: 'https://{a-d}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
                        attributions: '© CartoDB, © OpenStreetMap contributors'
                    }),
                    properties: { name: 'basemap' }
                });

            case 'light':
                return new TileLayer({
                    source: new XYZ({
                        url: 'https://{a-d}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
                        attributions: '© CartoDB, © OpenStreetMap contributors'
                    }),
                    properties: { name: 'basemap' }
                });

            case 'none':
                return null;

            default:
                return new TileLayer({
                    source: new OSM(),
                    properties: { name: 'basemap' }
                });
        }
    }

    /**
     * Crear proveedor de terreno para Cesium (3D)
     */
    createCesiumTerrainProvider(baseMapId: string): any {
        // Esto se implementará cuando se integre con Cesium
        // Por ahora retornamos la configuración básica
        return {
            baseMapId,
            // Configuración de Cesium se agregará aquí
        };
    }

    /**
     * Obtener URL del mapa base para tiles
     */
    getBaseMapTileUrl(baseMapId: string): string | null {
        switch (baseMapId) {
            case 'osm':
                return 'https://{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png';
            case 'satellite':
                return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
            case 'terrain':
                return 'https://{a-c}.tile.opentopomap.org/{z}/{x}/{y}.png';
            case 'dark':
                return 'https://{a-d}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png';
            case 'light':
                return 'https://{a-d}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png';
            default:
                return null;
        }
    }
}
