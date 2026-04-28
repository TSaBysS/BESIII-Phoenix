import { Scene, Object3D } from 'three';
/**
 * Manager for managing event display's export related functionality.
 */
export declare class ExportManager {
    /**
     * Exports scene to OBJ file format.
     * @param scene The scene to be exported.
     */
    exportSceneToOBJ(scene: Scene): void;
    /**
     * Exports scene as phoenix format, allowing to load it later and recover the saved configuration.
     * @param scene The scene to be exported.
     * @param eventData Currently loaded event data.
     * @param geometries Currently loaded geometries.
     */
    exportPhoenixScene(scene: Scene, eventData: Object3D, geometries: Object3D): void;
    /**
     * Save the configuration of the currently loaded scene including event data and geometries.
     * @param eventData Curently loaded event data.
     * @param geometries Currently loaded geometries.
     */
    private saveSceneConfig;
    /**
     * Save the configuration of the currently loaded event data.
     * @param eventData Currently loaded event data.
     */
    private saveEventDataConfiguration;
    /**
     * Save the configuration of the currently loaded geometries.
     * @param geometries Currently loaded geometries.
     */
    private saveGeometriesConfiguration;
}
