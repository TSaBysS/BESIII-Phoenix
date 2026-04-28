import { Vector3, Quaternion } from 'three';
/**
 * Helper methods for coordinate conversions.
 */
export declare class CoordinateHelper {
    /**
     * Checks if angles are within range: -PI < phi < PI and 0 < theta < 2PI
     * @param theta equatorial angle
     * @param phi azimuthal angle
     * @returns
     */
    static anglesAreSane(theta: number, phi: number): boolean;
    /**
     * Convert pseudorapidity eta to spherical coordinate theta.
     * See definition here: https://en.wikipedia.org/wiki/Pseudorapidity
     * @param eta Pseudorapidity eta to convert to theta.
     * @returns theta in radians
     */
    static etaToTheta(eta: number): number;
    /**
     * Convert spherical theta to pseudorapidity eta.
     * See definition here: https://en.wikipedia.org/wiki/Pseudorapidity
     * @param theta Angle in radians to convert to pseudorapidity eta.
     * @returns pseudorapidity eta
     */
    static thetaToEta(theta: number): number;
    /**
     * Get cartesian from spherical parameters.
     * Applies the necessary rotations to move from threejs to experimental.
     * @param radius The radius.
     * @param theta Theta angle.
     * @param phi Phi angle.
     */
    static sphericalToCartesian(radius: number, theta: number, phi: number): Vector3;
    /**
     * Get cartesian from eta/phi parameters.
     * Applies the necessary rotations to move from threejs native to experimental.
     * @param radius The radius.
     * @param eta Pseudorapidity
     * @param phi Phi angle.
     */
    static etaPhiToCartesian(radius: number, eta: number, phi: number): Vector3;
    /**
     * Returns the Quaternion to rotate to ATLAS coords.
     * Temporary. We will need to make this configurable per experiment.
     */
    static atlasQuaternion(): Quaternion;
}
