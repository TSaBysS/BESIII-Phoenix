import { Vector3 } from 'three';
/**
 * Class for performing Runge-Kutta operations.
 */
export class RungeKutta {
    /**
     * Perform a Runge-Kutta step for the given state.
     * @param state State at which the step is to be performed.
     * @returns The computed step size.
     */
    static step(state) {
        // Charge (q) to momentum (p) ratio in SI units
        const qop = state.q / (state.unitC * state.p);
        // Runge-Kutta integrator state
        let h2, half_h, B_middle, B_last, k2 = new Vector3(), k3 = new Vector3(), k4 = new Vector3();
        // First Runge-Kutta point (at current position)
        const B_first = Field.get(state.pos);
        // state.dir.cross(B_first) * qop
        const k1 = state.dir.clone().cross(B_first).multiplyScalar(qop);
        // Try Runge-Kutta step with h as the step size
        const tryRungeKuttaStep = (h) => {
            h2 = h * h;
            half_h = h / 2;
            // Second Runge-Kutta point
            // state.pos + state.dir * half_h + k1 * (h2 / 8)
            const pos1 = state.pos
                .clone()
                .add(state.dir.clone().multiplyScalar(half_h))
                .add(k1.clone().multiplyScalar(h2 / 8));
            B_middle = Field.get(pos1);
            // (state.dir + k1 * half_h).cross(B_middle) * qop
            k2 = state.dir
                .clone()
                .add(k1.clone().multiplyScalar(half_h))
                .cross(B_middle)
                .multiplyScalar(qop);
            // Third Runge-Kutta point
            // (state.dir + k2 * half_h).cross(B_middle) * qop
            k3 = state.dir
                .clone()
                .add(k2.clone().multiplyScalar(half_h))
                .cross(B_middle)
                .multiplyScalar(qop);
            // Last Runge-Kutta point
            // state.pos + state.dir * h + k3 * (h2 / 2)
            const pos2 = state.pos
                .clone()
                .add(state.dir.clone().multiplyScalar(h))
                .add(k3.clone().multiplyScalar(h2 / 2));
            B_last = Field.get(pos2);
            // (state.dir + k3 * h).cross(B_last) * qop
            k4 = state.dir
                .clone()
                .add(k3.clone().multiplyScalar(h))
                .cross(B_last)
                .multiplyScalar(qop);
            // (k1 - k2 - k3 + k4)
            const returnVec = k1.clone().sub(k2).sub(k3).add(k4);
            // h * (k1 - k2 - k3 + k4).lpNorm()
            return (h *
                (Math.abs(returnVec.x) + Math.abs(returnVec.y) + Math.abs(returnVec.z)));
        };
        // Checking the error estimate
        let error_estimate = tryRungeKuttaStep(state.stepSize);
        while (error_estimate > 0.0002) {
            state.stepSize *= 0.5;
            error_estimate = tryRungeKuttaStep(state.stepSize);
        }
        const fh = state.stepSize;
        const fh2 = Math.pow(fh, 2);
        // Update position and momentum
        // state.pos += state.dir * fh + (k1 + k2 + k3) * (fh2 /6)
        state.pos.add(state.dir.clone().multiplyScalar(fh)).add(k1
            .clone()
            .add(k2)
            .add(k3)
            .multiplyScalar(fh2 / 6));
        // state.dir += (k1 + k2 * 2 + k3 * 2 + k4) * (fh / 6)
        state.dir.add(k1
            .clone()
            .add(k2.clone().multiplyScalar(2))
            .add(k3.clone().multiplyScalar(2))
            .add(k4)
            .multiplyScalar(fh / 6));
        state.dir.normalize();
        return state.stepSize;
    }
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
    static propagate(startPos, startDir, p, q, mss = -1, plength = 1000, inbounds = () => true) {
        const rkState = new State();
        rkState.pos = startPos;
        rkState.dir = startDir;
        rkState.p = p;
        rkState.q = q;
        rkState.maxStepSize = mss;
        const result = [];
        while (rkState.pathLength < plength) {
            rkState.pathLength += RungeKutta.step(rkState);
            // Cloning state to avoid using the reference
            const copiedState = JSON.parse(JSON.stringify(rkState));
            result.push({
                pos: copiedState.pos,
                dir: copiedState.dir,
            });
            // Check if the position is inbounds
            if (!inbounds(copiedState.pos)) {
                // Truncating at position copiedState.pos
                break;
            }
        }
        return result;
    }
}
/**
 * State of the particle.
 */
export class State {
    constructor() {
        /** Position. */
        this.pos = new Vector3(0, 0, 0);
        /** Direction. */
        this.dir = new Vector3(0, 0, 0);
        /** Momentum. */
        this.p = 0;
        /** Charge. */
        this.q = 1;
        /** Unit. */
        this.unitC = 3.3333;
        /** Step size. */
        this.stepSize = 1000;
        /** Max step size. */
        this.maxStepSize = 10;
        /** Path length.. */
        this.pathLength = 0;
    }
}
/**
 *  Default class to define the field.
 */
class Field {
    /**
     * Returns field as a Vector3 in Tesla.
     */
    static get(field) {
        return new Vector3(0, 0, 2);
    }
}
//# sourceMappingURL=runge-kutta.js.map