import { Color, Object3D } from 'three';
import { ThreeManager } from '../../three-manager/index';
import { PhoenixMenuNode } from './phoenix-menu-node';
import { Cut } from '../../../lib/models/cut.model';
import type { PhoenixUI } from '../phoenix-ui';
/**
 * A wrapper class for Phoenix menu to perform UI related operations.
 */
export declare class PhoenixMenuUI implements PhoenixUI<PhoenixMenuNode> {
    private phoenixMenuRoot;
    private three;
    /** Phoenix menu node containing geometries data */
    private geomFolder;
    /** Phoenix menu node containing event related data. */
    private eventFolder;
    /** State of the Phoenix menu node containing event related data. */
    private eventFolderState;
    /** Phoenix menu node containing labels. */
    private labelsFolder;
    /** Manager for managing functions of the three.js scene. */
    private sceneManager;
    /**
     * Create Phoenix menu UI with different controls related to detector geometry and event data.
     * @param phoenixMenuRoot Root node of the Phoenix menu.
     * @param three The three manager for managing three.js related operations.
     */
    constructor(phoenixMenuRoot: PhoenixMenuNode, three: ThreeManager);
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
     * @param menuSubfolder Subfolder in the menu to add the geometry to. Example `Folder > Subfolder`.
     */
    addGeometry(object: Object3D, menuSubfolder?: string): void;
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
     * Add Cut Options folder to the menu.
     * @param collectionNode The parent node to attach folder to
     * @param collectionName The name of the collection
     */
    private addCutOptions;
    /**
     * Add Draw Options folder to the menu.
     * @param collectionNode The parent node to attach folder to
     * @param collectionName The name of the collection
     */
    private addDrawOptions;
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
    removeLabel(labelId: string, labelNode?: PhoenixMenuNode): void;
    /**
     * Get the folder of the event data type.
     * @param typeName Name of the event data type.
     * @returns Folder of the event data type.
     */
    getEventDataTypeFolder(typeName: string): PhoenixMenuNode | undefined;
    /**
     * Load previous state of the event data folder in Phoenix menu if any.
     */
    loadEventFolderState(): void;
}
