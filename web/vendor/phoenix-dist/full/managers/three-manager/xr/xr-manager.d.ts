import { Camera, Group, WebGLRenderer } from 'three';
/** Type of the XR session. */
export declare enum XRSessionType {
    VR = "VR",
    AR = "AR"
}
/**
 * XR manager for XR related operations.
 */
export declare class XRManager {
    private sessionType;
    /** Whether the XR is currently active or not. */
    protected xrActive: boolean;
    /** Returns required and optional features when requesting an XR session. */
    protected sessionInit: () => {
        [key: string]: any;
    };
    /** Renderer to set the XR session for. */
    protected renderer: WebGLRenderer;
    /** Currently active XR session. */
    protected currentXRSession: any;
    /** Callback to call when the XR session ends. */
    protected onSessionEnded: () => void;
    /** Group containing the the camera for XR. */
    cameraGroup: Group | undefined;
    /** The camera used by XR. */
    xrCamera: Camera;
    /**
     * Create the XR manager.
     * @param sessionType Type of the session, either AR or VR.
     * @param sessionInit Other options for the session like optional features.
     */
    constructor(sessionType: XRSessionType);
    /**
     * Set and configure the XR session.
     * @param renderer Renderer to set the XR session for.
     * @param onSessionStarted Callback to call when the XR session starts.
     * @param onSessionEnded Callback to call when the XR session ends.
     */
    setXRSession(renderer: WebGLRenderer, onSessionStarted?: () => void, onSessionEnded?: () => void): void;
    /**
     * Callback for when the XR session is started.
     * @param session The XR session.
     */
    protected onXRSessionStarted(session: any): Promise<void>;
    /**
     * Callback when the XR session ends.
     */
    protected onXRSessionEnded(): void;
    /**
     * End the current XR session.
     */
    endXRSession(): void;
    /**
     * Get the group containing the camera for XR.
     * XR camera works by adding a Group with Camera to the scene.
     * @param camera Camera which is to be cloned for XR use.
     * @returns The camera group used in XR mode.
     */
    getCameraGroup(camera?: Camera): Group;
    /**
     * Get the camera used by XR.
     * @returns The camera used by XR.
     */
    getXRCamera(): Camera;
}
