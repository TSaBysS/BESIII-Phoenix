import { PhoenixLoader } from './phoenix-loader';
/**
 * PhoenixLoader for processing and loading an event from TrackML.
 */
export declare class TrackmlLoader extends PhoenixLoader {
    /** Data containing Hits. */
    private hitData;
    /** Data containing Particles. */
    private particleData;
    /** Data containing truthy Particles. */
    private truthData;
    /**
     * Instiantiate the TrackML loader.
     */
    constructor();
    /**
     * Process Hits to format and store them.
     * @param hits Hits to be processed.
     */
    processHits(hits: any): void;
    /**
     * Process Particles to format and store them.
     * @param particles Particles to be processed.
     */
    processParticles(particles: any): void;
    /**
     * Process Truth data to format and store it.
     * @param truth Truth data to be processed.
     */
    processTruth(truth: any): void;
    /**
     * Get structured event data from the processed Hits, Truth data and Particles.
     * @param eventNum Event number.
     */
    getEventData(eventNum: string): any;
}
