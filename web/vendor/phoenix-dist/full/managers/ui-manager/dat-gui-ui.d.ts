import { GUI } from 'dat.gui';
import { Color, Object3D } from 'three';
import { ThreeManager } from '../three-manager/index';
import { Cut } from '../../lib/models/cut.model';
import type { PhoenixUI } from './phoenix-ui';
/**
 * A wrapper class for dat.GUI menu to perform UI related operations.
 */
export declare class DatGUIMenuUI implements PhoenixUI<GUI> {
    private three;
    /** Manager for managing functions of the three.js scene. */
    private sceneManager;
    /** dat.GUI menu. */
    private gui;
    /** Options for the dat.GUI menu. */
    private guiParameters;
    /** dat.GUI menu folder containing geometries data. */
    private geomFolder;
    /** dat.GUI menu folder containing event related data. */
    private eventFolder;
    /** dat.GUI menu folder containing labels. */
    private labelsFolder;
    /** Max changeable position of an object along the x-axis. */
    private maxPositionX;
    /** Max changeable position of an object along the y-axis. */
    private maxPositionY;
    /** Max changeable position of an object along the z-axis. */
    private maxPositionZ;
    /**
     * Create dat.GUI menu UI with different controls related to detector geometry and event data.
     * @param elementId ID of the wrapper element.
     * @param three The three manager for managing three.js related operations.
     */
    constructor(elementId: string, three: ThreeManager);
    /**
     * Clear the menu by removing all folders.
     */
    clear(): void;
    /**
     * Add geometry (detector geometry) folder to the menu.
     */
    addGeometryFolder(): void;
    /**
     * Add geometry to the menu's geometry folder and set up its configurable options.
     * @param object Object to add to the UI menu.
     * @param _menuSubfolder Subfolder in the menu to add the geometry to. Example `Folder > Subfolder`.
     */
    addGeometry(object: Object3D, _menuSubfolder?: string): void;
    /**
     * Remove object from the dat.GUI menu.
     * @param object Geometry object to be removed.
     */
    private removeOBJ;
    /**
     * Add event data folder with functions for event data toggles like show/hide and depthTest.
     */
    addEventDataFolder(): void;
    /**
     * Add folder for event data type like tracks or hits to the menu.
     * @param typeName Name of the type of event data.
     */
    addEventDataTypeFolder(typeName: string): void;
    /**
     * Add collection folder and its configurable options to the event data type (tracks, hits etc.) folder.
     * @param eventDataType Name of the event data type.
     * @param collectionName Name of the collection to be added in the type of event data (tracks, hits etc.).
     * @param cuts Cuts to the collection of event data that are to be made configurable to filter event data.
     * @param collectionColor Default color of the collection.
     */
    addCollection(eventDataType: string, collectionName: string, cuts?: Cut[], collectionColor?: Color): void;
    /**
     * Add labels folder to the menu.
     * @param configFunctions Functions to attach to the labels folder configuration.
     */
    addLabelsFolder(configFunctions: any): void;
    /**
     * Add folder for configuration of label.
     * @param labelId Unique ID of the label.
     * @param onRemoveLabel Function called when label is removed.
     */
    addLabel(labelId: string, onRemoveLabel?: () => void): void;
    /**
     * Remove label from the menu and scene if it exists.
     * @param labelId A unique label ID string.
     * @param labelFolderReference Reference to the label folder.
     */
    removeLabel(labelId: string, labelItemFolder?: GUI): void;
    /**
     * Get the folder of the event data type.
     * @param typeName Name of the event data type.
     * @returns Folder of the event data type.
     */
    getEventDataTypeFolder(typeName: string): GUI;
}
