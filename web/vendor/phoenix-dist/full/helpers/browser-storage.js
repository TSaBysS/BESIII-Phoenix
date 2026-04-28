/**
 * Get an item from local storage.
 * @param item Item to get.
 * @returns The value of the item stored in local storage.
 */
export const getFromLocalStorage = (item) => {
    try {
        return localStorage.getItem(item);
    }
    catch (exception) {
        console.warn('Exception in localStorage', exception);
    }
};
/**
 * Set item to local storage.
 * @param item Item to set.
 * @param value Value of the item.
 */
export const setToLocalStorage = (item, value) => {
    try {
        localStorage.setItem(item, value);
    }
    catch (exception) {
        console.warn('Exception in localStorage', exception);
    }
};
//# sourceMappingURL=browser-storage.js.map