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
    public localModeEnabled = true; // Default to Studio
    private gridPrimitive: any = null;
    private axesPrimitive: any = null;

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
            tileset.pointCloudShading.maximumAttenuation = 8.0;
            tileset.pointCloudShading.geometricErrorScale = 1.0;
            tileset.pointCloudShading.eyeDomeLighting = true; // Muy importante para nubes de puntos sin normales

            // Estilo por defecto tipo Google Earth
            tileset.style = new Cesium.Cesium3DTileStyle({
                pointSize: 5.0
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

        let rectangle: Cesium.Rectangle | undefined;

        // Validar que los bounds sean un array de 4 números válidos
        if (bounds && Array.isArray(bounds) && bounds.length === 4 && bounds.every(v => typeof v === 'number' && !isNaN(v))) {
            try {
                rectangle = Cesium.Rectangle.fromDegrees(bounds[0], bounds[1], bounds[2], bounds[3]);
            } catch (e) {
                console.warn('Error creando rectángulo de Cesium:', e);
            }
        }

        const provider = new Cesium.UrlTemplateImageryProvider({
            url: url,
            rectangle: rectangle
        });

        const layer = this.viewer.imageryLayers.addImageryProvider(provider);
        (layer as any)._name = name;
        (layer as any)._id = id;

        if (rectangle) {
            this.viewer.camera.flyTo({
                destination: rectangle
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

    /**
     * Alterna entre modo Global (Globo terraqueo) y Local (Estudio 3D)
     */
    toggleLocalMode(enabled: boolean) {
        if (!this.viewer) return;
        this.localModeEnabled = enabled;

        const scene = this.viewer.scene;

        if (enabled) {
            // Ocultar globo y atmósfera
            scene.globe.show = false;
            if (scene.skyAtmosphere) scene.skyAtmosphere.show = false;
            if (scene.sun) scene.sun.show = false;
            if (scene.moon) scene.moon.show = false;

            // Fondo gris oscuro tipo editor 3D
            scene.backgroundColor = Cesium.Color.fromCssColorString('#020617');

            // Buscar una posición razonable si hay algo cargado
            let origin = Cesium.Cartesian3.fromDegrees(-74.006, 4.711, 0);
            const primitives = this.viewer.scene.primitives;
            for (let i = 0; i < primitives.length; i++) {
                const p = primitives.get(i);
                if (p.boundingSphere) {
                    origin = p.boundingSphere.center;
                    break;
                }
            }

            // Agregar Grilla
            this.addGrid(origin);
            // Agregar Ejes
            this.addAxes(origin);

            // Configurar cámara para vista local
            this.viewer.camera.flyToBoundingSphere(new Cesium.BoundingSphere(origin, 300), {
                offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-45), 800)
            });
        } else {
            // Restaurar Globo
            scene.globe.show = true;
            if (scene.skyAtmosphere) scene.skyAtmosphere.show = true;
            if (scene.sun) scene.sun.show = true;
            if (scene.moon) scene.moon.show = true;
            scene.backgroundColor = Cesium.Color.BLACK;

            // Quitar Grilla y Ejes
            this.removeGrid();
            this.removeAxes();
        }
    }

    private addGrid(origin: Cesium.Cartesian3) {
        if (!this.viewer || this.gridPrimitive) return;

        const size = 2000;
        const step = 100;

        // 1. Plano de suelo circular sutil
        const floorPrimitive = new Cesium.Primitive({
            geometryInstances: new Cesium.GeometryInstance({
                geometry: new Cesium.CircleGeometry({
                    center: origin,
                    radius: size,
                    vertexFormat: Cesium.EllipsoidSurfaceAppearance.VERTEX_FORMAT
                })
            }),
            appearance: new Cesium.EllipsoidSurfaceAppearance({
                material: Cesium.Material.fromType('Color', {
                    color: Cesium.Color.fromCssColorString('#0f172a').withAlpha(0.5)
                }),
                flat: true
            })
        });

        // 2. Polilíneas para la grilla local
        const gridCollection = new Cesium.PolylineCollection();
        for (let i = -size; i <= size; i += step) {
            gridCollection.add({
                positions: [
                    this.localToGlobal(origin, new Cesium.Cartesian3(i, -size, 0)),
                    this.localToGlobal(origin, new Cesium.Cartesian3(i, size, 0))
                ],
                color: Cesium.Color.fromCssColorString('#475569').withAlpha(0.2),
                width: 1
            });
            gridCollection.add({
                positions: [
                    this.localToGlobal(origin, new Cesium.Cartesian3(-size, i, 0)),
                    this.localToGlobal(origin, new Cesium.Cartesian3(size, i, 0))
                ],
                color: Cesium.Color.fromCssColorString('#475569').withAlpha(0.2),
                width: 1
            });
        }

        this.gridPrimitive = [
            this.viewer.scene.primitives.add(floorPrimitive),
            this.viewer.scene.primitives.add(gridCollection)
        ];
    }

    private localToGlobal(origin: Cesium.Cartesian3, local: Cesium.Cartesian3): Cesium.Cartesian3 {
        const matrix = Cesium.Transforms.eastNorthUpToFixedFrame(origin);
        return Cesium.Matrix4.multiplyByPoint(matrix, local, new Cesium.Cartesian3());
    }

    private removeGrid() {
        if (this.gridPrimitive) {
            if (Array.isArray(this.gridPrimitive)) {
                this.gridPrimitive.forEach(p => this.viewer.scene.primitives.remove(p));
            } else {
                this.viewer.scene.primitives.remove(this.gridPrimitive);
            }
            this.gridPrimitive = null;
        }
    }

    private addAxes(origin: Cesium.Cartesian3) {
        if (!this.viewer || this.axesPrimitive) return;
        const modelMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(origin);
        this.axesPrimitive = this.viewer.scene.primitives.add(new (Cesium as any).DebugModelMatrixPrimitive({
            modelMatrix: modelMatrix,
            length: 150.0,
            width: 3.0
        }));
    }

    private removeAxes() {
        if (this.axesPrimitive) {
            this.viewer.scene.primitives.remove(this.axesPrimitive);
            this.axesPrimitive = null;
        }
    }
}
