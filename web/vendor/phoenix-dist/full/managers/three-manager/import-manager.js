import { DoubleSide, Mesh, LineSegments, LineBasicMaterial, MeshPhongMaterial, Material, ObjectLoader, FrontSide, Vector3, Matrix4, REVISION, } from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import JSZip from 'jszip';
/**
 * Manager for managing event display's import related functionality.
 */
export class ImportManager {
    /**
     * Constructor for the import manager.
     * @param clipPlanes Planes for clipping geometry.
     * @param EVENT_DATA_ID Object group ID containing event data.
     * @param GEOMETRIES_ID Object group ID containing detector geometries.
     */
    constructor(clipPlanes, EVENT_DATA_ID, GEOMETRIES_ID) {
        this.clipPlanes = clipPlanes;
        this.EVENT_DATA_ID = EVENT_DATA_ID;
        this.GEOMETRIES_ID = GEOMETRIES_ID;
    }
    /**
     * Loads an OBJ (.obj) geometry from the given filename.
     * @param filename Path to the geometry.
     * @param name Name given to the geometry.
     * @param color Color to initialize the geometry.
     * @param doubleSided Renders both sides of the material.
     * @param setFlat Whether object should be flat-shaded or not.
     * @returns Promise for loading the geometry.
     */
    loadOBJGeometry(filename, name, color, doubleSided, setFlat) {
        color = color ?? 0x41a6f4;
        const objLoader = new OBJLoader();
        return new Promise((resolve, reject) => {
            objLoader.load(filename, (object) => {
                const processedObject = this.processOBJ(object, name, color, doubleSided, setFlat);
                resolve({ object: processedObject });
            }, () => { }, (error) => {
                reject(error);
            });
        });
    }
    /**
     * Parses and loads a geometry in OBJ (.obj) format.
     * @param geometry Geometry in OBJ (.obj) format.
     * @param name Name given to the geometry.
     * @returns The processed object.
     */
    parseOBJGeometry(geometry, name) {
        const objLoader = new OBJLoader();
        const object = objLoader.parse(geometry);
        return this.processOBJ(object, name, 0x41a6f4, false, false);
    }
    /**
     * Process the geometry object being loaded from OBJ (.obj) format.
     * @param object 3D object.
     * @param name Name of the object.
     * @param color Color of the object.
     * @param doubleSided Renders both sides of the material.
     * @param setFlat Whether object should be flat-shaded or not.
     * @returns The processed object.
     */
    processOBJ(object, name, color, doubleSided, setFlat) {
        object.name = name;
        object.userData = { name };
        return this.setObjFlat(object, color, doubleSided, setFlat);
    }
    /**
     * Process the 3D object and flatten it.
     * @param object3d Group of geometries that make up the object.
     * @param color Color of the object.
     * @param doubleSided Renders both sides of the material.
     * @param setFlat Whether object should be flat-shaded or not.
     * @returns The processed object.
     */
    setObjFlat(object3d, color, doubleSided, setFlat) {
        const material2 = new MeshPhongMaterial({
            color: color,
            shininess: 0,
            wireframe: false,
            clippingPlanes: this.clipPlanes,
            clipIntersection: true,
            clipShadows: false,
            side: doubleSided ? DoubleSide : FrontSide,
            flatShading: setFlat,
        });
        object3d.traverse((child) => {
            if (child instanceof Mesh) {
                child.name = object3d.name;
                child.userData = object3d.userData;
                child.userData.size = this.getObjectSize(child);
                // Use the new material
                if (child.material instanceof Material) {
                    child.material.dispose();
                    child.material = material2;
                }
                // enable casting shadows
                child.castShadow = false;
                child.receiveShadow = false;
            }
            else {
                if (child instanceof LineSegments &&
                    child.material instanceof LineBasicMaterial) {
                    child.material.color.set(color);
                }
            }
        });
        return object3d;
    }
    /**
     * Parses and loads a scene in Phoenix (.phnx) format.
     * @param scene Geometry in Phoenix (.phnx) format.
     * @param callback Callback called after the scene is loaded.
     * @returns Promise for loading the scene.
     */
    parsePhnxScene(scene, callback) {
        const loader = new GLTFLoader();
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath(`https://cdn.jsdelivr.net/npm/three@0.${REVISION}.0/examples/jsm/libs/draco/`);
        loader.setDRACOLoader(dracoLoader);
        const sceneString = JSON.stringify(scene, null, 2);
        return new Promise((resolve, reject) => {
            loader.parse(sceneString, '', (gltf) => {
                const eventData = gltf.scene.getObjectByName(this.EVENT_DATA_ID);
                const geometries = gltf.scene.getObjectByName(this.GEOMETRIES_ID);
                callback(eventData, geometries);
                resolve();
            }, (error) => {
                reject(error);
            });
        });
    }
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
    zipHandlingInternal(path, filename, data, callback, resolve, reject) {
        if (filename.split('.').pop() == 'zip') {
            JSZip.loadAsync(data).then((archive) => {
                const promises = [];
                for (const filePath in archive.files) {
                    promises.push(archive
                        .file(filePath)
                        .async('arraybuffer')
                        .then((fileData) => {
                        return callback(fileData, path, filePath.split('.')[0]);
                    }));
                }
                let allGeometriesUIParameters = [];
                Promise.all(promises).then((geos) => {
                    geos.forEach((geo) => {
                        allGeometriesUIParameters = allGeometriesUIParameters.concat(geo);
                    });
                    resolve(allGeometriesUIParameters);
                });
            });
        }
        else {
            callback(data, path, filename.split('.')[0]).then((geo) => {
                resolve(geo);
            }, (error) => {
                reject(error);
            });
        }
    }
    /**
     * Wraps a method taking a file and returning a Promise for
     * loading a Geometry. It deals with zip file cases and then
     * calls the original method on each file found
     * @param file the original file
     * @param callback the original method
     * @returns Promise for loading the geometry.
     */
    zipHandlingFileWrapper(file, callback) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                this.zipHandlingInternal('', file.name, reader.result, callback, resolve, reject);
            };
            reader.readAsArrayBuffer(file);
        });
    }
    /**
     * Wraps a method taking a URL and returning a Promise for
     * loading a Geometry. It deals with zip file cases and then
     * calls the original method on each file found
     * @param file the original file
     * @param callback the original method
     * @returns Promise for loading the geometry.
     */
    zipHandlingURLWrapper(file, callback) {
        return new Promise((resolve, reject) => {
            fetch(file).then((response) => {
                return response.arrayBuffer().then((data) => {
                    this.zipHandlingInternal(file.substr(0, file.lastIndexOf('/')), file, data, callback, resolve, reject);
                });
            });
        });
    }
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
    loadGLTFGeometry(sceneUrl, name, menuNodeName, scale, initiallyVisible) {
        return this.zipHandlingURLWrapper(sceneUrl, (data, path, ignoredName) => {
            return this.loadGLTFGeometryInternal(data, path, name, menuNodeName, scale, initiallyVisible);
        });
    }
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
    loadGLTFGeometryInternal(sceneData, path, name, menuNodeName, scale, initiallyVisible) {
        const loader = new GLTFLoader();
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath(`https://cdn.jsdelivr.net/npm/three@0.${REVISION}.0/examples/jsm/libs/draco/`);
        loader.setDRACOLoader(dracoLoader);
        return new Promise((resolve, reject) => {
            loader.parse(sceneData, path, (gltf) => {
                const allGeometries = [];
                for (const scene of gltf.scenes) {
                    scene.visible = scene.userData.visible ?? initiallyVisible;
                    const sceneName = this.processGLTFSceneName(scene.name, menuNodeName);
                    const materials = {};
                    const findMeshes = (node, parentMatrix, depth) => {
                        const mat = parentMatrix.clone().multiply(node.matrix);
                        if (node instanceof Mesh) {
                            const key = node.material.id; // ts don't recognize material and prevent compilation...
                            if (!materials[key])
                                materials[key] = {
                                    material: node.material, // Can be Material[], but not sure this is ever still used.
                                    geoms: [],
                                    renderOrder: -depth,
                                };
                            materials[key].geoms.push(node.geometry.clone().applyMatrix4(mat));
                        }
                        for (const obj of node.children) {
                            findMeshes(obj, mat, depth + 1);
                        }
                    };
                    findMeshes(scene, new Matrix4(), 0);
                    // Improve renderorder for transparent materials
                    scene.remove(...scene.children);
                    for (const val of Object.values(materials)) {
                        const mesh = new Mesh(BufferGeometryUtils.mergeGeometries(val.geoms), val.material);
                        mesh.renderOrder = val.renderOrder;
                        scene.add(mesh);
                    }
                    this.processGeometry(scene, name ?? sceneName?.name, scale, true);
                    allGeometries.push({
                        object: scene,
                        menuNodeName: menuNodeName ?? sceneName?.menuNodeName,
                    });
                }
                resolve(allGeometries);
            }, (error) => {
                reject(error);
            });
        });
    }
    /** Parses and loads a geometry in GLTF (.gltf,.glb) format.
     * Also supports zip versions of those
     * @param fileName of the geometry file (.gltf,.glb or a zip with such file(s))
     * @returns Promise for loading the geometry.
     */
    parseGLTFGeometry(file) {
        return this.zipHandlingFileWrapper(file, (data, path, name) => {
            return this.parseGLTFGeometryFromArrayBuffer(data, path, name);
        });
    }
    /** Parses and loads a geometry in GLTF (.gltf) format.
     * @param geometry ArrayBuffer containing the geometry file's content (gltf or glb data)
     * @param path The base path from which to find subsequent glTF resources such as textures and .bin data files
     * @param name Name given to the geometry.
     * @returns Promise for loading the geometry.
     */
    parseGLTFGeometryFromArrayBuffer(geometry, path, name) {
        const loader = new GLTFLoader();
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath(`https://cdn.jsdelivr.net/npm/three@0.${REVISION}.0/examples/jsm/libs/draco/`);
        loader.setDRACOLoader(dracoLoader);
        return new Promise((resolve, reject) => {
            loader.parse(geometry, path, (gltf) => {
                const allGeometriesUIParameters = [];
                for (const scene of gltf.scenes) {
                    scene.visible = scene.userData.visible;
                    console.log('Dealing with scene ', scene.name);
                    const sceneName = this.processGLTFSceneName(scene.name);
                    this.processGeometry(scene, sceneName?.name ?? name);
                    allGeometriesUIParameters.push({
                        object: scene,
                        menuNodeName: sceneName?.menuNodeName,
                    });
                }
                resolve(allGeometriesUIParameters);
            }, (error) => {
                reject(error);
            });
        });
    }
    /**
     * Get geometry name and menuNodeName from GLTF scene name.
     * @param sceneName GLTF scene name.
     * @param menuNodeName Path to the node in Phoenix menu to add the geometry to. Use `>` as a separator.
     * @returns Geometry name and menuNodeName if present in scene name.
     */
    processGLTFSceneName(sceneName, menuNodeName) {
        if (sceneName) {
            const nodes = sceneName.split('_>_');
            menuNodeName && nodes.unshift(menuNodeName); // eslint-disable-line
            const fullNodeName = nodes.join(' > ');
            nodes.pop();
            const menuName = nodes.join(' > ');
            return { name: fullNodeName, menuNodeName: menuName };
        }
    }
    /**
     * Loads geometries from JSON.
     * @param json JSON or URL to JSON file of the geometry.
     * @param name Name of the geometry or group of geometries.
     * @param scale Scale of the geometry.
     * @param doubleSided Renders both sides of the material.
     * @returns Promise for loading the geometry.
     */
    loadJSONGeometry(json, name, scale, doubleSided) {
        const loader = new ObjectLoader();
        switch (typeof json) {
            case 'string':
                return new Promise((resolve, reject) => {
                    loader.load(json, (object) => {
                        this.processGeometry(object, name, scale, doubleSided);
                        resolve({ object });
                    }, undefined, (error) => {
                        reject(error);
                    });
                });
            case 'object':
                return new Promise((resolve) => {
                    const object = loader.parse(json);
                    this.processGeometry(object, name, scale, doubleSided);
                    resolve({ object });
                });
        }
    }
    /**
     * Process the geometry by setting up material and clipping attributes.
     * @param geometry Geometry to be processed.
     * @param name Name of the geometry.
     * @param scale Scale of the geometry.
     * @param doubleSided Renders both sides of the material.
     * @param transparent Whether the transparent property of geometry is true or false. Default `false`.
     */
    processGeometry(geometry, name, scale, doubleSided) {
        geometry.name = name;
        // Set a custom scale if provided
        if (scale) {
            geometry.scale.setScalar(scale);
        }
        geometry.traverse((child) => {
            if (child instanceof Mesh) {
                child.name = child.userData.name = name;
                child.userData.size = this.getObjectSize(child);
                if (child.material instanceof Material) {
                    const mat = child.material;
                    const color = 'color' in mat ? mat.color.getHex() : 0x2fd691;
                    const side = doubleSided ? DoubleSide : child.material['side'];
                    // Disposing of the default material
                    child.material.dispose();
                    // Should tranparency be used?
                    let isTransparent = false;
                    if (geometry.userData.opacity) {
                        isTransparent = true;
                    }
                    // Changing to a material with 0 shininess
                    child.material = new MeshPhongMaterial({
                        color,
                        shininess: 0,
                        side: side,
                        transparent: isTransparent,
                        opacity: geometry.userData.opacity ?? 1,
                    });
                    // Setting up the clipping planes
                    child.material.clippingPlanes = this.clipPlanes;
                    child.material.clipIntersection = true;
                    child.material.clipShadows = false;
                }
            }
        });
    }
    /**
     * Get the size of object.
     * @param object Object to get the size of.
     * @returns The size (vector) of object as a string.
     */
    getObjectSize(object) {
        const size = new Vector3();
        object.geometry.computeBoundingBox();
        object.geometry?.boundingBox?.getSize(size);
        return JSON.stringify(size, null, 2);
    }
}
//# sourceMappingURL=import-manager.js.map