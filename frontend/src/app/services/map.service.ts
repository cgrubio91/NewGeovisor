import { Injectable } from '@angular/core';
import Map from 'ol/Map';

import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import OSM from 'ol/source/OSM';
import { fromLonLat, transformExtent } from 'ol/proj';
import XYZ from 'ol/source/XYZ';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import { register } from 'ol/proj/proj4';
import proj4 from 'proj4';
import { Subject } from 'rxjs';
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
    private map!: Map;
    private layers: any[] = [];
    public layersChanged = new Subject<any[]>();

    constructor() { }

    /**
     * Inicializa el mapa con configuración por defecto
     * @param target ID del elemento HTML donde se renderizará el mapa
     * @returns Instancia del mapa creado
     */
    initMap(target: string) {
        this.map = new Map({
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
    addRasterLayer(name: string, url: string, extent?: number[]) {
        const layer = new TileLayer({
            source: new XYZ({
                url: url,
                crossOrigin: 'anonymous'
            }),
            properties: {
                name: name,
                id: name + Date.now(),
                type: 'raster'
            }
        });

        this.addLayer(layer, 'raster');

        if (extent) {
            this.zoomToExtent(extent);
        }
    }

    /**
     * Agrega una capa vector (GeoJSON)
     */
    addVectorLayer(name: string, geojson: any) {
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
                id: name + Date.now(),
                type: 'vector'
            }
        });

        this.addLayer(vectorLayer, 'vector');
        this.zoomToLayer(vectorLayer);
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
            stroke: new Stroke({ color: '#00fbff', width: 2 }),
            fill: new Fill({ color: 'rgba(0, 251, 255, 0.2)' }),
            image: new CircleStyle({
                radius: 5,
                fill: new Fill({ color: '#00fbff' }),
                stroke: new Stroke({ color: '#fff', width: 1 })
            }),
            text: new Text({
                text: name,
                font: 'bold 14px "Outfit", sans-serif',
                fill: new Fill({ color: '#fff' }),
                stroke: new Stroke({ color: '#000', width: 3 }),
                offsetY: -15,
                textAlign: 'center'
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
            instance: l
        }));
        this.layersChanged.next(this.layers);
    }

    /**
     * Establece la opacidad de una capa
     * @param layerId Identificador de la capa
     * @param opacity Valor de opacidad (0-1)
     */
    setLayerOpacity(layerId: string, opacity: number) {
        const layer = this.layers.find(l => l.id === layerId);
        if (layer) {
            layer.instance.setOpacity(opacity);
            this.updateLayerList();
        }
    }

    /**
     * Alterna la visibilidad de una capa
     * @param layerId Identificador de la capa
     */
    toggleLayerVisibility(layerId: string) {
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
     * La capa se recortará según la posición del swipe
     * @param topLayerId Identificador de la capa a comparar
     */
    enableSwipe(topLayerId: string) {
        const topLayer = this.layers.find(l => l.id === topLayerId)?.instance;
        if (!topLayer) return;

        // Evento antes de renderizar: aplicar clipping
        topLayer.on('prerender', (event: any) => {
            const ctx = event.context;
            const mapSize = this.map.getSize();
            if (!mapSize) return;
            const width = mapSize[0] * (this.swipePosition / 100);
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, 0, width, mapSize[1]);
            ctx.clip();
        });

        // Evento después de renderizar: restaurar contexto
        topLayer.on('postrender', (event: any) => {
            const ctx = event.context;
            ctx.restore();
        });

        this.map.render();
    }

    private swipePosition = 50;

    /**
     * Establece la posición de la herramienta de comparación
     * @param pos Posición en porcentaje (0-100)
     */
    setSwipePosition(pos: number) {
        this.swipePosition = pos;
        this.map.render();
    }

    /**
     * Obtiene la instancia del mapa
     * @returns Instancia del mapa de OpenLayers
     */
    getMap() {
        return this.map;
    }

    /**
     * Hace zoom a la extensión de una capa específica
     * @param layer Instancia de la capa
     */
    zoomToLayer(layer: any) {
        if (!this.map || !layer) return;

        const source = layer.getSource();
        if (source && typeof source.getExtent === 'function') {
            const extent = source.getExtent();
            const isValidExtent = extent &&
                extent[0] !== Infinity &&
                extent[0] !== -Infinity &&
                !extent.includes(NaN);

            if (isValidExtent) {
                this.map.getView().fit(extent, {
                    padding: [50, 50, 50, 50],
                    duration: 1000
                });
            } else {
                console.warn('MapService: No se puede hacer zoom a una capa sin extensión válida (capa vacía).');
            }
        }
    }

    /**
     * Hace zoom a una extensión específica
     * @param extent Extensión [minX, minY, maxX, maxY]
     * @param dataProjection Proyección de los datos (por defecto EPSG:4326)
     */
    zoomToExtent(extent: number[], dataProjection: string = 'EPSG:4326') {
        if (!this.map || !extent) return;

        // Transformar extensión si es necesario
        let transformedExtent: number[];

        if (dataProjection !== 'EPSG:3857') {
            try {
                transformedExtent = transformExtent(extent, dataProjection, 'EPSG:3857');
            } catch (e) {
                console.warn('Could not transform extent increasingly, trying raw LonLat', e);
                const min = fromLonLat([extent[0], extent[1]]);
                const max = fromLonLat([extent[2], extent[3]]);
                transformedExtent = [min[0], min[1], max[0], max[1]];
            }
        } else {
            transformedExtent = extent;
        }

        this.map.getView().fit(transformedExtent, {
            padding: [50, 50, 50, 50],
            duration: 1000
        });
    }
    /**
     * Elimina una capa del mapa por su ID
     */
    removeLayer(id: string) {
        const layerIdx = this.layers.findIndex(l => l.id === id);
        if (layerIdx !== -1) {
            this.map.removeLayer(this.layers[layerIdx].instance);
            this.updateLayerList();
        }
    }

    /**
     * Hace zoom a la extensión combinada de todas las capas visibles
     */
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

    /**
     * Transforma una extensión entre dos proyecciones
     */
    transformExtent(extent: number[], source: string, target: string): number[] {
        return transformExtent(extent, source, target);
    }
}
