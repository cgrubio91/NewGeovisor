import { Injectable } from '@angular/core';
import * as Cesium from 'cesium';
import { Subject } from 'rxjs';

/**
 * Servicio para gestionar la visualización 3D con CesiumJS
 */
@Injectable({
    providedIn: 'root'
})
export class Map3dService {
    private viewer!: Cesium.Viewer;
    public isInitialized = new Subject<boolean>();

    constructor() {
        // Configurar base path para assets de Cesium
        (window as any).CESIUM_BASE_URL = '/assets/cesium/';
    }

    /**
     * Inicializa el visor de Cesium
     * @param containerId ID del elemento HTML
     */
    initViewer(containerId: string) {
        this.viewer = new Cesium.Viewer(containerId, {
            animation: false,
            timeline: false,
            baseLayerPicker: true,
            fullscreenButton: false,
            geocoder: false,
            homeButton: true,
            infoBox: true,
            sceneModePicker: true,
            selectionIndicator: true,
            navigationHelpButton: false,
            navigationInstructionsInitiallyVisible: false,
        });

        // Set terrain provider asynchronously to match types
        Cesium.createWorldTerrainAsync().then(tp => {
            if (this.viewer && !this.viewer.isDestroyed()) {
                (this.viewer as any).terrainProvider = tp;
            }
        });

        this.isInitialized.next(true);
        return this.viewer;
    }


    /**
     * Agrega un modelo 3D (OBJ/GLTF) al mapa
     * @param url URL del archivo
     * @param position Coordenadas [lon, lat, height]
     */
    async addModel(url: string, position: [number, number, number]) {
        if (!this.viewer) return;

        const cartesianPosition = Cesium.Cartesian3.fromDegrees(position[0], position[1], position[2]);
        const heading = Cesium.Math.toRadians(0);
        const pitch = 0;
        const roll = 0;
        const hpr = new Cesium.HeadingPitchRoll(heading, pitch, roll);
        const orientation = Cesium.Transforms.headingPitchRollQuaternion(cartesianPosition, hpr);

        const entity = this.viewer.entities.add({
            name: url.split('/').pop(),
            position: cartesianPosition,
            orientation: orientation,
            model: {
                uri: url,
                minimumPixelSize: 128,
                maximumScale: 20000,
            },
        });

        this.viewer.zoomTo(entity);
    }

    /**
     * Agrega un Tileset 3D (Malla de realidad o Nube de puntos)
     * @param url URL del archivo tileset.json
     */
    async add3DTileset(url: string) {
        if (!this.viewer) return;

        try {
            const tileset = await Cesium.Cesium3DTileset.fromUrl(url, {
                maximumScreenSpaceError: 2,
                backFaceCulling: false
            });

            this.viewer.scene.primitives.add(tileset);

            // Si es una nube de puntos, aplicar estilo para mejorar visibilidad
            tileset.pointCloudShading.attenuation = true;
            tileset.pointCloudShading.maximumAttenuation = 5.0;
            tileset.pointCloudShading.geometricErrorScale = 1.0;

            // Estilo por defecto tipo Google Earth
            tileset.style = new Cesium.Cesium3DTileStyle({
                pointSize: 4.0
            });

            this.viewer.zoomTo(tileset);
            return tileset;
        } catch (error) {
            console.error('Error cargando 3D Tileset:', error);
            return null;
        }
    }

    /**
     * Agrega una capa raster (Tile) al globo 3D
     */
    async addRasterLayer(name: string, url: string, bounds?: number[]) {
        if (!this.viewer) return;

        const provider = new Cesium.UrlTemplateImageryProvider({
            url: url,
            rectangle: bounds ? Cesium.Rectangle.fromDegrees(bounds[0], bounds[1], bounds[2], bounds[3]) : undefined
        });

        const layer = this.viewer.imageryLayers.addImageryProvider(provider);
        (layer as any)._name = name; // Guardar nombre para identificar

        if (bounds) {
            this.viewer.camera.flyTo({
                destination: Cesium.Rectangle.fromDegrees(bounds[0], bounds[1], bounds[2], bounds[3])
            });
        }
        return layer;
    }

    /**
     * Limpia capas y entidades no base del visor 3D
     */
    clearLayers() {
        if (!this.viewer) return;

        // Limpiar entidades (modelos 3D, etc)
        this.viewer.entities.removeAll();

        // Limpiar primitivas (Tilesets 3D)
        this.viewer.scene.primitives.removeAll();

        // Limpiar capas de imágenes adicionales (excepto la base)
        const layers = this.viewer.imageryLayers;
        while (layers.length > 1) {
            layers.remove(layers.get(1));
        }
    }

    getViewer() {
        return this.viewer;
    }
}
