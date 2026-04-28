import type { Configuration } from '../lib/types/configuration';
import { EventDisplay } from '../event-display';
/**
 * Model for Phoenix URL options.
 */
export declare const phoenixURLOptions: {
    file: string;
    type: string;
    config: string;
    hideWidgets: boolean;
    embed: boolean;
};
/**
 * A manager for managing options given through URL.
 */
export declare class URLOptionsManager {
    private eventDisplay;
    private configuration;
    /** Variable containing all URL search parameters. */
    private urlOptions;
    /**
     * Constructor for the URL options manager.
     * @param eventDisplay The Phoenix event display.
     * @param configuration Configuration of the event display.
     */
    constructor(eventDisplay: EventDisplay, configuration: Configuration);
    /**
     * Initialize and apply all URL options on page load.
     */
    applyOptions(): void;
    /**
     * Initialize the event display with event data and configuration from URL.
     * (Only JiveXML and JSON)
     * @param defaultEventPath Default event path to fallback to if none in URL.
     * @param defaultEventType Default event type to fallback to if none in URL.
     */
    applyEventOptions(defaultEventPath?: string, defaultEventType?: string): void;
    /**
     * Handle JiveXML event from file URL.
     * @param fileURL URL to the XML file.
     * @returns An empty promise. ;(
     */
    private handleJiveXMLEvent;
    /**
     * Handle JSON event from file URL.
     * @param fileURL URL to the JSON file.
     * @returns An empty promise. ;(
     */
    private handleJSONEvent;
    /**
     * Handle zip containing event data files.
     * @param fileURL URL to the zip file.
     * @returns An empty promise. ;(
     */
    private handleZipFileEvents;
    /**
     * Hide all overlay widgets if "hideWidgets" option from the URL is true.
     */
    applyHideWidgetsOptions(): void;
    /**
     * Hide all overlay widgets and enable embed menu if "hideWidgets" option from the URL is true.
     */
    applyEmbedOption(): void;
    /**
     * Hide element with IDs based on a URL option.
     * @param urlOptionWithIds IDs to hide with keys as the URL option and its array value as IDs.
     */
    private hideIdsWithURLOption;
    /**
     * Get options from URL set through query parameters.
     * @returns URL options.
     */
    getURLOptions(): URLSearchParams;
}
