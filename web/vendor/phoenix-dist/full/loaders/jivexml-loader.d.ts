import { PhoenixLoader } from './phoenix-loader';
/**
 * PhoenixLoader for processing and loading an event from the JiveXML data format.
 */
export declare class JiveXMLLoader extends PhoenixLoader {
    /** Event data in JiveXML data format */
    private data;
    /** List of tracks to draw with thicker tubes */
    thickTrackCollections: string[];
    /**
     * Constructor for the JiveXMLLoader.
     * @param thickTrackCollections A list of names of track collections which should be drawn thicker
     */
    constructor(thickTrackCollections?: string[]);
    /**
     * Process JiveXML data to be used by the class.
     * @param data Event data in JiveXML data format.
     */
    process(data: any): void;
    /**
     * Get the event data from the JiveXML data format.
     * @returns An object containing all the event data.
     */
    getEventData(): any;
    /**
     * Get the number array from a collection in XML DOM.
     * @param collection Collection in XML DOM of JiveXML format.
     * @param key Tag name of the number array.
     * @returns Number array.
     */
    private getNumberArrayFromHTML;
    /**
     * Get the number array from a collection in XML DOM.
     * @param collection Collection in XML DOM of JiveXML format.
     * @param key Tag name of the string array.
     * @returns String array.
     */
    private getStringArrayFromHTML;
    /**
     * Try to get the position of a hit (i.e. linked from a track)
     * @param hitIdentifier The unique identifier of this hit.
     * @param eventData The complete eventData, which must contain hits.
     * @returns [found, x, y, z].
     */
    private getPositionOfHit;
    /**
     * Extract Tracks from the JiveXML data format and process them.
     * @param firstEvent First "Event" element in the XML DOM of the JiveXML data format.
     * @param eventData Event data object to be updated with Tracks.
     */
    getTracks(firstEvent: Element, eventData: {
        Tracks: any;
        Hits: any;
    }): void;
    /**
     * Extract Pixel Clusters (type of Hits) from the JiveXML data format and process them.
     * @param firstEvent First "Event" element in the XML DOM of the JiveXML data format.
     * @param eventData Event data object to be updated with Pixel Clusters.
     */
    getPixelClusters(firstEvent: Element, eventData: {
        Hits: any;
    }): void;
    /**
     * Extract SCT Clusters (type of Hits) from the JiveXML data format and process them.
     * @param firstEvent First "Event" element in the XML DOM of the JiveXML data format.
     * @param eventData Event data object to be updated with SCT Clusters.
     */
    getSCTClusters(firstEvent: Element, eventData: {
        Hits: any;
    }): void;
    /**
     * Extract TRT Drift Circles (type of Hits) from the JiveXML data format and process them.
     * @param firstEvent First "Event" element in the XML DOM of the JiveXML data format.
     * @param eventData Event data object to be updated with TRT Drift Circles.
     */
    getTRT_DriftCircles(firstEvent: Element, eventData: {
        Hits: any;
    }): void;
    /**
     * Extract Muon PRDs (type of Hits) from the JiveXML data format and process them.
     * @param firstEvent First "Event" element in the XML DOM of the JiveXML data format.
     * @param name Event data collection name.
     * @param eventData Event data object to be updated with TRT Drift Circles.
     */
    getMuonPRD(firstEvent: Element, name: string, eventData: {
        Hits: any;
    }): void;
    /**
     * Extract RPC measurements from the JiveXML data format and process them.
     * @param firstEvent First "Event" element in the XML DOM of the JiveXML data format.
     * @param eventData Event data object to be updated with TRT Drift Circles.
     */
    getRPC(firstEvent: Element, eventData: {
        Hits: any;
    }): void;
    /**
     * Get the end coordinates of a line, given its centre and its length.
     * @param i index of the current coordinate
     * @param x Array of x coordinates
     * @param y Array of y coordinates
     * @param z Array of z coordinates
     * @param length Length of the line (i.e. strip or tube) that we need to draw
     */
    private getMuonLinePositions;
    /**
     * Extract Jets from the JiveXML data format and process them.
     * @param firstEvent First "Event" element in the XML DOM of the JiveXML data format.
     * @param eventData Event data object to be updated with Jets.
     */
    getJets(firstEvent: Element, eventData: {
        Jets: any;
    }): void;
    /**
     * Extract Calo Clusters from the JiveXML data format and process them.
     * @param firstEvent First "Event" element in the XML DOM of the JiveXML data format.
     * @param eventData Event data object to be updated with Calo Clusters.
     */
    getCaloClusters(firstEvent: Element, eventData: {
        CaloClusters: any;
    }): void;
    /**
     * Extract Calo Cells from the JiveXML data format and process them.
     * @param firstEvent First "Event" element in the XML DOM of the JiveXML data format.
     * @param eventData Event data object to be updated with Calo Clusters.
     */
    getFCALCaloCells(firstEvent: Element, name: string, eventData: {
        PlanarCaloCells: any;
    }): void;
    /**
     * Extract Calo Cells from the JiveXML data format and process them.
     * @param firstEvent First "Event" element in the XML DOM of the JiveXML data format.
     * @param eventData Event data object to be updated with Calo Clusters.
     */
    getCaloCells(firstEvent: Element, name: string, eventData: {
        CaloCells: any;
    }): void;
    /**
     * Extract Vertices from the JiveXML data format and process them.
     * @param firstEvent First "Event" element in the XML DOM of the JiveXML data format.
     * @param eventData Event data object to be updated with Vertices.
     */
    getVertices(firstEvent: Element, eventData: {
        Vertices: any;
    }): void;
    /**
     * Extract Muons from the JiveXML data format and process them.
     * @param firstEvent First "Event" element in the XML DOM of the JiveXML data format.
     * @param eventData Event data object to be updated with Muons.
     */
    getMuons(firstEvent: Element, eventData: {
        Muons: any;
    }): void;
    /**
     * Extract Electrons from the JiveXML data format and process them.
     * @param firstEvent First "Event" element in the XML DOM of the JiveXML data format.
     * @param eventData Event data object to be updated with Electrons.
     */
    getElectrons(firstEvent: Element, eventData: {
        Electrons: any;
    }): void;
    /**
     * Extract Photons from the JiveXML data format and process them.
     * @param firstEvent First "Event" element in the XML DOM of the JiveXML data format.
     * @param eventData Event data object to be updated with Photons.
     */
    getPhotons(firstEvent: Element, eventData: {
        Photons: any;
    }): void;
    /**
     * Extract MET from the JiveXML data format and process them.
     * @param firstEvent First "Event" element in the XML DOM of the JiveXML data format.
     * @param eventData Event data object to be updated with Photons.
     */
    getMissingEnergy(firstEvent: Element, eventData: {
        MissingEnergy: any;
    }): void;
}
