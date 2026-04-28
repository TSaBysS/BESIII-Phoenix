import { WebGLRenderer } from 'three';
import { XRManager } from './xr-manager';
/**
 * VR manager for VR related operations.
 */
export declare class VRManager extends XRManager {
    /** Session type to use for VR. */
    static readonly SESSION_TYPE: string;
    /** The VR controller for movement. */
    private controller1;
    /** The VR controller for movement. */
    private controller2;
    /** The VR controller representation */
    private controllerGrip1;
    /** The VR controller representation */
    private controllerGrip2;
    /** Listener for when the "Select Start" button is pushed. */
    private onControllerSelectStart;
    /** Listener for when the "Select Start" button is released. */
    private onControllerSelectEnd;
    /**
     * Create the VR manager.
     * @override
     */
    constructor();
    /**
     * Set and configure the VR session.
     * @param renderer Renderer to set the VR session for.
     * @param onSessionStarted Callback to call when the VR session starts.
     * @param onSessionEnded Callback to call when the VR session ends.
     * @override
     */
    setXRSession(renderer: WebGLRenderer, onSessionStarted?: () => void, onSessionEnded?: () => void): void;
    /**
     * Callback when the VR session ends.
     * @override
     */
    protected onXRSessionEnded(): void;
    /**
     * Set up VR controls for moving around the event display.
     */
    private setupVRControls;
    /**
     * Move the camera in the given direction.
     * @param direction Direction to move towards.
     * @param stepDistance Distance to move by.
     */
    private moveInDirection;
}
