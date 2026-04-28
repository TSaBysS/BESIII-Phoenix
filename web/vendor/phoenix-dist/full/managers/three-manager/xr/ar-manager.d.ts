import { PerspectiveCamera, Scene } from 'three';
import { XRManager } from './xr-manager';
/**
 * AR manager for AR related operations.
 */
export declare class ARManager extends XRManager {
    private scene;
    private camera;
    /** Session type to use for AR. */
    static readonly SESSION_TYPE: string;
    /** Whether to enable DOM overlay which shows Phoenix overlays on top of the AR scene. */
    static enableDomOverlay: boolean;
    /** Previous values of scene scale, camera near and camera position. */
    private previousValues;
    /**
     * Create the AR manager.
     * @param scene The three.js scene.
     * @param camera Camera in the scene.
     * @override
     */
    constructor(scene: Scene, camera: PerspectiveCamera);
    /**
     * Callback for when the AR session is started.
     * @param session The AR session.
     * @override
     */
    protected onXRSessionStarted(session: any): Promise<void>;
    /**
     * Callback when the AR session ends.
     * @override
     */
    protected onXRSessionEnded(): void;
    /**
     * Scale the three.js scene.
     * @param scale Number to scale the scene to.
     */
    private scaleScene;
}
