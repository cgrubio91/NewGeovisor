import { Injectable } from '@angular/core';
import OlMap from 'ol/Map';

import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import OSM from 'ol/source/OSM';
import { fromLonLat, transformExtent } from 'ol/proj';
import XYZ from 'ol/source/XYZ';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import KML from 'ol/format/KML';
import { register } from 'ol/proj/proj4';
import proj4 from 'proj4';
import { Subject, BehaviorSubject } from 'rxjs';
import { Style, Fill, Stroke, Text, Circle as CircleStyle } from 'ol/style';

// Register all available proj4 definitions
register(proj4);

/**
 * Servicio para gestionar el mapa y las capas
 * Proporciona funcionalidades para agregar capas, controlar visibilidad,
 * opacidad y herramienta de comparación (swipe)
 */
@Injectable({
    providedIn: 'root'
})
export class MapService {
    private map!: OlMap;
    private layers: any[] = [];
    private loadingLayers = new Set<number | string>();
    public layersChanged = new BehaviorSubject<any[]>([]);
    public compareToolTrigger = new Subject<string | number | null>();

    constructor() { }

    getLayers() {
        return this.layers;
    }

    openCompareTool(layerId: string | number | null = null) {
        console.log('MapService: Emitting compareToolTrigger with id:', layerId);
        this.compareToolTrigger.next(layerId);
    }

    /**
     * Inicializa el mapa con configuración por defecto
     * @param target ID del elemento HTML donde se renderizará el mapa
     * @returns Instancia del mapa creado
     */
    initMap(target: string) {
        this.map = new OlMap({
            target: target,
            layers: [
                new TileLayer({
                    source: new OSM(),
                    properties: { name: 'Mapa (OSM)', id: 'osm', type: 'base' }
                }),
                new TileLayer({
                    source: new XYZ({
                        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
                        maxZoom: 19
                    }),
                    visible: false,
                    properties: { name: 'Satélite', id: 'satellite', type: 'base' }
                })
            ],
            view: new View({
                center: fromLonLat([-74.006, 4.711]), // Centro por defecto: Bogotá, Colombia
                zoom: 12
            })
        });
        this.updateLayerList();
        return this.map;
    }

    /**
     * Agrega una nueva capa al mapa
     */
    addLayer(layer: any, type: string = 'raster') {
        layer.set('type', type);
        this.map.addLayer(layer);
        this.updateLayerList();
    }

    /**
     * Agrega una capa raster (XYZ/Tiles)
     */
    addRasterLayer(name: string, url: string, extent?: number[], id?: number, folderId?: number | null) {
        // Transformar extent a la proyección del mapa (3857) si se proporciona en 4326
        let transformedExtent = extent;
        if (extent) {
            // Asumimos que si los valores son pequeños (lon/lat), están en 4326
            const isLonLat = Math.abs(extent[0]) <= 180 && Math.abs(extent[1]) <= 90;
            if (isLonLat) {
                transformedExtent = transformExtent(extent, 'EPSG:4326', 'EPSG:3857');
            }
        }

        const layer = new TileLayer({
            source: new XYZ({
                url: url,
                crossOrigin: 'anonymous'
            }),
            extent: transformedExtent,
            properties: {
                name: name,
                id: id || name + Date.now(),
                type: 'raster',
                originalExtent: extent,
                folder_id: folderId
            }
        });

        this.addLayer(layer, 'raster');

        if (transformedExtent) {
            this.zoomToExtent(transformedExtent, 'EPSG:3857');
        }
    }

    /**
     * Agrega una capa vector (GeoJSON)
     */
    addVectorLayer(name: string, geojson: any, id?: number, folderId?: number | null) {
        const vectorSource = new VectorSource({
            features: new GeoJSON().readFeatures(geojson, {
                dataProjection: 'EPSG:4326',
                featureProjection: 'EPSG:3857'
            })
        });

        const vectorLayer = new VectorLayer({
            source: vectorSource,
            style: (feature) => this.getKMLStyle(feature),
            properties: {
                name: name,
                id: id || name + Date.now(),
                type: 'vector',
                folder_id: folderId
            }
        });

        this.addLayer(vectorLayer, 'vector');
        this.zoomToExtent(vectorSource.getExtent(), 'EPSG:3857');
    }

    getLayerById(id: string | number) {
        return this.layers.find(l => l.id === id);
    }

    /**
     * Agrega una capa KML
     */
    async addKmlLayer(name: string, url: string, id?: number, folderId?: number | null) {
        // Evitar duplicados si ya existe o se está cargando
        if (id && (this.getLayerById(id) || this.loadingLayers.has(id))) {
            console.log(`[KML] Capa ${name} (ID: ${id}) ya existe o está cargándose, saltando...`);
            return;
        }

        if (id) this.loadingLayers.add(id);

        try {
            console.log(`[KML] Iniciando carga de: ${name} desde ${url}`);

            // 1. Obtener el contenido del KML manualmente para poder manipularlo
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Error al descargar KML: ${response.statusText}`);
            let kmlText = await response.text();

            // 2. Resolver rutas relativas de iconos/texturas/estilos (común en KMZ extraídos)
            const lastSlashIndex = url.lastIndexOf('/');
            const baseUrl = url.substring(0, lastSlashIndex + 1);
            console.log(`[KML] Base URL detectada: ${baseUrl}`);

            // Regex mejorado: Busca <href>, <styleUrl>, <icon>, etc.
            const urlTagsRegex = /<(href|styleUrl|Icon|icon)>(.*?)<\/\1>/gi;

            kmlText = kmlText.replace(urlTagsRegex, (match, tag, path) => {
                const cleanPath = path.trim();

                // NO reescribir si:
                // - Empieza con # (es un estilo interno/referencia local)
                // - Empieza con http/https/data: (ya es absoluto)
                if (cleanPath.startsWith('#') || /^(http|https|data:)/i.test(cleanPath)) {
                    return match;
                }

                // Limpiar posibles slashes iniciales para evitar "//"
                const normalizedPath = cleanPath.replace(/^\/+/, '');
                const absoluteUrl = `${baseUrl}${normalizedPath}`;

                console.log(`[KML] Reescrito: <${tag}>${cleanPath}</${tag}> -> <${tag}>${absoluteUrl}</${tag}>`);
                return `<${tag}>${absoluteUrl}</${tag}>`;
            });

            // 3. Parsear los features con el contenido modificado
            const kmlFormat = new KML({
                extractStyles: true,
                showPointNames: true
            });

            const features = kmlFormat.readFeatures(kmlText, {
                dataProjection: 'EPSG:4326',
                featureProjection: 'EPSG:3857'
            });

            if (!features || features.length === 0) {
                console.warn(`[KML] No se encontraron elementos válidos en el archivo KML: ${name}`);
            }

            const vectorSource = new VectorSource({
                features: features
            });

            const vectorLayer = new VectorLayer({
                source: vectorSource,
                style: (feature: any) => {
                    const style = feature.getStyle();
                    if (style) return style;
                    return this.getKMLStyle(feature);
                },
                properties: {
                    name: name,
                    id: id || name + Date.now(),
                    type: 'kml',
                    folder_id: folderId
                }
            });

            this.addLayer(vectorLayer, 'kml');
            vectorLayer.setZIndex(100);

            // 4. Enfocar y Debug de coordenadas
            if (features.length > 0) {
                const extent = vectorSource.getExtent();
                console.log(`[KML] Extent de la capa '${name}':`, extent);

                if (extent && extent[0] !== Infinity && !isNaN(extent[0])) {
                    this.zoomToExtent(extent, 'EPSG:3857');
                }

                // Debug del primer elemento
                const firstGeom = features[0].getGeometry();
                if (firstGeom) {
                    console.log(`[KML] Coordenadas de ejemplo (Feature 0):`, (firstGeom as any).getCoordinates?.() || 'No coords');
                }
            }

            console.log(`[OK] KML '${name}' cargado con ${features.length} elementos.`);

        } catch (error) {
            console.error(`[ERROR] en addKmlLayer para ${name}:`, error);
            const vectorSource = new VectorSource({
                url: url,
                format: new KML({ extractStyles: true })
            });
            const vectorLayer = new VectorLayer({
                source: vectorSource,
                style: (feature: any) => this.getKMLStyle(feature),
                properties: { name, id: id || name + Date.now(), type: 'kml', folder_id: folderId }
            });
            vectorLayer.setZIndex(100);
            this.addLayer(vectorLayer, 'kml');
        } finally {
            if (id) this.loadingLayers.delete(id);
        }
    }

    /**
     * Limpia todas las capas no base del mapa
     */
    clearLayers() {
        if (!this.map) return;
        const layers = this.map.getLayers().getArray();
        for (let i = layers.length - 1; i >= 0; i--) {
            const layer = layers[i];
            if (layer.get('type') !== 'base') {
                this.map.removeLayer(layer);
            }
        }
        this.updateLayerList();
    }

    private getKMLStyle(feature: any) {
        const name = feature.get('name') || '';

        return new Style({
            // Relleno: Verde Lima con buena opacidad
            fill: new Fill({ color: 'rgba(50, 205, 50, 0.6)' }),

            // Líneas: Gris oscuro para máximo contraste sobre el mapa
            stroke: new Stroke({ color: '#333333', width: 2.5 }),

            // Puntos: Círculo Cyan con borde negro
            image: new CircleStyle({
                radius: 6,
                fill: new Fill({ color: '#00ffff' }),
                stroke: new Stroke({ color: '#000000', width: 2 })
            }),

            // Texto: Legible con borde negro
            text: new Text({
                text: name,
                font: 'bold 12px "Outfit", sans-serif',
                fill: new Fill({ color: '#ffffff' }),
                stroke: new Stroke({ color: '#000000', width: 3 }),
                offsetY: -15,
                textAlign: 'center',
                overflow: true
            })
        });
    }

    /**
     * Actualiza la lista de capas y notifica a los suscriptores
     */
    updateLayerList() {
        this.layers = this.map.getLayers().getArray().map(l => ({
            id: l.get('id'),
            name: l.get('name'),
            type: l.get('type') || 'raster',
            visible: l.getVisible(),
            opacity: l.getOpacity(),
            z_index: l.getZIndex() || 0,
            folder_id: l.get('folder_id'),
            instance: l
        }));
        this.layersChanged.next(this.layers);
    }

    /**
     * Establece el orden de apilamiento de una capa
     */
    setLayerZIndex(layerId: string | number, zIndex: number) {
        const layer = this.layers.find(l => l.id === layerId);
        if (layer) {
            layer.instance.setZIndex(zIndex);
            this.updateLayerList();
        }
    }

    /**
     * Establece la opacidad de una capa
     * @param layerId Identificador de la capa
     * @param opacity Valor de opacidad (0-1)
     */
    setLayerOpacity(layerId: string | number, opacity: number) {
        const layer = this.layers.find(l => l.id === layerId);
        if (layer) {
            layer.instance.setOpacity(opacity);
            this.updateLayerList();
        }
    }

    /**
     * Alterna la visibilidad de una capa
     */
    toggleLayerVisibility(layerId: string | number) {
        const layer = this.layers.find(l => l.id === layerId);
        if (layer) {
            // Si es una capa base, asegurar que solo una esté visible
            if (layer.type === 'base') {
                this.layers.filter(l => l.type === 'base').forEach(bl => {
                    bl.instance.setVisible(bl.id === layerId);
                });
            } else {
                layer.instance.setVisible(!layer.visible);
            }
            this.updateLayerList();
        }
    }

    /**
     * Activa la herramienta de comparación (swipe) para una capa
     */
    private swipeListeners = new Map<string, { prerender: any, postrender: any }>();

    /**
     * Activa la herramienta de comparación (swipe) para una capa
     */
    enableSwipe(layerId: string | number) {
        const key = String(layerId);
        if (this.swipeListeners.has(key)) return;

        const layer = this.layers.find(l => l.id === layerId)?.instance;
        if (!layer) return;

        const prerender = (event: any) => {
            const ctx = event.context;
            const mapSize = this.map.getSize();
            if (!mapSize || !ctx) return;

            // Importante: El contexto del canvas puede estar escalado (Retina/High-DPI)
            const pixelRatio = event.frameState?.pixelRatio || window.devicePixelRatio || 1;

            const width = mapSize[0] * (this.swipePosition / 100) * pixelRatio;
            const height = mapSize[1] * pixelRatio;

            ctx.save();
            ctx.beginPath();
            ctx.rect(0, 0, width, height);
            ctx.clip();
        };

        const postrender = (event: any) => {
            const ctx = event.context;
            ctx.restore();
        };

        layer.on('prerender', prerender);
        layer.on('postrender', postrender);

        this.swipeListeners.set(key, { prerender, postrender });
        this.map.render();
    }

    /**
     * Desactiva la herramienta de comparación para una capa
     */
    disableSwipe(layerId: string | number) {
        const key = String(layerId);
        const listeners = this.swipeListeners.get(key);

        if (listeners) {
            const layer = this.layers.find(l => l.id === layerId)?.instance;
            if (layer) {
                layer.un('prerender', listeners.prerender);
                layer.un('postrender', listeners.postrender);
            }
            this.swipeListeners.delete(key);
            this.map.render();
        }
    }

    private swipePosition = 50;

    setSwipePosition(pos: number) {
        this.swipePosition = pos;
        this.map.render();
    }

    getMap() {
        return this.map;
    }

    zoomToLayer(layer: any) {
        if (!this.map || !layer) return;

        let extent = layer.getExtent();

        if (!extent) {
            const source = layer.getSource();
            if (source && typeof source.getExtent === 'function') {
                extent = source.getExtent();
            }
        }

        if (extent) {
            const isValidExtent = extent &&
                extent[0] !== Infinity &&
                extent[0] !== -Infinity &&
                !extent.includes(NaN);

            if (isValidExtent) {
                this.map.getView().fit(extent, {
                    padding: [50, 50, 50, 50],
                    duration: 1000
                });
            }
        }
    }

    zoomToExtent(extent: number[], dataProjection: string = 'EPSG:4326') {
        if (!this.map || !extent) return;

        const isValid = extent.length === 4 &&
            extent.every(v => v !== null && v !== undefined && !isNaN(v));

        const isEmpty = Math.abs(extent[0] - extent[2]) < 0.000001 &&
            Math.abs(extent[1] - extent[3]) < 0.000001;

        if (isValid && !isEmpty) {
            try {
                let fitExtent = extent;
                if (dataProjection !== 'EPSG:3857') {
                    fitExtent = transformExtent(extent, dataProjection, 'EPSG:3857');
                }

                this.map.getView().fit(fitExtent, {
                    padding: [50, 50, 50, 50],
                    maxZoom: 18,
                    duration: 1000
                });
            } catch (e) {
                console.warn('MapService: Error fitting extent', e);
            }
        }
    }

    removeLayer(id: string | number) {
        const layerIdx = this.layers.findIndex(l => l.id === id);
        if (layerIdx !== -1) {
            this.map.removeLayer(this.layers[layerIdx].instance);
            this.updateLayerList();
        }
    }

    zoomToAllLayers() {
        if (!this.map) return;
        const visibleLayers = this.layers.filter(l => l.visible && l.type !== 'base');
        if (visibleLayers.length === 0) return;

        let totalExtent = [Infinity, Infinity, -Infinity, -Infinity];
        visibleLayers.forEach(l => {
            const source = l.instance.getSource();
            if (source && typeof source.getExtent === 'function') {
                const extent = source.getExtent();
                if (extent && !extent.includes(NaN) && extent[0] !== Infinity) {
                    totalExtent[0] = Math.min(totalExtent[0], extent[0]);
                    totalExtent[1] = Math.min(totalExtent[1], extent[1]);
                    totalExtent[2] = Math.max(totalExtent[2], extent[2]);
                    totalExtent[3] = Math.max(totalExtent[3], extent[3]);
                }
            }
        });

        if (totalExtent[0] !== Infinity) {
            this.map.getView().fit(totalExtent, {
                padding: [100, 100, 100, 100],
                duration: 1000
            });
        }
    }

    transformExtent(extent: number[], source: string, target: string): number[] {
        return transformExtent(extent, source, target);
    }
}
