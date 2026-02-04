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
     * @param id ID de la capa
     */
    async add3DTileset(url: string, id?: number) {
        if (!this.viewer) return;

        try {
            const tileset = await Cesium.Cesium3DTileset.fromUrl(url, {
                maximumScreenSpaceError: 2,
                backFaceCulling: false
            });

            this.viewer.scene.primitives.add(tileset);
            (tileset as any)._id = id; // Guardar ID
            (tileset as any)._type = 'tileset';

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
    async addRasterLayer(name: string, url: string, bounds?: number[], id?: number) {
        if (!this.viewer) return;

        const provider = new Cesium.UrlTemplateImageryProvider({
            url: url,
            rectangle: bounds ? Cesium.Rectangle.fromDegrees(bounds[0], bounds[1], bounds[2], bounds[3]) : undefined
        });

        const layer = this.viewer.imageryLayers.addImageryProvider(provider);
        (layer as any)._name = name; // Guardar nombre para identificar
        (layer as any)._id = id;     // Guardar ID

        if (bounds) {
            this.viewer.camera.flyTo({
                destination: Cesium.Rectangle.fromDegrees(bounds[0], bounds[1], bounds[2], bounds[3])
            });
        }
        return layer;
    }

    /**
     * Agrega una capa KML/KMZ al visor 3D
     */
    async addKmlLayer(name: string, url: string, id?: number) {
        if (!this.viewer) return;

        try {
            const dataSource = await Cesium.KmlDataSource.load(url, {
                camera: this.viewer.camera,
                canvas: this.viewer.canvas,
                clampToGround: true // Importante para que se draftee sobre el terreno
            });

            await this.viewer.dataSources.add(dataSource);
            (dataSource as any)._name = name;
            (dataSource as any)._id = id;

            this.viewer.zoomTo(dataSource);
            return dataSource;
        } catch (error) {
            console.error(`Error cargando KML ${name}:`, error);
            return null;
        }
    }

    /**
     * Establece la visibilidad de una capa en 3D
     */
    setLayerVisibility(layerId: string | number, visible: boolean) {
        if (!this.viewer) return;

        // 1. Buscar en imageryLayers (raster)
        const layers = this.viewer.imageryLayers;
        for (let i = 0; i < layers.length; i++) {
            const layer = layers.get(i);
            if ((layer as any)._id == layerId) {
                layer.show = visible;
            }
        }

        // 2. Buscar en primitives (3D Tilesets)
        const primitives = this.viewer.scene.primitives;
        for (let i = 0; i < primitives.length; i++) {
            const primitive = primitives.get(i);
            if ((primitive as any)._id == layerId) {
                primitive.show = visible;
            }
        }

        // 3. Buscar en dataSources (KML/GeoJSON)
        this.viewer.dataSources.getByName(String(layerId)).forEach(ds => ds.show = visible);
        // También por _id si lo guardamos
        for (let i = 0; i < this.viewer.dataSources.length; i++) {
            const ds = this.viewer.dataSources.get(i);
            if ((ds as any)._id == layerId) {
                ds.show = visible;
            }
        }
    }

    /**
     * Establece la opacidad de una capa en 3D
     */
    setLayerOpacity(layerId: string | number, opacity: number) {
        if (!this.viewer) return;
        const layers = this.viewer.imageryLayers;
        for (let i = 0; i < layers.length; i++) {
            const layer = layers.get(i);
            if ((layer as any)._id == layerId) {
                layer.alpha = opacity;
            }
        }
    }

    /**
     * Limpia capas y entidades no base del visor 3D
     */
    clearLayers() {
        if (!this.viewer) return;

        // Limpiar entidades (modelos 3D, etc)
        this.viewer.entities.removeAll();

        // Limpiar fuentes de datos (KML, GeoJSON, etc)
        this.viewer.dataSources.removeAll();

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

    /**
     * Activa el modo Swipe para una capa específica
     */
    enableSwipe(layerId: string | number, side: 'left' | 'right' = 'left') {
        if (!this.viewer) return;

        const splitDir = side === 'left' ? Cesium.SplitDirection.LEFT : Cesium.SplitDirection.RIGHT;

        // 1. Imagery Layers
        const layers = this.viewer.imageryLayers;
        for (let i = 0; i < layers.length; i++) {
            const layer = layers.get(i);
            if ((layer as any)._id == layerId) {
                layer.splitDirection = splitDir;
            }
        }

        // 2. 3D Tilesets (Necesitan clipping planes para un swipe real, o splitDirection si es soportado)
        // Nota: Cesium 1.107+ soporta splitDirection en Tilesets pero requiere backFaceCulling: false
        const primitives = this.viewer.scene.primitives;
        for (let i = 0; i < primitives.length; i++) {
            const primitive = primitives.get(i);
            if ((primitive as any)._id == layerId && primitive instanceof Cesium.Cesium3DTileset) {
                (primitive as any).splitDirection = splitDir;
            }
        }
    }

    /**
     * Desactiva el modo Swipe para una capa
     */
    disableSwipe(layerId: string | number) {
        if (!this.viewer) return;

        // 1. Imagery Layers
        const layers = this.viewer.imageryLayers;
        for (let i = 0; i < layers.length; i++) {
            const layer = layers.get(i);
            if ((layer as any)._id == layerId) {
                layer.splitDirection = Cesium.SplitDirection.NONE;
            }
        }

        // 2. 3D Tilesets
        const primitives = this.viewer.scene.primitives;
        for (let i = 0; i < primitives.length; i++) {
            const primitive = primitives.get(i);
            if ((primitive as any)._id == layerId && (primitive as any).splitDirection) {
                (primitive as any).splitDirection = Cesium.SplitDirection.NONE;
            }
        }
    }

    /**
     * Trae una capa al frente en 3D (útil para comparación/opacidad)
     */
    bringToFront(layerId: string | number) {
        if (!this.viewer) return;
        const layers = this.viewer.imageryLayers;
        for (let i = 0; i < layers.length; i++) {
            const layer = layers.get(i);
            if ((layer as any)._id == layerId) {
                layers.raiseToTop(layer);
                break;
            }
        }
    }

    /**
     * Desactiva swipe en todas las capas 3D
     */
    disableAllSwipe() {
        if (!this.viewer) return;

        // Desactivar en Imagery Layers
        const layers = this.viewer.imageryLayers;
        for (let i = 0; i < layers.length; i++) {
            layers.get(i).splitDirection = Cesium.SplitDirection.NONE;
        }

        // Desactivar en Primitives
        const primitives = this.viewer.scene.primitives;
        for (let i = 0; i < primitives.length; i++) {
            if ((primitives.get(i) as any).splitDirection !== undefined) {
                (primitives.get(i) as any).splitDirection = Cesium.SplitDirection.NONE;
            }
        }
    }

    /**
     * Ajusta la posición del swipe
     * @param percent Porcentaje (0-100)
     */
    setSwipePosition(percent: number) {
        if (!this.viewer) return;
        this.viewer.scene.splitPosition = percent / 100;
    }
}
