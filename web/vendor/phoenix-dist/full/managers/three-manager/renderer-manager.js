import { WebGLRenderer } from 'three';
/**
 * Manager for managing event display's renderer related functions.
 */
export class RendererManager {
    /**
     * Create the renderer manager by initializing the main renderer.
     */
    constructor() {
        /** A list of all available/created renderers. */
        this.renderers = [];
        const renderer = new WebGLRenderer({
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance',
        });
        this.addRenderer(renderer);
        this.setMainRenderer(renderer);
    }
    /**
     * Initialize the renderer manager by setting up the main renderer.
     * @param elementId ID of the wrapper element.
     */
    init(elementId = 'eventDisplay') {
        // Reset the animation loop
        this.getMainRenderer().setAnimationLoop(null);
        // Main renderer for current browsers
        this.initRenderer(elementId);
    }
    /**
     * Render the overlay.
     * @param scene The event display scene to render.
     * @param camera Camera for render.
     */
    render(scene, camera) {
        if (this.getOverlayRenderer()) {
            if (!this.getOverlayRenderer().domElement.hidden) {
                const sceneColor = scene.background;
                scene.background = null;
                if (!this.isFixedOverlay()) {
                    this.getOverlayRenderer().render(scene, camera);
                }
                scene.background = sceneColor;
            }
        }
    }
    /**
     * Set up the renderer with the DOM.
     * @param elementId ID of the wrapper element.
     */
    initRenderer(elementId) {
        let canvasWrapper = document.getElementById(elementId);
        if (!canvasWrapper) {
            canvasWrapper = document.body;
        }
        const rendererWidth = () => canvasWrapper.offsetWidth > 0
            ? canvasWrapper.offsetWidth
            : window.innerWidth;
        const rendererHeight = () => canvasWrapper.offsetHeight > 0
            ? canvasWrapper.offsetHeight
            : window.innerHeight;
        const mainRenderer = this.getMainRenderer();
        mainRenderer.setSize(rendererWidth(), rendererHeight(), false);
        mainRenderer.setPixelRatio(window.devicePixelRatio);
        mainRenderer.domElement.id = 'three-canvas';
        canvasWrapper.appendChild(this.getMainRenderer().domElement);
        window.addEventListener('resize', () => {
            mainRenderer.setSize(rendererWidth(), rendererHeight());
        });
    }
    // SET/GET
    /**
     * Set the main renderer.
     * @param renderer Three.js WebGLRenderer.
     */
    setMainRenderer(renderer) {
        this.mainRenderer = renderer;
    }
    /**
     * Set the renderer for overlay event display view.
     * @param overlayCanvas Canvas on which the overlay is to be rendered.
     */
    setOverlayRenderer(overlayCanvas) {
        const overlayRenderer = new WebGLRenderer({
            canvas: overlayCanvas,
            antialias: false,
            alpha: true,
        });
        this.addRenderer(overlayRenderer);
        this.overlayRenderer = overlayRenderer;
    }
    /**
     * Set the available renderers.
     * @param renderers List of three.js WebGLRenderers.
     */
    setRenderers(renderers) {
        this.renderers = renderers;
    }
    /**
     * Get the main renderer.
     * @returns The main renderer.
     */
    getMainRenderer() {
        return this.mainRenderer;
    }
    /**
     * Get the renderer used for overlay.
     * @returns The overlay renderer.
     */
    getOverlayRenderer() {
        return this.overlayRenderer;
    }
    /**
     * Get all the available renderers.
     * @returns A list of three.js WebGLRenderers
     */
    getRenderers() {
        return this.renderers;
    }
    // FUNCTIONS
    /**
     * Add a renderer to the available renderers list.
     * @param renderer Three.js WebGLRenderer to be added.
     */
    addRenderer(renderer) {
        if (!this.containsObject(renderer, this.renderers)) {
            this.renderers.push(renderer);
        }
    }
    /**
     * Remove a renderer from the available renderers list.
     * @param renderer Three,js WebGLRenderer to be removed.
     */
    removeControls(renderer) {
        const index = this.renderers.indexOf(renderer);
        if (index > -1) {
            this.renderers.splice(index, 1);
        }
    }
    /**
     * Swap any two renderers.
     * @param rendererA Renderer A to be swapped with renderer B.
     * @param rendererB Renderer B to be swapped with renderer A.
     */
    swapRenderers(rendererA, rendererB) {
        const temp = rendererA;
        rendererA = rendererB;
        rendererB = temp;
    }
    /**
     * Check if the list of available renderers contains a renderer.
     * @param obj The renderer to be checked for containment.
     * @param list List of available renderers.
     * @returns If the list contains the renderer or not.
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
     * Set if local clipping is to be enabled or disabled for all the available renderers.
     * @param value If the local clipping is to be enabled or disabled.
     */
    setLocalClippingEnabled(value) {
        for (const renderer of this.renderers) {
            renderer.localClippingEnabled = value;
        }
    }
    /**
     * Get if the local clipping for the first renderer is enabled or disabled.
     * @returns If the renderer local clipping is enabled or disabled.
     */
    getLocalClipping() {
        if (this.renderers.length > 0) {
            return this.renderers[0].localClippingEnabled;
        }
    }
    /**
     * Check if the overlay is fixed or not.
     * @returns If the overlay is fixed or not.
     */
    isFixedOverlay() {
        return this.fixedOverlay;
    }
    /**
     * Set if the overlay is to be fixed or not.
     * @param value If the overlay is to be fixed or not.
     */
    setFixOverlay(value) {
        this.fixedOverlay = value;
    }
}
//# sourceMappingURL=renderer-manager.js.map