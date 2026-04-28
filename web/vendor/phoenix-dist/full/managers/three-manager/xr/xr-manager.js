import { ArrayCamera, Group, Vector3, } from 'three';
// NOTE: This was created on 28/06/2021
// It might become outdated given how WebXR is still a work in progress
// LAST UPDATED ON 29/06/2021
/** Type of the XR session. */
export var XRSessionType;
(function (XRSessionType) {
    XRSessionType["VR"] = "VR";
    XRSessionType["AR"] = "AR";
})(XRSessionType || (XRSessionType = {}));
/**
 * XR manager for XR related operations.
 */
export class XRManager {
    /**
     * Create the XR manager.
     * @param sessionType Type of the session, either AR or VR.
     * @param sessionInit Other options for the session like optional features.
     */
    constructor(sessionType) {
        this.sessionType = sessionType;
        /** Whether the XR is currently active or not. */
        this.xrActive = false;
        /** Currently active XR session. */
        this.currentXRSession = null;
    }
    /**
     * Set and configure the XR session.
     * @param renderer Renderer to set the XR session for.
     * @param onSessionStarted Callback to call when the XR session starts.
     * @param onSessionEnded Callback to call when the XR session ends.
     */
    setXRSession(renderer, onSessionStarted, onSessionEnded) {
        this.renderer = renderer;
        if (onSessionEnded)
            this.onSessionEnded = onSessionEnded;
        const webXR = navigator?.xr;
        const xrType = this.sessionType === XRSessionType.VR ? 'vr' : 'ar';
        webXR
            ?.requestSession(`immersive-${xrType}`, this.sessionInit?.())
            .then((session) => {
            this.onXRSessionStarted.bind(this)(session);
            onSessionStarted?.();
        })
            .catch((error) => {
            console.error(`${xrType.toUpperCase()} Error:`, error);
        });
    }
    /**
     * Callback for when the XR session is started.
     * @param session The XR session.
     */
    async onXRSessionStarted(session) {
        this.xrActive = true;
        session.addEventListener('end', this.onXRSessionEnded.bind(this));
        await this.renderer.xr.setSession(session);
        this.currentXRSession = session;
    }
    /**
     * Callback when the XR session ends.
     */
    onXRSessionEnded() {
        this.xrActive = false;
        this.currentXRSession.removeEventListener('end', this.onXRSessionEnded);
        this.currentXRSession = null;
        this.cameraGroup = undefined;
        this.onSessionEnded?.();
    }
    /**
     * End the current XR session.
     */
    endXRSession() {
        this.currentXRSession?.end();
    }
    /**
     * Get the group containing the camera for XR.
     * XR camera works by adding a Group with Camera to the scene.
     * @param camera Camera which is to be cloned for XR use.
     * @returns The camera group used in XR mode.
     */
    getCameraGroup(camera) {
        // Set up the camera position in the XR - Adding a group with camera does it
        if (!this.cameraGroup) {
            this.cameraGroup = new Group();
        }
        if (camera && this.xrActive) {
            this.xrCamera = this.renderer.xr
                .getCamera()
                .copy(new ArrayCamera([camera.clone()]));
            this.xrCamera.name = 'XR_CAMERA';
            const cameraPosition = this.sessionType === XRSessionType.VR
                ? this.xrCamera.position
                : new Vector3(0, 0, 0.1);
            this.cameraGroup.position.copy(cameraPosition);
            this.cameraGroup.add(this.xrCamera);
        }
        return this.cameraGroup;
    }
    /**
     * Get the camera used by XR.
     * @returns The camera used by XR.
     */
    getXRCamera() {
        return this.xrCamera;
    }
}
//# sourceMappingURL=xr-manager.js.map