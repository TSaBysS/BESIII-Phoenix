import { SceneManager } from './scene-manager';
/**
 * Color manager for three.js functions related to coloring of objects.
 */
export declare class ColorManager {
    private sceneManager;
    /**
     * Create the coloring manager.
     * @param sceneManager The scene manager responsible for managing the three.js scene.
     */
    constructor(sceneManager: SceneManager);
    /**
     * Color objects by a property's value or range.
     * @param color Color to set for the object.
     * @param objectsGroup Name of the object(s) group to color.
     * @param customCheck Function to custom check values against object params.
     */
    colorObjectsByProperty(color: any, objectsGroup: string, customCheck: (objectUserData: any) => boolean): void;
    /**
     * Changes the color of all objects inside an event data collection.
     * @param collectionName Name of the collection.
     * @param color Hex value representing the color.
     */
    collectionColor(collectionName: string, color: any): void;
    /**
     * Changes the color of all objects inside an event data collection to some random color.
     * @param collectionName Name of the collection.
     */
    collectionColorRandom(collectionName: string): void;
    /**
     * Randomly color tracks by the vertex they are associated with.
     * @param collectionName Name of the collection.
     */
    colorTracksByVertex(collectionName: string): void;
}
