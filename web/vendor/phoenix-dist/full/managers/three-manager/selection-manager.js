import { Vector2, Raycaster, Object3D, DirectionalLight, AmbientLight, AxesHelper, } from 'three';
import { PrettySymbols } from '../../helpers/pretty-symbols';
import { ActiveVariable } from '../../helpers/active-variable';
/**
 * Manager for managing event display's selection related functions.
 */
export class SelectionManager {
    /**
     * Constructor for the selection manager.
     */
    constructor() {
        /** The currently selected object which is observable for changes. */
        this.activeObject = new ActiveVariable('');
        /**
         * Function to call on mouse move when object selection is enabled.
         */
        this.onTouchMove = (event) => {
            const intersectedObject = this.intersectObject(event);
            if (intersectedObject) {
                if (this.ignoreList.includes(intersectedObject.type)) {
                    return;
                }
                this.outlinePass.selectedObjects = [intersectedObject];
            }
        };
        /**
         * Function to call on mouse click when object selection is enabled.
         */
        this.onDocumentMouseDown = () => {
            const intersectedObject = this.outlinePass.selectedObjects[0];
            if (intersectedObject) {
                this.selectedObject.name = intersectedObject.name;
                this.selectedObject.attributes.splice(0, this.selectedObject.attributes.length);
                this.activeObject.update(intersectedObject.uuid);
                const prettyParams = PrettySymbols.getPrettyParams(intersectedObject.userData);
                for (const key of Object.keys(prettyParams)) {
                    this.selectedObject.attributes.push({
                        attributeName: key,
                        attributeValue: prettyParams[key],
                    });
                }
                // Process properties of the selected object
                const props = Object.keys(intersectedObject.userData)
                    .map((key) => {
                    // Only take properties that are a string or number (no arrays or objects)
                    if (['string', 'number'].includes(typeof intersectedObject.userData[key])) {
                        return key + '=' + intersectedObject.userData[key];
                    }
                })
                    .filter((val) => val);
                // Build the log text and add to the logger
                const log = intersectedObject.name +
                    (props.length > 0 ? ' with ' + props.join(', ') : '');
                if (log) {
                    this.infoLogger.add(log, 'Clicked');
                }
            }
        };
        /**
         * Function to call on touch when object selection is enabled.
         * @param event Event containing touch data.
         */
        this.onTouchDown = (event) => {
            event.preventDefault();
            this.onTouchMove(event.targetTouches[0]);
            this.onDocumentMouseDown();
        };
        this.isInit = false;
        this.ignoreList = [
            new AmbientLight().type,
            new DirectionalLight().type,
            new AxesHelper().type,
        ];
    }
    /**
     * Initialize the selection manager.
     * @param camera The camera inside the scene.
     * @param scene The scene used for event display.
     * @param effectsManager Manager for managing three.js event display effects
     * like outline pass and unreal bloom.
     * @param infoLogger Service for logging data to the information panel.
     */
    init(camera, scene, effectsManager, infoLogger) {
        this.camera = camera;
        this.scene = scene;
        this.isInit = true;
        this.infoLogger = infoLogger;
        this.effectsManager = effectsManager;
        this.outlinePass = this.effectsManager.addOutlinePassForSelection();
    }
    /**
     * Set the currently selected object.
     * @param selectedObject The currently selected object.
     */
    setSelectedObject(selectedObject) {
        this.selectedObject = selectedObject;
    }
    /**
     * Get the uuid of the currently selected object.
     * @returns uuid of the currently selected object.
     */
    getActiveObjectId() {
        return this.activeObject;
    }
    /**
     * Set if selecting is to be enabled or disabled.
     * @param enable If selecting is to be enabled or disabled.
     */
    setSelecting(enable) {
        if (this.isInit) {
            // eslint-disable-next-line
            enable ? this.enableSelecting() : this.disableSelecting();
        }
    }
    /**
     * Enable selecting of event display elements and set mouse move and click events.
     */
    enableSelecting() {
        const canvas = document.getElementById('three-canvas');
        if (!canvas) {
            return;
        }
        canvas.addEventListener('mousemove', this.onTouchMove, true);
        canvas.addEventListener('click', this.onDocumentMouseDown, true);
        canvas.addEventListener('touchstart', this.onTouchDown);
        this.preSelectionAntialias = this.effectsManager.antialiasing;
        this.effectsManager.setAntialiasing(false);
    }
    /**
     * Disable selecting of event display elements and remove mouse move and click events.
     */
    disableSelecting() {
        const canvas = document.getElementById('three-canvas');
        if (!canvas) {
            return;
        }
        canvas.removeEventListener('mousemove', this.onTouchMove, true);
        canvas.removeEventListener('click', this.onDocumentMouseDown, true);
        canvas.removeEventListener('touchstart', this.onTouchDown);
        this.outlinePass.selectedObjects = [];
        this.effectsManager.setAntialiasing(this.preSelectionAntialias);
    }
    /**
     * Check if any object intersects on mouse move.
     * @param event Event containing data of the mouse move.
     * @returns Intersected or hovered over object.
     */
    intersectObject(event) {
        event.preventDefault?.();
        const mouse = new Vector2();
        const rendererElement = this.effectsManager.composer.renderer.domElement;
        mouse.x = (event.clientX / rendererElement.clientWidth) * 2 - 1;
        mouse.y = -(event.clientY / rendererElement.clientHeight) * 2 + 1;
        const raycaster = new Raycaster();
        raycaster.setFromCamera(mouse, this.camera);
        raycaster.params.Line.threshold = 3;
        const intersects = raycaster.intersectObjects(this.scene.children, true);
        if (intersects.length > 0) {
            // We want the closest one
            return intersects[0].object;
        }
        return new Object3D();
    }
    /**
     * Enable highlighting of the objects.
     */
    enableHighlighting() {
        this.preSelectionAntialias = this.effectsManager.antialiasing;
        this.effectsManager.setAntialiasing(false);
    }
    /**
     * Highlight the object with the given uuid by giving it an outline.
     * @param uuid uuid of the object.
     * @param objectsGroup Group of objects to be traversed for finding the object
     * with the given uuid.
     */
    highlightObject(uuid, objectsGroup) {
        const object = objectsGroup.getObjectByProperty('uuid', uuid);
        if (object) {
            this.outlinePass.selectedObjects = [object];
            this.activeObject.update(object.uuid);
        }
    }
    /**
     * Disable highlighting of objects.
     */
    disableHighlighting() {
        this.outlinePass.selectedObjects = [];
        this.effectsManager.setAntialiasing(this.preSelectionAntialias);
    }
}
//# sourceMappingURL=selection-manager.js.map