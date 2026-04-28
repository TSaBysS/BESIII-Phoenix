/**
 * Logger for logging event display data
 */
export declare class InfoLogger {
    /** List that contains all the info logs */
    private infoLoggerList;
    /** Max entries to be shown inside the information panel */
    private maxEntries;
    /**
     * Add an entry to the info logger
     * @param data Data of the info log
     * @param label Label of the info log
     */
    add(data: string, label?: string): void;
    /**
     * Get the info logger list being used by the info logger service
     * @returns The info logger list containing log data
     */
    getInfoLoggerList(): any[];
}
