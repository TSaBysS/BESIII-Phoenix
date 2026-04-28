import { ConfigRangeSlider } from '../../managers/ui-manager/phoenix-menu/config-types';
/**
 * Cut for specifying filters on event data attribute.
 */
export declare class Cut {
    field: string;
    minValue: number;
    maxValue: number;
    step: number;
    minCutActive: boolean;
    maxCutActive: boolean;
    /** Default minimum allowed value of the event data attribute. */
    private defaultMinValue;
    /** Default maximum allowed value of the event data attribute. */
    private defaultMaxValue;
    /** Default if upper bound applied */
    private defaultApplyMaxValue;
    /** Default if lower bound applied */
    private defaultApplyMinValue;
    /** Range slider for Cut */
    configRangeSlider?: ConfigRangeSlider;
    /**
     * Create the cut to filter an event data attribute.
     * @param field Name of the event data attribute to be filtered.
     * @param minValue Minimum allowed value of the event data attribute.
     * @param maxValue Maximum allowed value of the event data attribute.
     * @param step Size of increment when using slider.
     * @param minCutActive If true, the minimum cut is appled. Can be overriden later with enableMinCut.
     * @param maxCutActive If true, the maximum cut is appled. Can be overriden later with enableMaxCut.
     *
     */
    constructor(field: string, minValue: number, maxValue: number, step?: number, minCutActive?: boolean, maxCutActive?: boolean);
    /** Returns true if upper cut is valid. */
    enableMaxCut(check: boolean): void;
    /** Returns true if upper cut is valid. */
    enableMinCut(check: boolean): void;
    /** Returns true if the passed value is within the active cut range. */
    cutPassed(value: number): boolean;
    /**
     * Reset the minimum and maximum value of the cut to default.
     */
    reset(): void;
    /**
     * Builds a config range slider for the cut to be used in Phoenix Menu
     * @param collectionFiltering callback function to apply to all objects inside a collection, filtering them given a parameter
     * @returns config range slider for the cut to be used in Phoenix Menu
     */
    getConfigRangeSlider(collectionFiltering: () => void): ConfigRangeSlider;
}
