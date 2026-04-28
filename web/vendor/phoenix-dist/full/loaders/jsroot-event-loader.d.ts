import { PhoenixLoader } from './phoenix-loader';
/**
 * PhoenixLoader for processing and loading an event from ".root".
 */
export declare class JSRootEventLoader extends PhoenixLoader {
    /** Event data inside the file. */
    private fileEventData;
    /** URL of the ".root" file to be processed. */
    private rootFileURL;
    /**
     * Constructor for the JSRoot event loader.
     * @param rootFileURL URL of the ".root" file to be processed.
     */
    constructor(rootFileURL: string);
    /**
     * Get event data of the given objects (e.g ['tracks;1', 'hits;1'])
     * from the currently loaded ".root" file.
     * @param objects An array identifying objects inside the ".root" file.
     * @param onEventData Callback when event data is extracted and available for use.
     */
    getEventData(objects: string[], onEventData: (eventData: any) => void): void;
    /**
     * Process the list of items inside the JSROOT files for relevant event data.
     * @param obj Object containing the event data in the form of JSROOT classes.
     */
    private processItemsList;
    /**
     * Process and get the TGeoTrack in phoenix format.
     * @param track Track object containing the track information.
     * @returns Track object in the phoenix format.
     */
    private getTGeoTrack;
    /**
     * Process and get the TEveTrack in phoenix format.
     * @param track Track object containing the track information.
     * @returns Track object in the phoenix format.
     */
    private getTEveTrack;
    /**
     * Process and get the Hit in phoenix format.
     * @param hit Hit object containing the hit information.
     * @returns Hit in phoenix format.
     */
    private getHit;
}
