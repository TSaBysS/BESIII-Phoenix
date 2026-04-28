/**
 * Phoenix loading manager for managing loadable items.
 */
export declare class LoadingManager {
    /** Instance of the loading manager */
    private static instance;
    /** Items to load. */
    toLoad: string[];
    /** Items loaded */
    loaded: string[];
    /** Callbacks to call on load. */
    private onLoadCallbacks;
    /** Callbacks to call on progress. */
    private onProgressCallbacks;
    /** Progress for each named item. */
    private progressItems;
    /**
     * Create the singleton Phoenix loading manager.
     * @returns The loading manager instance.
     */
    constructor();
    /**
     * Add an item which is to be loaded.
     * @param id ID of the item to be loaded.
     */
    addLoadableItem(id?: string): void;
    /**
     * Function to call when an item has finished loading.
     * @param id ID of the item loaded.
     */
    itemLoaded(id?: string): void;
    /**
     * Function to call when loading of an item progresses.
     * @param id ID of the item with the progress.
     * @param progress Progress of the item.
     */
    onProgress(id: string, progress: number): void;
    /**
     * Add a listener for when all items have loaded.
     * @param callback Callback to call when all items have loaded.
     */
    addLoadListener(callback: () => void): void;
    /**
     * Add a listener for when all items have loaded with check if there
     * are any items to load when the listener is added.
     * @param callback Callback to call when all items have loaded.
     */
    addLoadListenerWithCheck(callback: () => void): void;
    /**
     * Add a callback to listen when the progress of an item increases.
     * @param callback Callback to call when the progress of a loading item increases.
     */
    addProgressListener(callback: (progress: number) => void): void;
    /**
     * Reset the loading manager and its items.
     */
    reset(): void;
}
