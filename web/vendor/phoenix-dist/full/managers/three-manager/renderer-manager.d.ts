import { WebGLRenderer, Scene, Camera } from 'three';
/**
 * Manager for managing event display's renderer related functions.
 */
export declare class RendererManager {
    /** Main renderer to be used by the event display. */
    private mainRenderer;
    /** Overlay renderer for rendering a secondary overlay canvas. */
    private overlayRenderer;
    /** A list of all available/created renderers. */
    private renderers;
    /** If the overlay is fixed or not. */
    private fixedOverlay;
    /**
     * Create the renderer manager by initializing the main renderer.
     */
    constructor();
    /**
     * Initialize the renderer manager by setting up the main renderer.
     * @param elementId ID of the wrapper element.
     */
    init(elementId?: string): void;
    /**
     * Render the overlay.
     * @param scene The event display scene to render.
     * @param camera Camera for render.
     */
    render(scene: Scene, camera: Camera): void;
    /**
     * Set up the renderer with the DOM.
     * @param elementId ID of the wrapper element.
     */
    private initRenderer;
    /**
     * Set the main renderer.
     * @param renderer Three.js WebGLRenderer.
     */
    setMainRenderer(renderer: WebGLRenderer): void;
    /**
     * Set the renderer for overlay event display view.
     * @param overlayCanvas Canvas on which the overlay is to be rendered.
     */
    setOverlayRenderer(overlayCanvas: HTMLCanvasElement): void;
    /**
     * Set the available renderers.
     * @param renderers List of three.js WebGLRenderers.
     */
    setRenderers(renderers: WebGLRenderer[]): void;
    /**
     * Get the main renderer.
     * @returns The main renderer.
     */
    getMainRenderer(): WebGLRenderer;
    /**
     * Get the renderer used for overlay.
     * @returns The overlay renderer.
     */
    getOverlayRenderer(): WebGLRenderer;
    /**
     * Get all the available renderers.
     * @returns A list of three.js WebGLRenderers
     */
    getRenderers(): WebGLRenderer[];
    /**
     * Add a renderer to the available renderers list.
     * @param renderer Three.js WebGLRenderer to be added.
     */
    addRenderer(renderer: WebGLRenderer): void;
    /**
     * Remove a renderer from the available renderers list.
     * @param renderer Three,js WebGLRenderer to be removed.
     */
    removeControls(renderer: WebGLRenderer): void;
    /**
     * Swap any two renderers.
     * @param rendererA Renderer A to be swapped with renderer B.
     * @param rendererB Renderer B to be swapped with renderer A.
     */
    swapRenderers(rendererA: WebGLRenderer, rendererB: WebGLRenderer): void;
    /**
     * Check if the list of available renderers contains a renderer.
     * @param obj The renderer to be checked for containment.
     * @param list List of available renderers.
     * @returns If the list contains the renderer or not.
     */
    private containsObject;
    /**
     * Set if local clipping is to be enabled or disabled for all the available renderers.
     * @param value If the local clipping is to be enabled or disabled.
     */
    setLocalClippingEnabled(value: boolean): void;
    /**
     * Get if the local clipping for the first renderer is enabled or disabled.
     * @returns If the renderer local clipping is enabled or disabled.
     */
    getLocalClipping(): boolean;
    /**
     * Check if the overlay is fixed or not.
     * @returns If the overlay is fixed or not.
     */
    isFixedOverlay(): boolean;
    /**
     * Set if the overlay is to be fixed or not.
     * @param value If the overlay is to be fixed or not.
     */
    setFixOverlay(value: boolean): void;
}
