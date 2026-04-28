import { Camera, Object3D, Vector3, Scene } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RendererManager } from './renderer-manager';
/**
 * Manager for managing event display controls.
 */
export declare class ControlsManager {
    /** Currently active orbit controls. */
    private activeControls;
    /** The main orbit controls. */
    private mainControls;
    /** Orbit controls for overlay view. */
    private overlayControls;
    /** All orbit controls. */
    private controls;
    /** Orbit controls for the perspective view. */
    private perspectiveControls;
    /** Orbit controls for the orthographic view. */
    private orthographicControls;
    /**
     * Constructor for setting up all the controls.
     * @param rendererManager The renderer manager to get the main renderer.
     */
    constructor(rendererManager: RendererManager, defaultView?: number[]);
    /**
     * Set orbit controls for the camera.
     * @param camera The camera with which to create the orbit controls.
     * @param domElement DOM element of the renderer to associate the orbit controls with.
     * @returns Configured orbit controls.
     */
    private setOrbitControls;
    /**
     * Set the currently active orbit controls.
     * @param controls Orbit controls to be set as active.
     */
    setActiveControls(controls: OrbitControls): void;
    /**
     * Set the main orbit controls.
     * @param controls Orbit controls to be set as main.
     */
    setMainControls(controls: OrbitControls): void;
    /**
     * Set orbit controls for overlay.
     * @param controls Orbit controls to be set for overlay.
     */
    setOverlayControls(controls: OrbitControls): void;
    /**
     * Get currently active orbit controls.
     * @returns Currently active orbit controls.
     */
    getActiveControls(): OrbitControls;
    /**
     * Get the main orbit controls.
     * @returns Main orbit controls.
     */
    getMainControls(): OrbitControls;
    /**
     * Get orbit controls for overlay.
     * @returns Orbit controls for overlay.
     */
    getOverlayControls(): OrbitControls;
    /**
     * Get the currently active camera.
     * @returns Currently active camera.
     */
    getActiveCamera(): Camera;
    /**
     * Get the main camera.
     * @returns Main camera.
     */
    getMainCamera(): Camera;
    /**
     * Get the camera for overlay.
     * @returns The camera for overlay.
     */
    getOverlayCamera(): Camera;
    /**
     * Get the main and overlay cameras.
     * @returns An array containing the main and overlay cameras.
     */
    getAllCameras(): Camera[];
    /**
     * Add orbit controls to the controls list.
     * @param controls Orbit controls to be added.
     */
    addControls(controls: OrbitControls): void;
    /**
     * Remove orbit controls from the controls list.
     * @param controls Orbit controls to be removed.
     */
    removeControls(controls: OrbitControls): void;
    /**
     * Swap the main and overlay orbit controls.
     */
    swapControls(): void;
    /**
     * Synchronously update all controls.
     */
    updateSync(): void;
    /**
     * Update orbit controls.
     * @param controls Orbit controls to be updated.
     */
    update(controls: OrbitControls): void;
    /**
     * Synchronously transform the controls by updating the position and rotation.
     */
    transformSync(): void;
    /**
     * Zoom all the cameras by a specific zoom factor.
     * The factor may either be greater or smaller.
     * @param zoomFactor The factor to zoom by.
     * @param zoomTime The time it takes for a zoom animation to complete.
     */
    zoomTo(zoomFactor: number, zoomTime: number): void;
    /**
     * Move the camera to look at the object with the given uuid.
     * @param uuid uuid of the object.
     * @param objectsGroup Group of objects to be traversed for finding the object
     * with the given uuid.
     */
    lookAtObject(uuid: string, objectsGroup: Object3D, offset?: number): void;
    /**
     * Get position of object from UUID.
     * @param uuid UUID of the object.
     * @param objectsGroup Objects group to look into for the object.
     * @returns Position of the 3D object.
     */
    getObjectPosition(uuid: string, objectsGroup: Object3D): Vector3;
    /**
     * Hide tube geometry of tracks on zoom if the camera is too close.
     * (For visibility of vertices)
     * @param scene Scene to look in for tracks.
     * @param minRadius Radius after which the tube tracks should be invisible.
     */
    hideTubeTracksOnZoom(scene: Scene, minRadius: number): void;
    /**
     * Synchronously update position of the orbit controls.
     * @param controls Orbit controls whose position is to be updated.
     */
    private positionSync;
    /**
     * Synchronously update rotation of the orbit controls.
     * @param controls Controls whose rotation is to be updated.
     */
    private rotationSync;
    /**
     * Check if the list of orbit controls contains a specific orbit controls.
     * @param obj Orbit controls to be checked for containment.
     * @param list List of orbit controls.
     * @returns If the list contains the orbit controls.
     */
    private containsObject;
    /**
     * Set up to make camera(s) adapt to window resize.
     * @param rendererElement Canvas element of the main renderer.
     */
    private setupResize;
    /**
     * Get the index of orbit controls from a list of orbit controls.
     * @param obj Orbit controls whose index is to be obtained.
     * @param list List of orbit controls.
     * @returns Index of the orbit controls in the given list. Returns -1 if not found.
     */
    private objectIndex;
}
