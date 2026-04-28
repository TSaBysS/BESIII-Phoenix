/**
 * Logger for logging event display data
 */
export class InfoLogger {
    constructor() {
        /** List that contains all the info logs */
        this.infoLoggerList = [];
        /** Max entries to be shown inside the information panel */
        this.maxEntries = 10;
    }
    /**
     * Add an entry to the info logger
     * @param data Data of the info log
     * @param label Label of the info log
     */
    add(data, label) {
        if (this.infoLoggerList.length > this.maxEntries) {
            this.infoLoggerList.pop();
        }
        this.infoLoggerList.unshift(label ? label + ': ' + data : data);
    }
    /**
     * Get the info logger list being used by the info logger service
     * @returns The info logger list containing log data
     */
    getInfoLoggerList() {
        return this.infoLoggerList;
    }
}
//# sourceMappingURL=info-logger.js.map