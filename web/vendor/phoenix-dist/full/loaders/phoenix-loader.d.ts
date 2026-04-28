import { Object3D } from 'three';
import { GUI } from 'dat.gui';
import type { EventDataLoader } from './event-data-loader';
import { UIManager } from '../managers/ui-manager/index';
import { ThreeManager } from '../managers/three-manager/index';
import { Cut } from '../lib/models/cut.model';
import { InfoLogger } from '../helpers/info-logger';
import { PhoenixMenuNode } from '../managers/ui-manager/phoenix-menu/phoenix-menu-node';
import { LoadingManager } from '../managers/loading-manager';
import { StateManager } from '../managers/state-manager';
/**
 * Loader for processing and loading an event.
 */
export declare class PhoenixLoader implements EventDataLoader {
    /** ThreeService to perform three.js related functions. */
    private graphicsLibrary;
    /** UIService to perform UI related functions. */
    private ui;
    /** Event data processed by the loader. */
    protected eventData: any;
    /** Loading manager for loadable resources */
    protected loadingManager: LoadingManager;
    /** Loading manager for loadable resources */
    protected stateManager: StateManager;
    /** Object containing event object labels. */
    protected labelsObject: {
        [key: string]: any;
    };
    /**
     * Create the Phoenix loader.
     */
    constructor();
    /**
     * Takes an object that represents ONE event and takes care of adding
     * the different objects to the graphics library and the UI controls.
     * @param eventData Object representing the event.
     * @param graphicsLibrary Service containing functionality to draw the 3D objects.
     * @param ui Service for showing menus and controls to manipulate the geometries.
     * @param infoLogger Service for logging data to the information panel.
     */
    buildEventData(eventData: any, graphicsLibrary: ThreeManager, ui: UIManager, infoLogger: InfoLogger): void;
    /**
     * Get the list of event names from the event data.
     * @param eventsData Object containing all event data.
     * @returns List of event names.
     */
    getEventsList(eventsData: any): string[];
    /**
     * Get list of collections in the event data.
     * @returns List of all collection names.
     */
    getCollections(): string[];
    /**
     * Get the collection with the given collection name from the event data.
     * @param collectionName Name of the collection to get.
     * @returns An object containing the collection.
     */
    getCollection(collectionName: string): any;
    /**
     * Receives an object containing the data from an event and parses it
     * to reconstruct the different collections of physics objects.
     * @param eventData Representing ONE event (expressed in the Phoenix format).
     */
    protected loadObjectTypes(eventData: any): void;
    /**
     * Adds to the event display all collections of a given object type.
     * @param object Contains all collections of a given type (Tracks, Jets, CaloClusters...).
     * @param getObject Function that handles of reconstructing objects of the given type.
     * @param typeName Label for naming the object type.
     * @param concatonateObjs If true, don't process objects individually, but process as a group (e.g. for point hits). Default is false.
     * @param cuts Filters that can be applied to the objects.
     * @param extendEventDataTypeUI A callback to add more options to event data type UI folder.
     */
    protected addObjectType(object: any, getObject: any, typeName: string, concatonateObjs?: boolean, cuts?: Cut[], extendEventDataTypeUI?: (typeFolder: GUI, typeFolderPM: PhoenixMenuNode) => void): void;
    /**
     * Adds to the event display all the objects inside a collection.
     * @param objectCollection Contains the params for every object of the collection.
     * @param collectionName Label to UNIQUELY identify the collection.
     * @param getObject Handles reconstructing the objects of the collection.
     * @param objectGroup Group containing the collections of the same object type.
     * @param concatonateObjs If true, don't process objects individually, but process as a group (e.g. for point hits).
     */
    private addCollection;
    /**
     * Get collection names of a given object type.
     * @param object Contains all collections of a given type (Tracks, Jets, CaloClusters etc.).
     * @returns List of collection names of an object type (Tracks, Jets, CaloClusters etc.).
     */
    private getObjectTypeCollections;
    /** Process the compound object of track type (e.g. Muon, Electron, ..) from the given parameters and get it as a group.
     */
    protected getCompoundTrack(params: any, name?: string): Object3D;
    /** Process the compound object of cluster type (e.g. Photon, ..) from the given parameters and get it as a group.
     */
    protected getCompoundCluster(params: any, name?: string): Object3D;
    /**
     * Process the compound object (e.g. Muon, Electron, Photon) from the given parameters and get it as a group.
     * FIXME. This is currently here and not in PhoenixObjects because we need to handle linked objects.
     * @param params Parameters of the Muon.
     * @returns Muon group containing Clusters and Tracks.
     */
    protected getCompound(params: any, name?: string, objectIsTrack?: boolean, objectIsCluster?: boolean): Object3D;
    /**
     * Get metadata associated to the event (experiment info, time, run, event...).
     * @returns Metadata of the event.
     */
    getEventMetadata(): any[];
    /**
     * Add label of event object to the labels object.
     * @param label Label to be saved.
     * @param collection Collection the event object is a part of.
     * @param indexInCollection Event object's index in collection.
     * @returns A unique label ID string.
     */
    addLabelToEventObject(label: string, collection: string, indexInCollection: number): string;
    /**
     * Get the object containing labels.
     * @returns The labels object.
     */
    getLabelsObject(): {
        [key: string]: any;
    };
    /**
     * Get function to add options to scale event object type by.
     * @param configKey Key of the scale configuration option (for dat.GUI menu).
     * @param configLabel Label of the scale configuration option.
     * @param scaleFunction Function to scale the objects by.
     * @returns Function which adds scale options to Phoenix menu and dat.GUI menu.
     */
    addScaleOptions(configKey: string, configLabel: string, scaleFunction: (value: number) => void): (typeFolder: GUI, typeFolderPM: PhoenixMenuNode) => void;
}
