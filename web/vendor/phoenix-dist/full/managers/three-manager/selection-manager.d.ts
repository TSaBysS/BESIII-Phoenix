import { Camera, Scene, Object3D } from 'three';
import { InfoLogger } from '../../helpers/info-logger';
import { EffectsManager } from './effects-manager';
import { ActiveVariable } from '../../helpers/active-variable';
/**
 * Manager for managing event display's selection related functions.
 */
export declare class SelectionManager {
    /** Is initialized. */
    private isInit;
    /** The camera inside the scene. */
    private camera;
    /** The scene used for event display. */
    private scene;
    /** Object used to display the information of the selected 3D object. */
    private selectedObject;
    /** The currently selected object which is observable for changes. */
    private activeObject;
    /** Objects to be ignored on hovering over the scene. */
    private ignoreList;
    /** Outline pass for highlighting the hovered over event display elements. */
    private outlinePass;
    /** Manager for managing three.js event display effects like outline pass and unreal bloom. */
    private effectsManager;
    /** Service for logging data to the information panel. */
    private infoLogger;
    /** Performance mode value before enabling selection. */
    private preSelectionAntialias;
    /**
     * Constructor for the selection manager.
     */
    constructor();
    /**
     * Initialize the selection manager.
     * @param camera The camera inside the scene.
     * @param scene The scene used for event display.
     * @param effectsManager Manager for managing three.js event display effects
     * like outline pass and unreal bloom.
     * @param infoLogger Service for logging data to the information panel.
     */
    init(camera: Camera, scene: Scene, effectsManager: EffectsManager, infoLogger: InfoLogger): void;
    /**
     * Set the currently selected object.
     * @param selectedObject The currently selected object.
     */
    setSelectedObject(selectedObject: {
        name: string;
        attributes: any[];
    }): void;
    /**
     * Get the uuid of the currently selected object.
     * @returns uuid of the currently selected object.
     */
    getActiveObjectId(): ActiveVariable<string>;
    /**
     * Set if selecting is to be enabled or disabled.
     * @param enable If selecting is to be enabled or disabled.
     */
    setSelecting(enable: boolean): void;
    /**
     * Enable selecting of event display elements and set mouse move and click events.
     */
    private enableSelecting;
    /**
     * Disable selecting of event display elements and remove mouse move and click events.
     */
    private disableSelecting;
    /**
     * Function to call on mouse move when object selection is enabled.
     */
    private onTouchMove;
    /**
     * Function to call on mouse click when object selection is enabled.
     */
    private onDocumentMouseDown;
    /**
     * Function to call on touch when object selection is enabled.
     * @param event Event containing touch data.
     */
    private onTouchDown;
    /**
     * Check if any object intersects on mouse move.
     * @param event Event containing data of the mouse move.
     * @returns Intersected or hovered over object.
     */
    private intersectObject;
    /**
     * Enable highlighting of the objects.
     */
    enableHighlighting(): void;
    /**
     * Highlight the object with the given uuid by giving it an outline.
     * @param uuid uuid of the object.
     * @param objectsGroup Group of objects to be traversed for finding the object
     * with the given uuid.
     */
    highlightObject(uuid: string, objectsGroup: Object3D): void;
    /**
     * Disable highlighting of objects.
     */
    disableHighlighting(): void;
}
