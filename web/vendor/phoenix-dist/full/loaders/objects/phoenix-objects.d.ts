import { Object3D } from 'three';
/**
 * Physics objects that make up an event in Phoenix.
 */
export declare class PhoenixObjects {
    /**
     * Get tracks as three.js obejct.
     * @param tracks Tracks params to construct tacks from.
     * @returns The object containing tracks.
     */
    static getTracks(tracks: any): Object3D;
    /**
     * Create and return a Track object from the given parameters
     * @param trackParams Parameters of the Track.
     * @returns Track object.
     */
    static getTrack(trackParams: any): Object3D;
    /**
     * Create and return a Jet object from the given parameters.
     * @param jetParams Parameters for the Jet.
     * @returns Jet object.
     */
    static getJet(jetParams: any): Object3D;
    /**
     * Create and return a Hits object according to the given parameters.
     * @param hitsParams Either an array of positions, or of Hit objects. If objects, they must contain 'pos', the array of [x,y,z] positions,
     * Can optionally contain extraInfo, which will be added to the resultant hit.
     * `type` tells Phoenix how to draw this - currently can be Point (default), or Line.
     * @returns Hits object.
     */
    static getHits(hitsParams: any): Object3D;
    /**
     * Get a Points object from Hits parameters.
     * @param pointPos Position of the point.
     * @param hitsParams Parameters of the Hit.
     * @param hitParamsClone Cloned parameters of the Hit to avoid object references.
     * @returns A 3D object of type `Points`.
     */
    private static hitsToPoints;
    /**
     * Get a Circular Points object from Hits parameters.
     * @param pointPos Position of the point.
     * @param hitsParams Parameters of the Hit.
     * @param hitParamsClone Cloned parameters of the Hit to avoid object references.
     * @returns A 3D object of type `Points`.
     */
    private static hitsToCircularPoints;
    /**
     * Get a Lines object from Hits parameters.
     * @param pointPos Position of the HIt.
     * @param hitsParams Parameters of the Hit.
     * @param hitParamsClone Cloned parameters of the Hit to avoid object references.
     * @returns A 3D object of type `LineSegments`.
     */
    private static hitsToLines;
    /**
     * Get a Mesh object from Hits parameters. The Mesh is actually a set of boxes, one per hit
     * @param pointPos Positions and dimensions of boxes
     * @param hitsParams Parameters of the Hit.
     * @param hitParamsClone Cloned parameters of the Hit to avoid object references.
     * @returns A 3D object of type `Mesh`.
     */
    private static hitsToBoxes;
    /**
     * Create and return a Cluster object from the given parameters.
     * @param clusterParams Parameters for the Cluster.
     * @param defaultRadius Default cylindrical radius (rho) where to draw barrel Clusters.
     * @param defaultZ Default plane in z where to draw endcap Clusters.
     * @param energyScaling Amount to multiply the energy by to get the depth of the cluster.
     * @returns Cluster object.
     */
    static getCluster(clusterParams: {
        energy: number;
        phi: number;
        eta: number;
        radius?: number;
        z?: number;
        side?: number;
        length?: number;
        color?: string;
        theta?: number;
        uuid?: string;
    }, defaultRadius?: number, defaultZ?: number, energyScaling?: number): Object3D;
    /**
     * Get the position for a Calo hit in cartesian coordinates
     * @param clusterParams Parameters for the Cluster (which must include theta and phi)
     * @param defaultRadius Default cylindrical radius (rho) where to draw barrel Clusters. Ignored if clusterParams contains radius.
     * @param defaultZ Default position along the z axis. Ignored if clusterParams contains z.
     * @param cylindrical If true, if clusterParams do not contain radius and z, then constrain to a cylinder of radius defaultRadius and length z
     * @returns Corrected cartesian position.
     */
    private static getCaloPosition;
    /**
     * Get the cuboid geometry for a Calorimeter hit
     * @param clusterParams  Parameters for the Cluster (can include color)
     * @param defaultCellWidth width of the cuboid
     * @param defaultCellLength length of the cuboid
     * @returns Geometry.
     */
    private static getCaloCube;
    /**
     * Create and return a Calorimeter cell object from the given parameters.
     * @param caloCells Parameters for the CaloCell.
     * @returns Calorimeter Cell object.
     */
    static getCaloCell(caloCellParams: {
        energy: number;
        phi: number;
        eta: number;
        radius?: number;
        z?: number;
        theta?: number;
        color?: string;
        opacity?: number;
        side?: number;
        length?: number;
        uuid: string;
    }): Object3D;
    /**
     * Get the planar calo cells from parameters.
     * @param caloCells Parameters to build planar calo cells.
     * @returns Geometry.
     */
    static getPlanarCaloCells(caloCells: any[]): Object3D;
    /**
     * Create and return a PlanarCaloCell object from the given parameters.
     * @param caloCells Parameters for the Planar Calorimeter.
     * @returns Planar Calorimeter object.
     */
    static getPlanarCaloCell(caloCells: any): Object3D;
    /**
     * Create and return a Vertex object from the given parameters.
     * @param vertexParams Parameters for the Vertex.
     * @returns Vertex object.
     */
    static getVertex(vertexParams: any): Object3D;
    /**
     * Create and return a MET object from the given parameters.
     * @param metParams Parameters for the Vertex.
     * @returns MET object.
     */
    static getMissingEnergy(metParams: any): Object3D;
    /**
     * Type for drawing irregular calorimeter cell comprising 8 xyz vertices in arbitrary geometry.
     * @param irrCells Properties of irregular calo cell.
     * @param irrCells.layer Calorimeter layer
     * @param irrCells.vtx Flattened list of 8 vertex coordinates (24 floats)
     * @param irrCells.color [R,G,B] integer list
     * @param irrCells.opacity value from 0 to 1
     * @returns the cell
     */
    static getIrregularCaloCell(irrCells: {
        type: any;
        layer: number;
        vtx: any;
        color: string;
        opacity: any;
        uuid: any;
    }): Object3D;
}
