import { Vector3 } from 'three';
/**
 * Class for performing Runge-Kutta operations.
 */
export declare class RungeKutta {
    /**
     * Perform a Runge-Kutta step for the given state.
     * @param state State at which the step is to be performed.
     * @returns The computed step size.
     */
    static step(state: State): number;
    /**
     * Propagate using the given properties by performing the Runge-Kutta steps.
     * @param startPos Starting position in 3D space.
     * @param startDir Starting direction in 3D space.
     * @param p Momentum.
     * @param q Charge.
     * @param mss Max step size.
     * @param plength Path length.
     * @param inbounds Function which returns true until the passed position
     * is out of bounds, when it returns false.
     * @returns An array containing position and direction at that position calculated
     * through the Runge-Kutta steps.
     */
    static propagate(startPos: Vector3, startDir: Vector3, p: number, q: number, mss?: number, plength?: number, inbounds?: (pos: Vector3) => boolean): {
        pos: Vector3;
        dir: Vector3;
    }[];
}
/**
 * State of the particle.
 */
export declare class State {
    /** Position. */
    pos: Vector3;
    /** Direction. */
    dir: Vector3;
    /** Momentum. */
    p: number;
    /** Charge. */
    q: number;
    /** Unit. */
    unitC: number;
    /** Step size. */
    stepSize: number;
    /** Max step size. */
    maxStepSize: number;
    /** Path length.. */
    pathLength: number;
}
