/**
 * Script loader for dynamically loading external scripts.
 */
export declare class ScriptLoader {
    /**
     * Load a script dynamically from a URL.
     * @param scriptURL URL of the script to be loaded.
     * @param scriptFor Optional data attribute to identify what the script is for. `[data-scriptFor]`
     * @param parentElement Parent element to which the script is to be appended.
     * Defaults to `<head>` tag.
     * @returns Promise for the script load.
     */
    static loadScript(scriptURL: string, scriptFor?: string, parentElement?: HTMLElement): Promise<void>;
}
