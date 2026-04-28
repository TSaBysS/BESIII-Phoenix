import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { Camera, Scene, WebGLRenderer } from 'three';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';
import { Pass } from 'three/examples/jsm/postprocessing/Pass.js';
/**
 * Manager for managing three.js event display effects like outline pass and unreal bloom.
 */
export declare class EffectsManager {
    /** Effect composer for effect passes. */
    composer: EffectComposer;
    /** The camera inside the scene. */
    private camera;
    /** The default scene used for event display. */
    private scene;
    /** Render pass for rendering the default scene. */
    private defaultRenderPass;
    /** Whether antialiasing is enabled or disabled. */
    antialiasing: boolean;
    /** Render function with (normal render) or without antialias (effects render). */
    render: (scene: Scene, camera: Camera) => void;
    /**
     * Constructor for the effects manager which manages effects and three.js passes.
     * @param camera The camera inside the scene.
     * @param scene The default scene used for event display.
     * @param renderer The main renderer used by the event display.
     */
    constructor(camera: Camera, scene: Scene, renderer: WebGLRenderer);
    /**
     * Render the effects composer.
     * @param scene The default scene used for event display.
     * @param camera The camera inside the scene.
     */
    private effectsRender;
    /**
     * Render for antialias without the effects composer.
     * @param scene The default scene used for event display.
     * @param camera The camera inside the scene.
     */
    private antialiasRender;
    /**
     * Initialize the outline pass for highlighting hovered over event display elements.
     * @returns OutlinePass for highlighting hovered over event display elements.
     */
    addOutlinePassForSelection(): OutlinePass;
    /**
     * Remove a pass from the effect composer.
     * @param pass Effect pass to be removed from the effect composer.
     */
    removePass(pass: Pass): void;
    /**
     * Set the antialiasing of renderer.
     * @param antialias Whether antialiasing is to enabled or disabled.
     */
    setAntialiasing(antialias: boolean): void;
}
