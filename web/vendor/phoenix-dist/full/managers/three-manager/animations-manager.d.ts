import { Easing, Tween } from '@tweenjs/tween.js';
import { Vector3, Color, Scene, Camera } from 'three';
import { RendererManager } from './renderer-manager';
/** Type for animation preset. */
export interface AnimationPreset {
    /** Positions with duration and easing of each tween forming a path. */
    positions: {
        position: number[];
        duration: number;
        easing?: any;
    }[];
    /** Time after which to start the event collision animation. */
    animateEventAfterInterval?: number;
    /** Duration of the event collision. */
    collisionDuration?: number;
    /** Name of the Animation */
    name: string;
}
/**
 * Manager for managing animation related operations using three.js and tween.js.
 */
export declare class AnimationsManager {
    private scene;
    private activeCamera;
    private rendererManager;
    /**
     * Constructor for the animation manager.
     * @param scene Three.js scene containing all the objects and event data.
     * @param activeCamera Currently active camera.
     * @param rendererManager Manager for managing event display's renderer related functions.
     */
    constructor(scene: Scene, activeCamera: Camera, rendererManager: RendererManager);
    /**
     * Get the camera tween for animating camera to a position.
     * @param pos End position of the camera tween.
     * @param duration Duration of the tween.
     * @param easing Animation easing of the tween if any.
     * @returns Tween object of the camera animation.
     */
    getCameraTween(pos: number[], duration?: number, easing?: typeof Easing.Linear.None): Tween<Vector3>;
    /**
     * Animate the camera through the event scene.
     * @param startPos Start position of the translation animation.
     * @param tweenDuration Duration of each tween in the translation animation.
     * @param onAnimationEnd Callback when the last animation ends.
     */
    animateThroughEvent(startPos: number[], tweenDuration: number, onAnimationEnd?: () => void): void;
    /**
     * Animate the propagation and generation of event data.
     * @param tweenDuration Duration of the animation tween.
     * @param onEnd Callback when all animations have ended.
     * @param onAnimationStart Callback when the first animation starts.
     */
    animateEvent(tweenDuration: number, onEnd?: () => void, onAnimationStart?: () => void): void;
    /**
     * Animate the propagation and generation of event data using clipping planes.
     * @param tweenDuration Duration of the animation tween.
     * @param onEnd Function to call when all animations have ended.
     * @param onAnimationStart Callback when the first animation starts.
     * @param clippingConstant Constant for the clipping planes for distance from the origin.
     */
    animateEventWithClipping(tweenDuration: number, onEnd?: () => void, onAnimationStart?: () => void, clippingConstant?: number): void;
    /**
     * Animate the collision of two particles.
     * @param tweenDuration Duration of the particle collision animation tween.
     * @param particleSize Size of the particles.
     * @param distanceFromOrigin Distance of the particles (along z-axes) from the origin.
     * @param particleColor Color of the particles.
     * @param onEnd Callback to call when the particle collision ends.
     */
    collideParticles(tweenDuration: number, particleSize?: number, distanceFromOrigin?: number, particleColor?: Color, onEnd?: () => void): void;
    /**
     * Animate the propagation and generation of event data with particle collison.
     * @param animationFunction Animation function to call after collision.
     * @param tweenDuration Duration of the animation tween.
     * @param onEnd Function to call when all animations have ended.
     */
    animateWithCollision(animationFunction: (tweenDuration: number, onEnd?: () => void, onAnimationStart?: () => void) => void, tweenDuration: number, onEnd?: () => void): void;
    /**
     * Animate the propagation and generation of event data with particle collison.
     * @param tweenDuration Duration of the animation tween.
     * @param onEnd Function to call when all animations have ended.
     */
    animateEventWithCollision(tweenDuration: number, onEnd?: () => void): void;
    /**
     * Animate the propagation and generation of event data
     * using clipping planes after particle collison.
     * @param tweenDuration Duration of the animation tween.
     * @param onEnd Function to call when all animations have ended.
     */
    animateClippingWithCollision(tweenDuration: number, onEnd?: () => void): void;
    /**
     * Get the positions of hits in a multidimensional array
     * from a single dimensional array.
     * @param positions Positions of hits in a single dimensional array.
     * @returns Positions of hits in a multidimensional array.
     */
    private getHitsPositions;
    /**
     * Animate scene by animating camera through the scene and animating event collision.
     * @param animationPreset Preset for animation including positions to go through and
     * event collision animation options.
     * @param onEnd Function to call when the animation ends.
     */
    animatePreset(animationPreset: AnimationPreset, onEnd?: () => void): void;
}
