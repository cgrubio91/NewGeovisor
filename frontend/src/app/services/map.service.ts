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
import { Subject, BehaviorSubject, Observable } from 'rxjs';
import { filter } from 'rxjs/operators';
import { Style, Fill, Stroke, Text, Circle as CircleStyle } from 'ol/style';
import HeatmapLayer from 'ol/layer/Heatmap';

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
    private recordsGeoJSON: any = null; // Persistencia de registros
    private recordsLayerId: string = 'registros_temporales_9999';
    public layersChanged = new BehaviorSubject<any[]>([]);
    public compareToolTrigger = new Subject<string | number | null>();

    private mapSubject = new BehaviorSubject<OlMap | null>(null);
    public map$ = this.mapSubject.asObservable().pipe(filter(m => !!m)) as Observable<OlMap>;
    private mapReady = new BehaviorSubject<boolean>(false); // Added for map readiness notification

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
        if (this.map) {
            // Save all non-base layers before destroying
            const savedLayers = this.map.getLayers().getArray()
                .filter((l: any) => l.get('type') !== 'base')
                .slice(); // clone the array

            // Destroy old target first to cleanly detach OL canvas
            this.map.setTarget(undefined);

            // Create the new map on the fresh DOM element
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
                    }),
                    ...savedLayers
                ],
                view: this.map.getView() // Preserve current view/zoom
            });

            this.mapSubject.next(this.map);
            this.updateLayerList();
            // Re-add records layer if it was cached
            if (this.recordsGeoJSON) {
                this.addVectorLayer('Registros Filtrados', this.recordsGeoJSON, 9999);
            }
            return this.map;
        }

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
                zoom: 12,
                maxZoom: 24  // Allow high zoom for detailed orthophotos
            })
        });

        this.mapSubject.next(this.map);
        this.updateLayerList();
        // Re-add records layer if it was cached
        if (this.recordsGeoJSON) {
            this.addVectorLayer('Registros Filtrados', this.recordsGeoJSON, 9999);
        }
        
        // Add pending session layers
        if (this.pendingSessionLayers.length > 0) {
            this.pendingSessionLayers.forEach(l => this.map.addLayer(l));
            this.pendingSessionLayers = [];
            this.updateLayerList();
        }
        
        return this.map;
    }

    /**
     * Agrega una nueva capa al mapa
     */
    addLayer(layer: any, type: string = 'raster') {
        if (!this.map) {
            console.warn('MapService: Intentando añadir capa pero el mapa no está inicializado');
            return;
        }
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
                crossOrigin: 'anonymous',
                maxZoom: 24
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

    addVectorLayer(name: string, geojson: any, id?: number, folderId?: number | null) {
        // Si es la capa de registros (ID 9999), guardarla para persistencia
        if (id === 9999) {
            this.recordsGeoJSON = geojson;
        }

        const vectorSource = new VectorSource({
            features: new GeoJSON().readFeatures(geojson, {
                dataProjection: 'EPSG:4326',
                featureProjection: 'EPSG:3857'
            })
        });

        // Crear la capa
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

        // Intentar añadir solo si el mapa existe
        if (this.map) {
            this.addLayer(vectorLayer, 'vector');
            if (vectorSource.getFeatures().length > 0) {
                this.zoomToExtent(vectorSource.getExtent(), 'EPSG:3857');
            }
        } else {
            console.log('MapService: Mapa no listo, capa guardada en cache para inicio posterior.');
        }
    }

    /**
     * Agrega una capa de mapa de calor
     */
    addHeatmapLayer(name: string, geojson: any, id?: string | number) {
        console.log(`[MapService] Generando Heatmap: ${name} con ${geojson.features.length} puntos`);
        const heatmapLayer = new HeatmapLayer({
            source: new VectorSource({
                features: new GeoJSON().readFeatures(geojson, {
                    dataProjection: 'EPSG:4326',
                    featureProjection: 'EPSG:3857'
                })
            }),
            blur: 20,
            radius: 10,
            weight: (feature) => {
                // Se puede pesar basándose en alguna propiedad si se desea
                return 1.0;
            },
            properties: {
                name: name,
                id: id || 'heatmap_' + Date.now(),
                type: 'heatmap',
                geojson: geojson // Store for download
            }
        });

        if (this.map) {
            this.addLayer(heatmapLayer, 'heatmap');
        } else {
            // Si el mapa no está listo, guardarlo para añadirlo al iniciar
            this.pendingSessionLayers.push(heatmapLayer);
        }
    }

    private pendingSessionLayers: any[] = [];

    clearRecordsLayer() {
        this.recordsGeoJSON = null;
        this.removeLayer(9999);
    }

    getLayerById(id: string | number) {
        return this.layers.find(l => l.id == id);
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
     * @param force Si es true, limpia incluso las capas de sesión (heatmaps, etc)
     */
    clearLayers(force: boolean = false) {
        if (!this.map) return;
        const layers = this.map.getLayers().getArray();
        for (let i = layers.length - 1; i >= 0; i--) {
            const layer = layers[i];
            const type = layer.get('type');
            
            // Si no es base y (es forzado o no es una capa persistente de sesión)
            if (type !== 'base' && type !== 'overlay') {
                if (force || (type !== 'heatmap' && layer.get('id') !== 9999)) {
                    this.map.removeLayer(layer);
                }
            }
        }
        this.updateLayerList();
    }

    private getKMLStyle(feature: any) {
        const name = feature.get('name') || feature.get('title') || '';
        const featureColor = feature.get('color') || '#00ffff'; // Color desde propiedad o cyan por defecto

        return new Style({
            // Relleno: basado en featureColor si existe
            fill: new Fill({ color: featureColor + '99' }), // Añadir transparencia 99hex (~60%)

            // Líneas: Gris oscuro
            stroke: new Stroke({ color: '#333333', width: 2.5 }),

            // Puntos: Reflejan el color de la clasificación
            image: new CircleStyle({
                radius: 6,
                fill: new Fill({ color: featureColor }),
                stroke: new Stroke({ color: '#000000', width: 2 })
            }),

            // Texto: Legible
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
        const layer = this.layers.find(l => l.id == layerId);
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
        const layer = this.layers.find(l => l.id == layerId);
        if (layer) {
            layer.instance.setOpacity(opacity);
            this.updateLayerList();
        }
    }

    /**
     * Establece la visibilidad de una capa de forma explícita
     */
    setLayerVisibility(layerId: string | number, visible: boolean) {
        const layer = this.layers.find(l => l.id == layerId);
        if (layer) {
            layer.instance.setVisible(visible);
            this.updateLayerList();
        }
    }

    /**
     * Alterna la visibilidad de una capa
     */
    toggleLayerVisibility(layerId: string | number) {
        const layer = this.layers.find(l => l.id == layerId);
        if (layer) {
            // Si es una capa base, asegurar que solo una esté visible
            if (layer.type === 'base') {
                this.layers.filter(l => l.type === 'base').forEach(bl => {
                    bl.instance.setVisible(bl.id == layerId);
                });
            } else {
                layer.instance.setVisible(!layer.instance.getVisible());
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
    enableSwipe(layerId: string | number, side: 'left' | 'right' = 'left') {
        const key = String(layerId);
        // Desactivar si ya existe para asegurar que el lado sea el correcto
        if (this.swipeListeners.has(key)) {
            this.disableSwipe(layerId);
        }

        // Buscar capa por ID de forma robusta
        const layer = (this.map.getLayers().getArray().find(l => l.get('id') == layerId)) as any;
        if (!layer) {
            console.warn(`MapService: No se pudo encontrar la capa ${layerId} para activar swipe`);
            return;
        }

        const prerender = (event: any) => {
            const ctx = event.context;
            if (!ctx) return; // Skip if no canvas context (WebGL)

            const mapSize = this.map.getSize();
            if (!mapSize) return;

            const pixelRatio = event.frameState?.pixelRatio || window.devicePixelRatio || 1;
            const fullWidth = mapSize[0] * pixelRatio;
            const width = mapSize[0] * (this.swipePosition / 100) * pixelRatio;
            const height = mapSize[1] * pixelRatio;

            ctx.save();
            ctx.beginPath();
            if (side === 'left') {
                ctx.rect(0, 0, width, height);
            } else {
                ctx.rect(width, 0, fullWidth - width, height);
            }
            ctx.clip();
        };

        const postrender = (event: any) => {
            const ctx = event.context;
            if (ctx) ctx.restore();
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
            // Buscar instancia directamente en el mapa con comparación de tipo flexible
            const layer = this.map.getLayers().getArray().find(l => l.get('id') == layerId) as any;
            if (layer) {
                layer.un('prerender', listeners.prerender);
                layer.un('postrender', listeners.postrender);
                console.log(`MapService: Swipe desactivado para capa ${layerId}`);
            } else {
                console.warn(`MapService: Se intentó desactivar swipe para ${layerId} pero no se encontró la capa`);
            }
            this.swipeListeners.delete(key);
            this.map.render();
        }
    }

    /**
     * Desactiva swipe en todas las capas
     */
    disableAllSwipe() {
        this.swipeListeners.forEach((_, key) => {
            this.disableSwipe(key);
        });
        this.swipeListeners.clear();
        this.map.render();
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
                    maxZoom: 22,
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
