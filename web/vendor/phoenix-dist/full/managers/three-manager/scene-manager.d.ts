import { Scene, Object3D, Color, Mesh, Vector3, Group, DirectionalLight, Camera } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Cut } from '../../lib/models/cut.model';
/**
 * Manager for managing functions of the three.js scene.
 */
export declare class SceneManager {
    /** Object group ID containing event data. */
    static EVENT_DATA_ID: string;
    /** Object group ID containing detector geometries. */
    static GEOMETRIES_ID: string;
    /** Object group ID containing label texts. */
    static LABELS_ID: string;
    /** Three.js scene containing all the objects and event data. */
    private scene;
    /** List of objects to ignore for getting a clean scene. */
    private ignoreList;
    /** An axes helper for visualizing the x, y and z-axis. */
    private axis;
    /** Labels for the x, y and z-axis. */
    private axisLabels;
    /** Eta/phi grid */
    private etaPhiGrid;
    /** Cartesian grid */
    private cartesianGrid;
    /** Cartesian Grid Config */
    private cartesianGridConfig;
    /** Cartesian grid labels */
    private cartesianLabels;
    /** Whether to use directional light placed at the camera position. */
    private useCameraLight;
    /** Directional light following the camera position. */
    cameraLight: DirectionalLight;
    /** Font for text geometry. */
    private textFont;
    /** An object containing look at camera change callbacks for labels. */
    private labelTextLookCallbacks;
    /** Numbers on the X, Y and Z axes */
    private axesNumbers;
    /**
     * Create the scene manager.
     * @param ignoreList List of objects to ignore for getting a clean scene.
     * @param useCameraLight Whether to use directional light placed at the camera position.
     */
    constructor(ignoreList: string[], useCameraLight?: boolean);
    /**
     * Initializes the lights in the scene.
     * @param useCameraLight Whether to use directional light placed at the camera position.
     */
    private setLights;
    /**
     * Update position of directional light for each frame rendered.
     * @param camera Camera for setting the position of directional light.
     */
    updateLights(camera: Camera): void;
    /**
     * Get the current scene and create new if it doesn't exist.
     * @returns The scene.
     */
    getScene(): Scene;
    /**
     * Get a clean copy of the scene.
     * @returns A clear scene with no objects from the ignoreList.
     */
    getCleanScene(): Scene;
    /**
     * Modifies an object's opacity.
     * @param object Object whose opacity needs to be changed.
     * @param value Value of opacity, between 0 (transparent) and 1 (opaque).
     */
    setGeometryOpacity(object: Mesh, value: number): void;
    /**
     * Changes color of an OBJ geometry.
     * @param object Object to change the color of.
     * @param value Value representing the color in hex format.
     */
    changeObjectColor(object: Object3D, value: any): void;
    /**
     * Changes objects visibility.
     * @param object Object to change the visibility of.
     * @param visible If the object will be visible (true) or hidden (false).
     */
    objectVisibility(object: Object3D, visible: boolean): void;
    /**
     * Gets an object's position.
     * @param name Name of the object.
     * @returns Object position.
     */
    getObjectPosition(name: string): Vector3 | undefined;
    /**
     * Removes a geometry from the scene.
     * @param object Geometry object to be removed.
     */
    removeGeometry(object: Object3D): void;
    /**
     * Remove label from the scene.
     * @param name Name of the label to remove.
     */
    removeLabel(name: string): void;
    /**
     * Scales an object.
     * @param object Object to scale.
     * @param value Value to scale the object by.
     */
    scaleObject(object: Object3D, value: any): void;
    /**
     * Adds new type of objects (Jets, Tracks...) to the event data group.
     * @param objectType Name of the object type.
     * @returns The new group added to the event data.
     */
    addEventDataTypeGroup(objectType: string): Group;
    /**
     * Applies a cut to all objects inside a collection, filtering them given a parameter.
     * @param collectionName Name of the collection.
     * @param filters Cuts used to filter the objects in the collection.
     */
    collectionFilter(collectionName: string, filters: Cut[]): void;
    /**
     * Changes the visibility of all elements in a group.
     * @param name Name of the group.
     * @param visible If the group will be visible (true) or hidden (false).
     * @param parentName Name of the parent object to look inside for object
     * whose visibility is to be toggled.
     */
    groupVisibility(name: string, visible: boolean, parentName?: string): void;
    /**
     * Gets a group of objects from the scene.
     * @param identifier String that identifies the group's name.
     * @returns The object.
     */
    getObjectsGroup(identifier: string): Object3D;
    /**
     * Get event data inside the scene.
     * @returns A group of objects with event data.
     */
    getEventData(): Object3D;
    /**
     * Get geometries inside the scene.
     * @returns A group of objects with geometries.
     */
    getGeometries(): Object3D;
    /**
     * Clears event data of the scene.
     */
    clearEventData(): void;
    /** Returns a mesh representing the passed text. It will use this.textFont. */
    getText(text: string, colour: Color): Mesh;
    /**
     * Sets scene axis visibility.
     * @param visible If the axes will be visible (true) osr hidden (false).
     * @param scale Set the scale of the axes.
     * @param labels If true (default), show labels on the end of the axes.
     */
    setAxis(visible: boolean, scale?: number, labels?: boolean): void;
    /**
     * Creates the cartesian grid if doesn't exist already
     * @param scale the maximum scale (dimensions: height, width, length) of the grid
     */
    private createCartesianGrid;
    /**
     * Sets scene cartesian grid visibility.
     * @param visible If the grid will be visible.
     * @param showXY If the XY planes are to be shown.
     * @param showYZ If the YZ planes are to be shown.
     * @param showZX If the ZX planes are to be shown.
     * @param xDistance The distance in x direction upto which YZ planes will be shown.
     * @param yDistance The distance in y direction upto which ZX planes will be shown.
     * @param zDistance The distance in z direction upto which XY planes will be shown.
     * @param sparsity Sparsity of the gridlines.
     * @param scale Set the scale of the grid.
     */
    setCartesianGrid(visible: boolean, scale: number, config?: {
        showXY: boolean;
        showYZ: boolean;
        showZX: boolean;
        xDistance: number;
        yDistance: number;
        zDistance: number;
        sparsity: number;
    }): void;
    /**
     * Returns the cartesian grid configuration
     */
    getCartesianGridConfig(): {
        showXY: boolean;
        showYZ: boolean;
        showZX: boolean;
        xDistance: number;
        yDistance: number;
        zDistance: number;
        sparsity: number;
    };
    /**
     * Toggle depthTest of event data by updating all children's depthTest and renderOrder.
     * @param value If depthTest will be true or false.
     */
    eventDataDepthTest(value: boolean): void;
    /**
     * Wireframe geometries and decrease their opacity.
     * @param value A boolean to specify if geometries are to be wireframed or not.
     */
    wireframeGeometries(value: boolean): void;
    /**
     * Wireframe a group of objects.
     * @param objectsGroup Group of the objects to be wireframed.
     * @param value A boolean to specify if objects are to be wireframed or not.
     */
    wireframeObjects(objectsGroup: Object3D, value: boolean): void;
    /**
     * Change the scale of Jets.
     * @param value Factor by which the Jets are to be scaled.
     */
    scaleJets(value: number): void;
    /**
     * Scale lowest level objects in a group.
     * @param groupName Name of the group to scale objects of.
     * @param value Value of the scale. Default is 1.
     * @param axis If passed, the local axis to scale.
     */
    scaleChildObjects(groupName: string, value: number, axis?: string): void;
    /**
     * Add label to the three.js object.
     * @param label Label to add to the event object.
     * @param uuid UUID of the three.js object.
     * @param labelId Unique ID of the label.
     * @param objectPosition Position of the object to place the label.
     * @param cameraControls Camera controls for making the text face the camera.
     */
    addLabelToObject(label: string, uuid: string, labelId: string, objectPosition: Vector3, cameraControls: OrbitControls): void;
    /**
     * Translate the cartesianGrid
     */
    translateCartesianGrid(translate: Vector3): void;
    /**
     * Translate Cartesian labels
     */
    translateCartesianLabels(translate: Vector3): void;
    /**
     * Adds numbers (coordinates) to the axes.
     * @param scale The maximum length upto which labels are to be shown
     */
    private createCartesianLabels;
    /**
     * Aligns the axes numbers always towards the main camera
     */
    alignText(camera: Camera): void;
    /**
     * Show labels of the cartesian grid.
     */
    showLabels(visible: boolean): void;
    /**
     * Sets scene eta/phi grid visibility.
     * @param visible If the axes will be visible (true) osr hidden (false).
     * @param scale Set the scale of the axes.
     */
    setEtaPhiGrid(visible: boolean, scale?: number): void;
    /**
     * Get an object by its name.
     * @param name Name of the object.
     * @returns The object.
     */
    getObjectByName(name: string): Object3D;
}
