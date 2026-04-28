import { PhoenixLoader } from './phoenix-loader';
/**
 * PhoenixLoader for processing and loading a CMS event.
 */
export declare class CMSLoader extends PhoenixLoader {
    /** Event data to be processed. */
    private data;
    /** Scale factor for resizing geometry to fit Phoenix event display. */
    private geometryScale;
    /**
     * Constructor for the CMS loader.
     */
    constructor();
    /**
     * Loads all the object types and collections of event data.
     * Overridden from {@link PhoenixLoader}.
     * @param eventData Event data of a CMS event containing all collections.
     */
    protected loadObjectTypes(eventData: any): void;
    /**
     * Read an ".ig" archive file and access the event data through a callback.
     * @param file Path to the ".ig" file or an object of type `File`.
     * @param onFileRead Callback called with an array of event data when the file is read.
     * @param eventPathName Complete event path or event number as in the ".ig" archive.
     */
    readIgArchive(file: string | File, onFileRead: (allEvents: any[]) => void, eventPathName?: string): void;
    /**
     * Load event data from an ".ig" archive.
     * @param filePath Path to the ".ig" archive file.
     * @param eventPathName Complete event path or event number as in the ".ig" archive.
     * @param onEventRead Callback called when the event data is read.
     */
    loadEventDataFromIg(filePath: string, eventPathName: string, onEventRead: (eventData: any) => void): void;
    /**
     * Get all event data.
     * @returns Event data with Hits, Tracks, Jets and CaloClusters.
     */
    getEventData(): any;
    /**
     * Get event data of all events.
     * @param allEventsDataFromIg An array containing data of all events from ".ig" file.
     * @returns An object containing event data for all events.
     */
    getAllEventsData(allEventsDataFromIg: any[]): any;
    /**
     * Get all tracking clusters from the event data.
     * @param Hits Hits object in which all cluster collections are to be put.
     * @returns Hits object containing all Cluster collections.
     */
    private getTrackingClusters;
    /**
     * Get all CaloClusters from the event data.
     * @returns CaloClusters object containing all CaloClusters collections.
     */
    private getCaloClusters;
    /**
     * Get all Jets from the event data.
     * @returns Jets object containing all Jets collections.
     */
    private getJets;
    /**
     * Get all Muon Chambers from the event data.
     * @returns MuonChambers object containing all Muon Chambers collections.
     */
    private getMuonChambers;
    /**
     * Common function for linearly getting event data of collections of an object type.
     * @param collections Keys for collections to be iterated.
     * @param processObject Callback for applying a custom logic to object params.
     * @param cuts Cuts for defining a minimum and maximum value of an attribute.
     * @returns An object containing all event data from the given collections.
     */
    private getObjectCollections;
    /**
     * Get all Tracks from the event data.
     * @returns Tracks object containing all Tracks collections.
     */
    private getTracks;
    /**
     * Get CMS specific metadata associated to the event.
     * @returns Metadata of the event.
     */
    getEventMetadata(): any[];
}
