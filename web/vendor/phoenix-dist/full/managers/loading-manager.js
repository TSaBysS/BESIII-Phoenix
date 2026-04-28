/**
 * Phoenix loading manager for managing loadable items.
 */
export class LoadingManager {
    /**
     * Create the singleton Phoenix loading manager.
     * @returns The loading manager instance.
     */
    constructor() {
        /** Items to load. */
        this.toLoad = [];
        /** Items loaded */
        this.loaded = [];
        /** Callbacks to call on load. */
        this.onLoadCallbacks = [];
        /** Callbacks to call on progress. */
        this.onProgressCallbacks = [];
        /** Progress for each named item. */
        this.progressItems = {};
        if (LoadingManager.instance === undefined) {
            LoadingManager.instance = this;
        }
        return LoadingManager.instance;
    }
    /**
     * Add an item which is to be loaded.
     * @param id ID of the item to be loaded.
     */
    addLoadableItem(id = '') {
        this.toLoad.push(id);
        this.progressItems[id] = 0;
    }
    /**
     * Function to call when an item has finished loading.
     * @param id ID of the item loaded.
     */
    itemLoaded(id = '') {
        this.loaded.push(id);
        this.onProgress(id, 100);
        if (this.toLoad.length === this.loaded.length &&
            this.toLoad.sort().join(',') === this.loaded.sort().join(',')) {
            this.onLoadCallbacks.forEach((callback) => callback());
            this.reset();
        }
    }
    /**
     * Function to call when loading of an item progresses.
     * @param id ID of the item with the progress.
     * @param progress Progress of the item.
     */
    onProgress(id, progress) {
        this.progressItems[id] = progress;
        const totalProgress = Object.values(this.progressItems).reduce((acc, val) => acc + val, 0);
        const totalItems = Object.keys(this.progressItems).length;
        const averageProgress = totalProgress / totalItems;
        for (const callback of this.onProgressCallbacks) {
            callback(averageProgress);
        }
    }
    /**
     * Add a listener for when all items have loaded.
     * @param callback Callback to call when all items have loaded.
     */
    addLoadListener(callback) {
        this.onLoadCallbacks.push(callback);
    }
    /**
     * Add a listener for when all items have loaded with check if there
     * are any items to load when the listener is added.
     * @param callback Callback to call when all items have loaded.
     */
    addLoadListenerWithCheck(callback) {
        if (this.toLoad.length > 0 && this.toLoad.length !== this.loaded.length) {
            this.onLoadCallbacks.push(callback);
        }
        else {
            callback();
        }
    }
    /**
     * Add a callback to listen when the progress of an item increases.
     * @param callback Callback to call when the progress of a loading item increases.
     */
    addProgressListener(callback) {
        this.onProgressCallbacks.push(callback);
    }
    /**
     * Reset the loading manager and its items.
     */
    reset() {
        this.toLoad = [];
        this.loaded = [];
        this.onLoadCallbacks = [];
        this.onProgressCallbacks = [];
        this.progressItems = {};
    }
}
//# sourceMappingURL=loading-manager.js.map