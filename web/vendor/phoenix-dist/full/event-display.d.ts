import { ThreeManager } from './managers/three-manager/index';
import { UIManager } from './managers/ui-manager/index';
import { InfoLogger } from './helpers/info-logger';
import type { Configuration } from './lib/types/configuration';
import { StateManager } from './managers/state-manager';
import { LoadingManager } from './managers/loading-manager';
import { URLOptionsManager } from './managers/url-options-manager';
import { ActiveVariable } from './helpers/active-variable';
import type { AnimationPreset } from './managers/three-manager/animations-manager';
import { XRSessionType } from './managers/three-manager/xr/xr-manager';
declare global {
    /**
     * Window interface for adding objects to the window object.
     */
    interface Window {
        /** EventDisplay object containing event display related functions. */
        EventDisplay: any;
    }
}
/**
 * Phoenix event display class for managing detector geometries and event data.
 */
export declare class EventDisplay {
    /** Configuration for preset views and event data loader. */
    configuration: Configuration;
    /** An object containing event data. */
    private eventsData;
    /** Array containing callbacks to be called when events change. */
    private onEventsChange;
    /** Array containing callbacks to be called when the displayed event changes. */
    private onDisplayedEventChange;
    /** Three manager for three.js operations. */
    private graphicsLibrary;
    /** Info logger for storing event display logs. */
    private infoLogger;
    /** UI manager for UI menu. */
    private ui;
    /** Loading manager for loadable resources */
    private loadingManager;
    /** State manager for managing event display state. */
    private stateManager;
    /** URL manager for managing options given through URL. */
    private urlOptionsManager;
    /**
     * Create the Phoenix event display and intitialize all the elements.
     * @param configuration Configuration used to customize different aspects.
     */
    constructor(configuration?: Configuration);
    /**
     * Initialize all the Phoenix event display elements.
     * @param configuration Configuration used to customize different aspects.
     */
    init(configuration: Configuration): void;
    /**
     * Initialize XR.
     * @param xrSessionType Type of the XR session. Either AR or VR.
     * @param onSessionEnded Callback when the XR session ends.
     */
    initXR(xrSessionType: XRSessionType, onSessionEnded?: () => void): void;
    /**
     * End VR and remove VR settings.
     * @param xrSessionType Type of the XR session. Either AR or VR.
     */
    endXR(xrSessionType: XRSessionType): void;
    /**
     * Receives an object containing all the eventKeys and saves it.
     * Then it loads by default the first event.
     * @param eventsData Object containing the event data.
     * @returns Array of strings containing the keys of the eventsData object.
     */
    parsePhoenixEvents(eventsData: any): string[];
    /**
     * Receives an object containing one event and builds the different collections
     * of physics objects.
     * @param eventData Object containing the event data.
     */
    buildEventDataFromJSON(eventData: any): void;
    /**
     * Receives a string representing the key of an event and loads
     * the event associated with that key.
     * @param eventKey String that represents the event in the eventsData object.
     */
    loadEvent(eventKey: any): void;
    /**
     * Get the three manager responsible for three.js functions.
     * @returns The three.js manager.
     */
    getThreeManager(): ThreeManager;
    /**
     * Get the UI manager responsible for UI related functions.
     * @returns The UI manager.
     */
    getUIManager(): UIManager;
    /**
     * Get the info logger containing event display logs.
     * @returns The info logger instance being used by the event display.
     */
    getInfoLogger(): InfoLogger;
    /**
     * Get the loading manager for managing loadable items.
     * @returns The loading manager.
     */
    getLoadingManager(): LoadingManager;
    /**
     * Get the state manager that manages event display's state.
     * @returns The state manager.
     */
    getStateManager(): StateManager;
    /**
     * Get the URL options manager that manages options given through URL.
     * @returns The URL options manager.
     */
    getURLOptionsManager(): URLOptionsManager;
    /**
     * Loads an OBJ (.obj) geometry from the given filename
     * and adds it to the dat.GUI menu.
     * @param filename Path to the geometry.
     * @param name Name given to the geometry.
     * @param color Color to initialize the geometry.
     * @param menuNodeName Name of the node in Phoenix menu to add the geometry to. Use >  as a separator for specifying the hierarchy for sub-folders.
     * @param doubleSided If true, render both sides of the material.
     * @param initiallyVisible Whether the geometry is initially visible or not. Default `true`.
     * @param setFlat Whether object should be flat-shaded or not. Default `true`.
     * @returns Promise for loading the geometry.
     */
    loadOBJGeometry(filename: string, name: string, color: any, menuNodeName: string, doubleSided: boolean, initiallyVisible?: boolean, setFlat?: boolean): Promise<void>;
    /**
     * Parses and loads an OBJ geometry from the given content
     * and adds it to the dat.GUI menu.
     * @param content Content of the OBJ geometry.
     * @param name Name given to the geometry.
     * @param menuNodeName Name of the node in Phoenix menu to add the geometry to. Use >  as a separator for specifying the hierarchy for sub-folders.
     * @param initiallyVisible Whether the geometry is initially visible or not. Default `true`.
     */
    parseOBJGeometry(content: string, name: string, menuNodeName?: string, initiallyVisible?: boolean): void;
    /**
     * Exports scene to OBJ file format.
     */
    exportToOBJ(): void;
    /**
     * Parse and load an event from the Phoenix file format (.phnx).
     * @param input Content containing the JSON with event data
     * and other configuration.
     * @returns Promise for loading the geometry.
     */
    parsePhoenixDisplay(input: any): Promise<void>;
    /**
     * Exports scene as phoenix format, allowing to load it later and recover the saved configuration.
     */
    exportPhoenixDisplay(): void;
    /**
     * Parses and loads a geometry in GLTF (.gltf or .glb) format.
     * also supports zip files of the above
     * @param file Geometry file in GLTF (.gltf or .glb) format.
     * @returns Promise for loading the geometry.
     */
    parseGLTFGeometry(file: File): Promise<void>;
    /**
     * Loads a GLTF (.gltf) scene/geometry from the given URL.
     * and adds it to the dat.GUI menu.
     * @param url URL to the GLTF (.gltf) file.
     * @param name Name of the loaded scene/geometry.
     * @param menuNodeName Name of the node in Phoenix menu to add the geometry to. Use >  as a separator for specifying the hierarchy for sub-folders.
     * @param scale Scale of the geometry.
     * @param initiallyVisible Whether the geometry is initially visible or not. Default `true`.
     * @returns Promise for loading the geometry.
     */
    loadGLTFGeometry(url: any, name: string, menuNodeName?: string, scale?: number, initiallyVisible?: boolean): Promise<void>;
    /**
     * Loads geometries from JSON.
     * @param json JSON or URL to JSON file of the geometry.
     * @param name Name of the geometry or group of geometries.
     * @param menuNodeName Name of the node in Phoenix menu to add the geometry to. Use >  as a separator for specifying the hierarchy for sub-folders.
     * @param scale Scale of the geometry.
     * @param doubleSided Renders both sides of the material.
     * @param initiallyVisible Whether the geometry is initially visible or not. Default `true`.
     * @returns Promise for loading the geometry.
     */
    loadJSONGeometry(json: string | {
        [key: string]: any;
    }, name: string, menuNodeName?: string, scale?: number, doubleSided?: boolean, initiallyVisible?: boolean): Promise<void>;
    /**
     * Load JSON geometry from JSRoot.
     * @param url URL of the JSRoot geometry file.
     * @param name Name of the geometry.
     * @param menuNodeName Name of the node in Phoenix menu to add the geometry to. Use >  as a separator for specifying the hierarchy for sub-folders.
     * @param scale Scale of the geometry.
     * @param doubleSided Renders both sides of the material.
     * @param initiallyVisible Whether the geometry is initially visible or not. Default `true`.
     */
    loadRootJSONGeometry(url: string, name: string, menuNodeName?: string, scale?: number, doubleSided?: boolean, initiallyVisible?: boolean): Promise<void>;
    /**
     * Load ROOT geometry from JSRoot.
     * @param url URL of the JSRoot file.
     * @param objectName Name of the object inside the ".root" file.
     * @param name Name of the geometry.
     * @param menuNodeName Name of the node in Phoenix menu to add the geometry to. Use >  as a separator for specifying the hierarchy for sub-folders.
     * @param scale Scale of the geometry.
     * @param doubleSided Renders both sides of the material.
     * @param initiallyVisible Whether the geometry is initially visible or not. Default `true`.
     */
    loadRootGeometry(url: string, objectName: string, name: string, menuNodeName?: string, scale?: number, doubleSided?: boolean, initiallyVisible?: boolean): Promise<void>;
    /**
     * Build Geometry from thr passed parameters, where
     * @param parameters
     */
    buildGeometryFromParameters(parameters: any): void;
    /**
     * Zoom all the cameras by a specific zoom factor.
     * The factor may either be greater (zoom in) or smaller (zoom out) than 1.
     * @param zoomFactor The factor to zoom by.
     * @param zoomTime The time it takes for a zoom animation to complete.
     */
    zoomTo(zoomFactor: number, zoomTime: number): void;
    /**
     * Processes event data and geometry for Loading the scene
     * from Phoenix file format (.phnx).
     * @param sceneConfiguration Scene configuration containingevent data and detector geometry.
     */
    private loadSceneConfiguration;
    /**
     * Get all the objects inside a collection.
     * @param collectionName Key of the collection that will be retrieved.
     * @returns Object containing all physics objects from the desired collection.
     */
    getCollection(collectionName: string): any;
    /**
     * Get the different collections for the current stored event.
     * @returns List of strings, each representing a collection of the event displayed.
     */
    getCollections(): string[];
    /**
     * Add a callback to onDisplayedEventChange array to call
     * the callback on changes to the displayed event.
     * @param callback Callback to be added to the onDisplayedEventChange array.
     */
    listenToDisplayedEventChange(callback: (event: any) => any): void;
    /**
     * Add a callback to onEventsChange array to call
     * the callback on changes to the events.
     * @param callback Callback to be added to the onEventsChange array.
     */
    listenToLoadedEventsChange(callback: (events: any) => any): void;
    /**
     * Get metadata associated to the displayed event (experiment info, time, run, event...).
     * @returns Metadata of the displayed event.
     */
    getEventMetadata(): any[];
    /**
     * Enables calling specified event display methods in console.
     */
    private enableEventDisplayConsole;
    /**
     * Sets the renderer to be used to render the event display on the overlayed canvas.
     * @param overlayCanvas An HTML canvas on which the overlay renderer is to be set.
     */
    setOverlayRenderer(overlayCanvas: HTMLCanvasElement): void;
    /**
     * Initializes the object which will show information of the selected geometry/event data.
     * @param selectedObject Object to display the data.
     */
    allowSelection(selectedObject: {
        name: string;
        attributes: any[];
    }): void;
    /**
     * Toggles the ability of selecting geometries/event data by clicking on the screen.
     * @param enable Value to enable or disable the functionality.
     */
    enableSelecting(enable: boolean): void;
    /**
     * Fixes the camera position of the overlay view.
     * @param fixed Whether the overlay view is to be fixed or not.
     */
    fixOverlayView(fixed: boolean): void;
    /**
     * Get the uuid of the currently selected object.
     * @returns uuid of the currently selected object.
     */
    getActiveObjectId(): ActiveVariable<string>;
    /**
     * Move the camera to look at the object with the given uuid
     * and highlight it.
     * @param uuid uuid of the object.
     * @param detector whether the function is for detector objects or event data.
     */
    lookAtObject(uuid: string, detector?: boolean): void;
    /**
     * Highlight the object with the given uuid by giving it an outline.
     * @param uuid uuid of the object.
     * @param detector whether the function is for detector objects or event data.
     */
    highlightObject(uuid: string, detector?: boolean): void;
    /**
     * Enable highlighting of the objects.
     */
    enableHighlighting(): void;
    /**
     * Disable highlighting of the objects.
     */
    disableHighlighting(): void;
    /**
     * Enable keyboard controls for the event display.
     */
    enableKeyboardControls(): void;
    /**
     * Animate the camera through the event scene.
     * @param startPos Start position of the translation animation.
     * @param tweenDuration Duration of each tween in the translation animation.
     * @param onAnimationEnd Callback when the last animation ends.
     */
    animateThroughEvent(startPos: number[], tweenDuration: number, onAnimationEnd?: () => void): void;
    /**
     * Animate scene by animating camera through the scene and animating event collision.
     * @param animationPreset Preset for animation including positions to go through and
     * event collision animation options.
     * @param onEnd Function to call when the animation ends.
     */
    animatePreset(animationPreset: AnimationPreset, onEnd?: () => void): void;
    /**
     * Animate the propagation and generation of event data with particle collison.
     * @param tweenDuration Duration of the animation tween.
     * @param onEnd Function to call when all animations have ended.
     */
    animateEventWithCollision(tweenDuration: number, onEnd?: () => void): void;
    /**
     * Animate the propagation and generation of event data
     * using clipping planes after particle collison.
     * @param tweenDuration Duration of the animation tween.
     * @param onEnd Function to call when all animations have ended.
     */
    animateClippingWithCollision(tweenDuration: number, onEnd?: () => void): void;
    /**
     * Add label to a 3D object.
     * @param label Label to add to the event object.
     * @param collection Collection the event object is a part of.
     * @param indexInCollection Event object's index in collection.
     * @param uuid UUID of the three.js object.
     */
    addLabelToObject(label: string, collection: string, indexInCollection: number, uuid: string): void;
    /**
     * Reset/remove all labels.
     */
    resetLabels(): void;
}
