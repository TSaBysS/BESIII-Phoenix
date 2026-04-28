import { BufferGeometry, ShaderMaterial, Vector3, type ColorRepresentation, type ShaderMaterialParameters } from 'three';
/**
 * Custom mesh for tracks.
 */
export declare class TracksMesh extends BufferGeometry {
    /** ID of the next track. */
    next_track_id: number;
    /** Positions. */
    positions: number[];
    /** Previous. */
    previous: number[];
    /** Next. */
    next: number[];
    /** Colors. */
    colors: number[];
    /** Counter. */
    counter: number[];
    /** Track ID. */
    track_id: any[];
    /** Side. */
    side: any[];
    /** Indices. */
    indices_array: any[];
    /** Attributes. */
    _attributes: any;
    /**
     * Create the tracks mesh.
     */
    constructor();
    /**
     * Add a track to the tracks mesh.
     * @param points Points for constructing the track.
     * @param color Color of the track.
     * @returns ID of the track.
     */
    addTrack(points: Vector3[], color: ColorRepresentation): number;
    /**
     * Process the track mesh.
     */
    process(): void;
}
/**
 * Custom material for the tracks.
 */
export declare class TracksMaterial extends ShaderMaterial {
    /** If the material is of track. */
    isTracksMaterial: boolean;
    static get type(): string;
    /**
     * Create the tracks material.
     * @param params Params for creating the tracks material.
     */
    constructor(params: ShaderMaterialParameters);
}
