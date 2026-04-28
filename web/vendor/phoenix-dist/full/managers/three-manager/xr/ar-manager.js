import { SceneManager } from '../scene-manager';
import { XRManager, XRSessionType } from './xr-manager';
// NOTE: This was created on 28/06/2021
// It might become outdated given how WebXR is still a work in progress
// LAST UPDATED ON 07/07/2021
/**
 * AR manager for AR related operations.
 */
export class ARManager extends XRManager {
    /**
     * Create the AR manager.
     * @param scene The three.js scene.
     * @param camera Camera in the scene.
     * @override
     */
    constructor(scene, camera) {
        super(XRSessionType.AR);
        this.scene = scene;
        this.camera = camera;
        /** Previous values of scene scale, camera near and camera position. */
        this.previousValues = {
            sceneScale: 1,
            cameraNear: 10,
        };
        this.previousValues.sceneScale = scene.scale.x;
        this.previousValues.cameraNear = camera.near;
        this.sessionInit = () => {
            return ARManager.enableDomOverlay
                ? {
                    optionalFeatures: ['dom-overlay'],
                    domOverlay: { root: document.body },
                }
                : {};
        };
    }
    /**
     * Callback for when the AR session is started.
     * @param session The AR session.
     * @override
     */
    async onXRSessionStarted(session) {
        document.body.style.setProperty('background-color', 'transparent');
        this.previousValues.sceneScale = this.scene.scale.x;
        this.previousValues.cameraNear = this.camera.near;
        this.scaleScene(0.00001);
        this.camera.near = 0.01;
        this.renderer.xr.setReferenceSpaceType('local');
        await super.onXRSessionStarted(session);
    }
    /**
     * Callback when the AR session ends.
     * @override
     */
    onXRSessionEnded() {
        document.body.style.removeProperty('background-color');
        this.scaleScene(this.previousValues.sceneScale);
        this.camera.near = this.previousValues.cameraNear;
        super.onXRSessionEnded();
    }
    /**
     * Scale the three.js scene.
     * @param scale Number to scale the scene to.
     */
    scaleScene(scale) {
        [
            SceneManager.EVENT_DATA_ID,
            SceneManager.GEOMETRIES_ID,
            SceneManager.LABELS_ID,
        ].forEach((groupName) => {
            this.scene.getObjectByName(groupName)?.scale.setScalar(scale);
        });
    }
}
/** Session type to use for AR. */
ARManager.SESSION_TYPE = 'immersive-ar';
/** Whether to enable DOM overlay which shows Phoenix overlays on top of the AR scene. */
ARManager.enableDomOverlay = true;
//# sourceMappingURL=ar-manager.js.map