/**
 * Helper for pretty symbols functions.
 */
export declare class PrettySymbols {
    /** Pretty symbols for object params. */
    static readonly symbols: {
        [key: string]: string[];
    };
    /**
     * Get pretty symbol of a parameter.
     * @param param Parameter of a physics object.
     */
    static getPrettySymbol(param: string): string;
    /**
     * Get pretty printed parameters of an object.
     * @param params Object parameters to be pretty printed.
     * @returns New pretty printed parameterss.
     */
    static getPrettyParams(params: {
        [key: string]: any;
    }): {
        [key: string]: any;
    };
}
