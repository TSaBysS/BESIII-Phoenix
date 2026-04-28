import { EventEmitter } from '@angular/core';
import { Group, Object3D, Vector3 } from 'three';
import type { Configuration } from '../../lib/types/configuration';
import { SceneManager } from './scene-manager';
import { type AnimationPreset } from './animations-manager';
import { InfoLogger } from '../../helpers/info-logger';
import { ActiveVariable } from '../../helpers/active-variable';
import { ColorManager } from './color-manager';
import { XRManager, XRSessionType } from './xr/xr-manager';
import type { GeometryUIParameters } from '../../lib/types/geometry-ui-parameters';
/**
 * Manager for all three.js related functions.
 */
export declare class ThreeManager {
    private infoLogger;
    /** Manager for three.js scene. */
    private sceneManager;
    /** Manager for three.js renderers. */
    private rendererManager;
    /** Manager for three.js controls. */
    private controlsManager;
    /** Manager for export operations. */
    private exportManager;
    /** Manager for import operations. */
    private importManager;
    /** Manager for selection of 3D objects and event data. */
    private selectionManager;
    /** Manager for managing animation related operations using three.js and tween.js. */
    private animationsManager;
    /** Manager for managing effects using EffectComposer. */
    private effectsManager;
    /** VR manager for VR related operations. */
    private vrManager;
    /** AR manager for AR related operations. */
    private arManager;
    /** Coloring manager for three.js functions related to coloring of objects. */
    private colorManager;
    /** Loading manager for loadable resources. */
    private loadingManager;
    /** State manager for managing the scene's state. */
    private stateManager;
    /** Loop to run for each frame of animation. */
    private animationLoop;
    /** Loop to run for each frame to update stats. */
    private uiLoop;
    /** Function to check if the object intersected with raycaster is an event data */
    private isEventData;
    /** Function to check if the object intersected with raycaster is visible or lies in the clipped region */
    private isVisible;
    /** 'click' event listener callback to show 3D coordinates of the clicked point */
    private show3DPointsCallback;
    /** 'click' event listener callback to shift the cartesian grid at the clicked point */
    private shiftCartesianGridCallback;
    /** 'click' event listener callback to show 3D distance between two clicked points */
    private show3DDistanceCallback;
    /** Origin of the cartesian grid w.r.t. world origin */
    origin: Vector3;
    /** Scene export ignore list. */
    private ignoreList;
    /** Clipping planes for clipping geometry. */
    private clipPlanes;
    /** Status of clipping intersection. */
    private clipIntersection;
    /** Store the 3D coordinates of first point to find 3D Distance */
    private prev3DCoord;
    /** Store the 2D coordinates of first point to find 3D Distance */
    private prev2DCoord;
    /** Store the name of the object of first intersect while finding 3D Distance */
    private prevIntersectName;
    /** Canvas used for rendering the distance line */
    private distanceCanvas;
    /** Color of the text to be displayed as per dark theme */
    private displayColor;
    /** Mousemove callback to draw dynamic distance line */
    private mousemoveCallback;
    /** Emitting that a new 3D coordinate has been clicked upon */
    originChanged: EventEmitter<Vector3>;
    /** Whether the shifting of the grid is enabled */
    shiftGrid: boolean;
    /** Emitting that shifting the grid by pointer has to be stopped */
    stopShifting: EventEmitter<boolean>;
    /**
     * Create the three manager for three.js operations.
     * @param infoLogger Logger for logging data to the information panel.
     */
    constructor(infoLogger: InfoLogger);
    /**
     * Initializes the necessary three.js functionality.
     * @param configuration Configuration to customize different aspects.
     */
    init(configuration: Configuration): void;
    /**
     * Sets the color of the text displayed as per dark theme.
     */
    setDarkColor(dark: boolean): void;
    /**
     * Updates controls
     */
    updateControls(): void;
    /**
     * Set up the animation loop of the renderer.
     * @param uiLoop Function to run on render for UI (stats) apart from three manager operations.
     */
    setAnimationLoop(uiLoop: () => void): void;
    /**
     * Stop the animation loop from running.
     */
    stopAnimationLoop(): void;
    /**
     * Render overlay renderer and effect composer, and update lights.
     */
    render(): void;
    /**
     * Minimally render without any post-processing.
     * @param xrManager Manager for XR operations.
     */
    xrRender(xrManager: XRManager): void;
    /**
     * Get the scene manager and create if it doesn't exist.
     * @returns The scene manager for managing different aspects and elements of the scene.
     */
    getSceneManager(): SceneManager;
    /**
     * Sets controls to auto rotate.
     * @param autoRotate If the controls are to be automatically rotated or not.
     */
    autoRotate(autoRotate: boolean): void;
    /**
     * Helper function to filter out invalid ray intersect
     */
    private filterRayIntersect;
    /**
     * Emit originChanged emitter
     */
    originChangedEmit(origin: Vector3): void;
    /**
     * Returns the mainIntersect upon clicking a point
     */
    private getMainIntersect;
    /**
     * Show 3D coordinates where the mouse pointer clicks
     * @param show If the coordinates are to be shown or not.
     */
    show3DMousePoints(show: boolean): void;
    /**
     * Show 3D Distance between any two clicked points
     */
    show3DDistance(show: boolean): void;
    /**
     * function to dynamically draw the distance line from the prev2DCoord
     */
    private drawLine;
    /**
     * Shifts the cartesian grid at a clicked point
     */
    shiftCartesianGrid(): void;
    /**
     * Enables geometries to be clipped with clipping planes.
     * @param clippingEnabled If the the geometry clipping is to be enabled or disabled.
     */
    setClipping(clippingEnabled: boolean): void;
    /**
     * Rotate clipping planes according to the starting and opening angles.
     * @param startingAngle The starting angle of clipping.
     * @param openingAngle The opening angle of clipping.
     */
    setClippingAngle(startingAngle: number, openingAngle: number): void;
    /**
     * Animates camera transform.
     * @param cameraPosition End position.
     * @param cameraTarget End target.
     * @param duration Duration of an animation in seconds.
     */
    animateCameraTransform(cameraPosition: number[], cameraTarget: number[], duration: number): void;
    /**
     * Swaps cameras.
     * @param useOrthographic Whether to use orthographic or perspective camera.
     */
    swapCameras(useOrthographic: boolean): void;
    /**
     * Loads an OBJ (.obj) geometry from the given filename.
     * @param filename Path to the geometry.
     * @param name Name given to the geometry.
     * @param color Color to initialize the geometry.
     * @param doubleSided Renders both sides of the material.
     * @param initiallyVisible Whether the geometry is initially visible or not.
     * @param setFlat Whether object should be flat-shaded or not.
     * @returns Promise for loading the geometry.
     */
    loadOBJGeometry(filename: string, name: string, color: any, doubleSided: boolean, initiallyVisible?: boolean, setFlat?: boolean): Promise<GeometryUIParameters>;
    /**
     * Loads a GLTF (.gltf) scene/geometry from the given URL.
     * @param sceneUrl URL to the GLTF (.gltf) file.
     * @param name Name given to the geometry. If empty Name will be taken from the geometry itself
     * @param menuNodeName Name of the menu where to add the scene in the gui
     * @param scale Scale of the geometry.
     * @param initiallyVisible Whether the geometry is initially visible or not.
     * @returns Promise for loading the geometry.
     */
    loadGLTFGeometry(sceneUrl: any, name: string, menuNodeName: string, scale: number, initiallyVisible: boolean): Promise<GeometryUIParameters[]>;
    /**
     * Parses and loads a geometry in OBJ (.obj) format.
     * @param geometry Geometry in OBJ (.obj) format.
     * @param name Name given to the geometry.
     * @param initiallyVisible Whether the geometry is initially visible or not.
     */
    parseOBJGeometry(geometry: string, name: string, initiallyVisible?: boolean): GeometryUIParameters;
    /**
     * Parses and loads a geometry in GLTF (.gltf or .glb) format.
     * also supports zip files of the above
     * @param file Geometry file in GLTF (.gltf or .glb) format.
     * @returns Promise for loading the geometry.
     */
    parseGLTFGeometry(file: File): Promise<GeometryUIParameters[]>;
    /**
     * Parses and loads a scene in Phoenix (.phnx) format.
     * @param scene Geometry in Phoenix (.phnx) format.
     * @returns Promise for loading the scene.
     */
    parsePhnxScene(scene: any): Promise<void>;
    /**
     * Loads geometries from JSON.
     * @param json JSON or URL to JSON file of the geometry.
     * @param name Name of the geometry or group of geometries.
     * @param scale Scale of the geometry.
     * @param doubleSided Renders both sides of the material.
     * @param initiallyVisible Whether the geometry is initially visible or not.
     * @returns Promise for loading the geometry.
     */
    loadJSONGeometry(json: string | {
        [key: string]: any;
    }, name: string, scale?: number, doubleSided?: boolean, initiallyVisible?: boolean): Promise<GeometryUIParameters>;
    /**
     * Exports scene to OBJ file format.
     */
    exportSceneToOBJ(): void;
    /**
     * Exports scene as phoenix format, allowing to
     * load it later and recover the saved configuration.
     */
    exportPhoenixScene(): void;
    /**
     * Fixes the camera position of the overlay view.
     * @param fixed Whether the overlay view is to be fixed or not.
     */
    fixOverlayView(fixed: boolean): void;
    /**
     * Initializes the object which will show information of the selected geometry/event data.
     * @param selectedObject Object to display the data.
     */
    setSelectedObjectDisplay(selectedObject: {
        name: string;
        attributes: any[];
    }): void;
    /**
     * Set event data depthTest to enable or disable if event data should show on top of geometry.
     * @param value A boolean to specify if depthTest is to be enabled or disabled.
     */
    eventDataDepthTest(value: boolean): void;
    /**
     * Toggles the ability of selecting geometries/event data by clicking on the screen.
     * @param enable Value to enable or disable the functionality.
     */
    enableSelecting(enable: boolean): void;
    /**
     * Clears event data of the scene.
     */
    clearEventData(): void;
    /**
     * Adds group of an event data type to the main group containing event data.
     * @param typeName Type of event data.
     * @returns Three.js group containing the type of event data.
     */
    addEventDataTypeGroup(typeName: string): Group;
    /**
     * Sets the renderer to be used to render the event display on the overlayed canvas.
     * @param overlayCanvas An HTML canvas on which the overlay renderer is to be set.
     */
    setOverlayRenderer(overlayCanvas: HTMLCanvasElement): void;
    /**
     * Zoom all the cameras by a specific zoom factor.
     * The factor may either be greater (zoom in) or smaller (zoom out) than 1.
     * @param zoomFactor The factor to zoom by.
     * @param zoomTime The time it takes for a zoom animation to complete.
     */
    zoomTo(zoomFactor: number, zoomTime: number): void;
    /**
     * Get the selection manager.
     * @returns Selection manager responsible for managing selection of 3D objects.
     */
    private getSelectionManager;
    /**
     * Animates camera position.
     * @param cameraPosition End position.
     * @param duration Duration of an animation in seconds.
     */
    private animateCameraPosition;
    /**
     * Animates camera target.
     * @param cameraTarget End target.
     * @param duration Duration of an animation in seconds.
     */
    private animateCameraTarget;
    /**
     * Get the uuid of the currently selected object.
     * @returns uuid of the currently selected object.
     */
    getActiveObjectId(): ActiveVariable<string>;
    /**
     * Move the camera to look at the object with the given uuid.
     * @param uuid uuid of the object.
     * @param detector whether the function is for detector objects or event data
     */
    lookAtObject(uuid: string, detector?: boolean): void;
    /**
     * Get position of object from UUID.
     * @param uuid UUID of the object.
     * @returns Position of the 3D object.
     */
    getObjectPosition(uuid: string): Vector3;
    /**
     * Highlight the object with the given uuid by giving it an outline.
     * @param uuid uuid of the object.
     * @param detector whether the function is for detector objects or event data.
     */
    highlightObject(uuid: string, detector?: boolean): void;
    /**
     * Enable the highlighting of the objects.
     */
    enableHighlighting(): void;
    /**
     * Disable the highlighting of the objects.
     */
    disableHighlighting(): void;
    /**
     * Enable keyboard controls for some Three service operations.
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
    /** Saves a blob */
    saveBlob: (blob: Blob | MediaSource, fileName: string) => void;
    /**
     * crops the size of an image to fit the ratio of the given screen size
     * That way the final image won't be streched
     */
    private croppedSize;
    /**
     * checks whether the size of the canvas required to build the required
     * screenshot (based on the desired size and the fitting parameter) does
     * matches the maximum allowed canvas size
     * See makeScreenShot for the description of fitting
     */
    checkScreenShotCanvasSize(width: number, height: number, fitting?: string): boolean;
    /**
     * Takes a screen shot of the current view
     * @param width the width of the picture to be created
     * @param height the height of the picture to be created
     * @param fitting the type of fitting to use in case width and height
     * ratio do not match the current screen ratio. Posible values are
     *    - Crop : current view is cropped on both side or up and done to fit ratio
     *             thus it is not streched, but some parts are lost
     *    - Strech : current view is streched to given format
     *               this is the default and used also for any other value given to fitting
     */
    makeScreenShot(width: number, height: number, fitting?: string): void;
    /**
     * Initialize the VR session.
     * @param xrSessionType Type of the XR session. Either AR or VR.
     * @param onSessionEnded Callback when the VR session ends.
     */
    initXRSession(xrSessionType: XRSessionType, onSessionEnded?: () => void): void;
    /**
     * End the current VR session.
     * @param xrSessionType Type of the XR session. Either AR or VR.
     */
    endXRSession(xrSessionType: XRSessionType): void;
    /**
     * Get an object from the scene by name.
     * @param objectName Name of the object in scene.
     */
    getObjectByName(objectName: string): Object3D;
    /**
     * Set the antialiasing.
     * @param antialias Whether antialiasing is to enabled or disabled.
     */
    setAntialiasing(antialias: boolean): void;
    /** Add parametrised geometry to the scene.
     * @param parameters The name, dimensions, and radial values for this cylindrical volume.
     */
    addGeometryFromParameters(parameters: any): void;
    /**
     * Add a 3D text label to label an event data object.
     * @param label Label to add to the event object.
     * @param uuid UUID of the three.js object.
     * @param labelId Unique ID of the label.
     */
    addLabelToObject(label: string, uuid: string, labelId: string): void;
    /**
     * Get the coloring manager.
     * @returns The coloring manager for managing coloring related three.js operations.
     */
    getColorManager(): ColorManager;
}
