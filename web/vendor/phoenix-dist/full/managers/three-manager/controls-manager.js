import { Tween } from '@tweenjs/tween.js';
import { PerspectiveCamera, OrthographicCamera, Vector3, Group, TubeGeometry, } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
/**
 * Manager for managing event display controls.
 */
export class ControlsManager {
    /**
     * Constructor for setting up all the controls.
     * @param rendererManager The renderer manager to get the main renderer.
     */
    constructor(rendererManager, defaultView = [0, 0, 200]) {
        this.controls = [];
        // this.mainControls = new OrbitControls();
        // this.overlayControls = null;
        const rendererElement = rendererManager.getMainRenderer()?.domElement;
        // Arguments: FOV, aspect ratio, near and far distances
        const perspectiveCamera = new PerspectiveCamera(75, rendererElement.offsetWidth / rendererElement.offsetHeight, 10, 100000);
        // Arguments: left, right, top, bottom, near and far distances
        const orthographicCamera = new OrthographicCamera(rendererElement.offsetWidth / -2, rendererElement.offsetWidth / 2, rendererElement.offsetHeight / 2, rendererElement.offsetHeight / -2, 10, 100000);
        // Orbit controls allow to move around
        this.perspectiveControls = this.setOrbitControls(perspectiveCamera, rendererElement);
        this.orthographicControls = this.setOrbitControls(orthographicCamera, rendererElement);
        perspectiveCamera.position.z = orthographicCamera.position.z =
            defaultView[2];
        perspectiveCamera.position.y = orthographicCamera.position.y =
            defaultView[1];
        perspectiveCamera.position.x = orthographicCamera.position.x =
            defaultView[0];
        if (defaultView.length >= 6) {
            this.perspectiveControls.target = this.orthographicControls.target =
                new Vector3(defaultView[3], defaultView[4], defaultView[5]);
        }
        // Set active orbit controls
        this.addControls(this.perspectiveControls);
        this.addControls(this.orthographicControls);
        this.setActiveControls(this.perspectiveControls);
        this.setMainControls(this.perspectiveControls);
        this.setOverlayControls(this.orthographicControls);
        // Add listener
        this.getActiveControls().addEventListener('change', () => {
            this.transformSync();
            this.updateSync();
        });
        // Modify camera(s) on window resize
        this.setupResize(rendererElement);
    }
    /**
     * Set orbit controls for the camera.
     * @param camera The camera with which to create the orbit controls.
     * @param domElement DOM element of the renderer to associate the orbit controls with.
     * @returns Configured orbit controls.
     */
    setOrbitControls(camera, domElement) {
        const controls = new OrbitControls(camera, domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.25;
        controls.enableZoom = true;
        controls.autoRotate = false;
        return controls;
    }
    // SET/GET
    /**
     * Set the currently active orbit controls.
     * @param controls Orbit controls to be set as active.
     */
    setActiveControls(controls) {
        this.activeControls = controls;
    }
    /**
     * Set the main orbit controls.
     * @param controls Orbit controls to be set as main.
     */
    setMainControls(controls) {
        this.mainControls = controls;
    }
    /**
     * Set orbit controls for overlay.
     * @param controls Orbit controls to be set for overlay.
     */
    setOverlayControls(controls) {
        this.overlayControls = controls;
    }
    /**
     * Get currently active orbit controls.
     * @returns Currently active orbit controls.
     */
    getActiveControls() {
        return this.activeControls;
    }
    /**
     * Get the main orbit controls.
     * @returns Main orbit controls.
     */
    getMainControls() {
        return this.mainControls;
    }
    /**
     * Get orbit controls for overlay.
     * @returns Orbit controls for overlay.
     */
    getOverlayControls() {
        return this.overlayControls;
    }
    /**
     * Get the currently active camera.
     * @returns Currently active camera.
     */
    getActiveCamera() {
        return this.activeControls.object;
    }
    /**
     * Get the main camera.
     * @returns Main camera.
     */
    getMainCamera() {
        return this.mainControls.object;
    }
    /**
     * Get the camera for overlay.
     * @returns The camera for overlay.
     */
    getOverlayCamera() {
        return this.overlayControls.object;
    }
    /**
     * Get the main and overlay cameras.
     * @returns An array containing the main and overlay cameras.
     */
    getAllCameras() {
        return [this.getMainCamera(), this.getOverlayCamera()];
    }
    // FUNCTIONS
    /**
     * Add orbit controls to the controls list.
     * @param controls Orbit controls to be added.
     */
    addControls(controls) {
        if (!this.containsObject(controls, this.controls)) {
            this.controls.push(controls);
        }
    }
    /**
     * Remove orbit controls from the controls list.
     * @param controls Orbit controls to be removed.
     */
    removeControls(controls) {
        const index = this.controls.indexOf(controls);
        if (index > -1) {
            this.controls.splice(index, 1);
        }
    }
    /**
     * Swap the main and overlay orbit controls.
     */
    swapControls() {
        const temp = this.mainControls;
        this.mainControls = this.overlayControls;
        // this._mainControls.autoRotate = temp.autoRotate;
        this.overlayControls = temp;
    }
    /**
     * Synchronously update all controls.
     */
    updateSync() {
        for (const control of this.controls) {
            if (control === this.activeControls) {
                continue;
            }
            this.update(control);
        }
    }
    /**
     * Update orbit controls.
     * @param controls Orbit controls to be updated.
     */
    update(controls) {
        controls.update();
    }
    /**
     * Synchronously transform the controls by updating the position and rotation.
     */
    transformSync() {
        for (const control of this.controls) {
            if (control === this.activeControls) {
                continue;
            }
            this.positionSync(control);
            this.rotationSync(control);
        }
    }
    /**
     * Zoom all the cameras by a specific zoom factor.
     * The factor may either be greater or smaller.
     * @param zoomFactor The factor to zoom by.
     * @param zoomTime The time it takes for a zoom animation to complete.
     */
    zoomTo(zoomFactor, zoomTime) {
        for (const camera of this.getAllCameras()) {
            if (camera instanceof OrthographicCamera) {
                const animation = new Tween(camera);
                animation
                    .to({
                    zoom: camera.zoom * (1 / zoomFactor),
                }, zoomTime)
                    .start();
                camera.updateProjectionMatrix();
            }
            else {
                const animation = new Tween(camera.position);
                animation
                    .to({
                    x: camera.position.x * zoomFactor,
                    y: camera.position.y * zoomFactor,
                    z: camera.position.z * zoomFactor,
                }, zoomTime)
                    .start();
            }
        }
    }
    /**
     * Move the camera to look at the object with the given uuid.
     * @param uuid uuid of the object.
     * @param objectsGroup Group of objects to be traversed for finding the object
     * with the given uuid.
     */
    lookAtObject(uuid, objectsGroup, offset = 0) {
        const origin = new Vector3(0, 0, 0);
        const objectPosition = this.getObjectPosition(uuid, objectsGroup);
        if (objectPosition) {
            // Check if the object is away from the origin
            for (const camera of this.getAllCameras()) {
                // Moving the camera to the object's position and then zooming out
                new Tween(camera.position)
                    .to({
                    x: objectPosition.x * 1.1 + offset,
                    y: objectPosition.y * 1.1 + offset,
                    z: objectPosition.z * 1.1 + offset,
                }, 200)
                    .start();
            }
        }
    }
    /**
     * Get position of object from UUID.
     * @param uuid UUID of the object.
     * @param objectsGroup Objects group to look into for the object.
     * @returns Position of the 3D object.
     */
    getObjectPosition(uuid, objectsGroup) {
        const object = objectsGroup.getObjectByProperty('uuid', uuid);
        if (object) {
            const origin = new Vector3(0, 0, 0);
            let objectPosition = new Vector3();
            if (object instanceof Group) {
                // If it is a group of other event data we traverse through it
                object.traverse((childObject) => {
                    // Make sure the child is not a group (e.g Track is a group)
                    if (childObject.children.length === 0) {
                        if (childObject.position.equals(origin)) {
                            // Get the max vector from the bounding box to accumulate with the clusters
                            if (childObject.geometry?.boundingSphere) {
                                try {
                                    objectPosition.add(childObject.geometry.boundingSphere.getBoundingBox().max);
                                }
                                catch (e) {
                                    objectPosition.add(childObject.geometry.boundingSphere?.center);
                                }
                            }
                        }
                        else {
                            objectPosition.add(childObject.position);
                        }
                    }
                });
            }
            else if (object.position.equals(origin)) {
                // Get the center of bounding sphere of objects with no position
                objectPosition = object.geometry?.boundingSphere?.center;
            }
            else {
                // Get the object position for all other elements
                objectPosition = object.position;
            }
            return objectPosition;
        }
        else {
            return new Vector3();
        }
    }
    /**
     * Hide tube geometry of tracks on zoom if the camera is too close.
     * (For visibility of vertices)
     * @param scene Scene to look in for tracks.
     * @param minRadius Radius after which the tube tracks should be invisible.
     */
    hideTubeTracksOnZoom(scene, minRadius) {
        let tracksHidden = false;
        const origin = new Vector3();
        this.activeControls.addEventListener('change', (event) => {
            const isCameraClose = (event?.target?.object?.position).distanceTo(origin) <
                minRadius;
            if (isCameraClose && !tracksHidden) {
                scene.getObjectByName('Tracks')?.traverse((track) => {
                    if (track.name === 'Track' &&
                        track.geometry instanceof TubeGeometry) {
                        track.visible = false;
                    }
                });
                tracksHidden = true;
            }
            else if (!isCameraClose && tracksHidden) {
                scene.getObjectByName('Tracks')?.traverse((track) => {
                    if (track.name === 'Track' &&
                        track.geometry instanceof TubeGeometry) {
                        track.visible = true;
                    }
                });
                tracksHidden = false;
            }
        });
    }
    /**
     * Synchronously update position of the orbit controls.
     * @param controls Orbit controls whose position is to be updated.
     */
    positionSync(controls) {
        controls.object.position.set(this.activeControls.object.position.x, this.activeControls.object.position.y, this.activeControls.object.position.z);
        // controls.update();
    }
    /**
     * Synchronously update rotation of the orbit controls.
     * @param controls Controls whose rotation is to be updated.
     */
    rotationSync(controls) {
        controls.target = this.activeControls.target;
        // controls.update();
    }
    /**
     * Check if the list of orbit controls contains a specific orbit controls.
     * @param obj Orbit controls to be checked for containment.
     * @param list List of orbit controls.
     * @returns If the list contains the orbit controls.
     */
    containsObject(obj, list) {
        for (const object of list) {
            if (object === obj) {
                return true;
            }
        }
        return false;
    }
    /**
     * Set up to make camera(s) adapt to window resize.
     * @param rendererElement Canvas element of the main renderer.
     */
    setupResize(rendererElement) {
        window.addEventListener('resize', () => {
            let mainCamera = this.getMainCamera();
            if (mainCamera.isOrthographicCamera) {
                mainCamera = mainCamera;
                mainCamera.left = rendererElement.offsetWidth / -2;
                mainCamera.right = rendererElement.offsetWidth / 2;
                mainCamera.top = rendererElement.offsetHeight / 2;
                mainCamera.bottom = rendererElement.offsetHeight / -2;
                mainCamera.updateProjectionMatrix();
            }
            else {
                mainCamera = mainCamera;
                mainCamera.aspect =
                    rendererElement.offsetWidth / rendererElement.offsetHeight;
                mainCamera.updateProjectionMatrix();
            }
        });
    }
    /**
     * Get the index of orbit controls from a list of orbit controls.
     * @param obj Orbit controls whose index is to be obtained.
     * @param list List of orbit controls.
     * @returns Index of the orbit controls in the given list. Returns -1 if not found.
     */
    objectIndex(obj, list) {
        for (let i = 0; i < list.length; i++) {
            if (list[i] === obj) {
                return i;
            }
        }
        return -1;
    }
}
//# sourceMappingURL=controls-manager.js.map