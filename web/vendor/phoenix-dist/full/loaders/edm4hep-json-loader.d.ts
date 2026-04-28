import { PhoenixLoader } from './phoenix-loader';
/**
 * Edm4hepJsonLoader for loading EDM4hep json dumps
 */
export declare class Edm4hepJsonLoader extends PhoenixLoader {
    /**  Event data loaded from EDM4hep JSON file */
    private rawEventData;
    /** Create Edm4hepJsonLoader */
    constructor();
    /** Put raw EDM4hep JSON event data into the loader */
    setRawEventData(rawEventData: any): void;
    /** Process raw EDM4hep JSON event data into the Phoenix format */
    processEventData(): boolean;
    /** Output event data in Phoenix compatible format */
    getEventData(): any;
    /** Return number of events */
    private getNumEvents;
    /** Return run number (or 0, if not defined) */
    private getRunNumber;
    /** Return event number (or 0, if not defined) */
    private getEventNumber;
    /** Assign default color to Tracks*/
    private colorTracks;
    /** Return the vertices */
    private getVertices;
    /** Return tracks */
    private getTracks;
    /** Not implemented */
    private getHits;
    /** Returns the cells */
    private getCells;
    /** Return Calo clusters */
    private getCaloClusters;
    /** Return jets */
    private getJets;
    /** Return missing energy */
    private getMissingEnergy;
    /** Return a random colour */
    private randomColor;
    /** Helper conversion of HSL to hexadecimal */
    private convHSLtoHEX;
    /** Return a lightness value from the passed number and range */
    private valToLightness;
    /** Return a opacity value from the passed number and range */
    private valToOpacity;
    /** Get the required collection */
    private getCollByID;
}
