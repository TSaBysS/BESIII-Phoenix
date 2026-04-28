import { Object3D, Plane } from 'three';
import type { GeometryUIParameters } from '../../lib/types/geometry-ui-parameters';
/**
 * Manager for managing event display's import related functionality.
 */
export declare class ImportManager {
    /** Planes for clipping geometry. */
    private clipPlanes;
    /** Object group ID containing event data. */
    private EVENT_DATA_ID;
    /** Object group ID containing detector geometries. */
    private GEOMETRIES_ID;
    /**
     * Constructor for the import manager.
     * @param clipPlanes Planes for clipping geometry.
     * @param EVENT_DATA_ID Object group ID containing event data.
     * @param GEOMETRIES_ID Object group ID containing detector geometries.
     */
    constructor(clipPlanes: Plane[], EVENT_DATA_ID: string, GEOMETRIES_ID: string);
    /**
     * Loads an OBJ (.obj) geometry from the given filename.
     * @param filename Path to the geometry.
     * @param name Name given to the geometry.
     * @param color Color to initialize the geometry.
     * @param doubleSided Renders both sides of the material.
     * @param setFlat Whether object should be flat-shaded or not.
     * @returns Promise for loading the geometry.
     */
    loadOBJGeometry(filename: string, name: string, color: any, doubleSided: boolean, setFlat: boolean): Promise<GeometryUIParameters>;
    /**
     * Parses and loads a geometry in OBJ (.obj) format.
     * @param geometry Geometry in OBJ (.obj) format.
     * @param name Name given to the geometry.
     * @returns The processed object.
     */
    parseOBJGeometry(geometry: string, name: string): Object3D;
    /**
     * Process the geometry object being loaded from OBJ (.obj) format.
     * @param object 3D object.
     * @param name Name of the object.
     * @param color Color of the object.
     * @param doubleSided Renders both sides of the material.
     * @param setFlat Whether object should be flat-shaded or not.
     * @returns The processed object.
     */
    private processOBJ;
    /**
     * Process the 3D object and flatten it.
     * @param object3d Group of geometries that make up the object.
     * @param color Color of the object.
     * @param doubleSided Renders both sides of the material.
     * @param setFlat Whether object should be flat-shaded or not.
     * @returns The processed object.
     */
    private setObjFlat;
    /**
     * Parses and loads a scene in Phoenix (.phnx) format.
     * @param scene Geometry in Phoenix (.phnx) format.
     * @param callback Callback called after the scene is loaded.
     * @returns Promise for loading the scene.
     */
    parsePhnxScene(scene: any, callback: (geometries?: Object3D, eventData?: Object3D) => void): Promise<void>;
    /**
     * handles some file content and loads a Geometry contained..
     * It deals with zip file cases and then
     * calls the given method on each file found
     * @param path path of the original file
     * @param filename name of the original file
     * @param data content of the original file
     * @param callback the method to be called on each file content
     * @param resolve the method to be called on success
     * @param reject the method to be called on failure
     */
    private zipHandlingInternal;
    /**
     * Wraps a method taking a file and returning a Promise for
     * loading a Geometry. It deals with zip file cases and then
     * calls the original method on each file found
     * @param file the original file
     * @param callback the original method
     * @returns Promise for loading the geometry.
     */
    private zipHandlingFileWrapper;
    /**
     * Wraps a method taking a URL and returning a Promise for
     * loading a Geometry. It deals with zip file cases and then
     * calls the original method on each file found
     * @param file the original file
     * @param callback the original method
     * @returns Promise for loading the geometry.
     */
    private zipHandlingURLWrapper;
    /**
     * Loads a GLTF (.gltf,.glb) scene(s)/geometry from the given URL.
     * also support zipped versions of the files
     * @param sceneUrl URL to the GLTF (.gltf/.glb or a zip with such file(s)) file.
     * @param name Name of the loaded scene/geometry if a single scene is present, ignored if several scenes are present.
     * @param menuNodeName Path to the node in Phoenix menu to add the geometry to. Use `>` as a separator.
     * @param scale Scale of the geometry.
     * @param initiallyVisible Whether the geometry is initially visible or not.
     * @returns Promise for loading the geometry.
     */
    loadGLTFGeometry(sceneUrl: string, name: string, menuNodeName: string, scale: number, initiallyVisible: boolean): Promise<GeometryUIParameters[]>;
    /**
     * Loads a GLTF (.gltf) scene(s)/geometry from the given ArrayBuffer.
     * @param sceneData ArrayBuffer containing the geometry file's content (gltf or glb data)
     * @param path The base path from which to find subsequent glTF resources such as textures and .bin data files
     * @param name Name of the loaded scene/geometry if a single scene is present, ignored if several scenes are present.
     * @param menuNodeName Path to the node in Phoenix menu to add the geometry to. Use `>` as a separator.
     * @param scale Scale of the geometry.
     * @param initiallyVisible Whether the geometry is initially visible or not.
     * @returns Promise for loading the geometry.
     */
    private loadGLTFGeometryInternal;
    /** Parses and loads a geometry in GLTF (.gltf,.glb) format.
     * Also supports zip versions of those
     * @param fileName of the geometry file (.gltf,.glb or a zip with such file(s))
     * @returns Promise for loading the geometry.
     */
    parseGLTFGeometry(file: File): Promise<GeometryUIParameters[]>;
    /** Parses and loads a geometry in GLTF (.gltf) format.
     * @param geometry ArrayBuffer containing the geometry file's content (gltf or glb data)
     * @param path The base path from which to find subsequent glTF resources such as textures and .bin data files
     * @param name Name given to the geometry.
     * @returns Promise for loading the geometry.
     */
    private parseGLTFGeometryFromArrayBuffer;
    /**
     * Get geometry name and menuNodeName from GLTF scene name.
     * @param sceneName GLTF scene name.
     * @param menuNodeName Path to the node in Phoenix menu to add the geometry to. Use `>` as a separator.
     * @returns Geometry name and menuNodeName if present in scene name.
     */
    private processGLTFSceneName;
    /**
     * Loads geometries from JSON.
     * @param json JSON or URL to JSON file of the geometry.
     * @param name Name of the geometry or group of geometries.
     * @param scale Scale of the geometry.
     * @param doubleSided Renders both sides of the material.
     * @returns Promise for loading the geometry.
     */
    loadJSONGeometry(json: string | {
        [key: string]: any;
    }, name: string, scale?: number, doubleSided?: boolean): Promise<GeometryUIParameters>;
    /**
     * Process the geometry by setting up material and clipping attributes.
     * @param geometry Geometry to be processed.
     * @param name Name of the geometry.
     * @param scale Scale of the geometry.
     * @param doubleSided Renders both sides of the material.
     * @param transparent Whether the transparent property of geometry is true or false. Default `false`.
     */
    private processGeometry;
    /**
     * Get the size of object.
     * @param object Object to get the size of.
     * @returns The size (vector) of object as a string.
     */
    private getObjectSize;
}
