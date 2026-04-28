import { Color } from 'three';
import { ColorManager } from '../three-manager/color-manager';
import { PhoenixMenuNode } from './phoenix-menu/phoenix-menu-node';
/** Keys for options available for coloring event data by. */
export declare enum ColorByOptionKeys {
    CHARGE = "charge",
    MOM = "mom",
    VERTEX = "vertex"
}
/**
 * Color options with functions to color event data.
 */
export declare class ColorOptions {
    private colorManager;
    /** Collection name of the event data type. */
    private collectionName;
    /** Available options to color by in this instance of color options. */
    private colorByOptions;
    /** Currently selected option to color by. */
    private selectedColorByOption;
    /** Phoenix menu node containing color configurations. */
    private colorOptionsFolder;
    /** All color by options possible. */
    private allColorByOptions;
    /** Default values for colors for color by charge. */
    private chargeColors;
    /** Default values for colors and min/max for color by momentum. */
    private momColors;
    /**
     * Create the color options.
     * @param colorManager Color manager for three.js functions related to coloring of objects.
     * @param collectionFolder Collection folder to add the color by options to.
     * @param colorByOptionsToInclude Options to include for this collection to color event data by.
     */
    constructor(colorManager: ColorManager, collectionFolder: PhoenixMenuNode, collectionColor: Color, colorByOptionsToInclude?: ColorByOptionKeys[]);
    /**
     * Initialize the color options.
     */
    private initColorByOptions;
    /**
     * Initialize charge color options.
     */
    private initChargeColorOptions;
    /**
     * Apply charge color options.
     */
    private applyChargeColorOptions;
    /**
     * Check if object should be colored based on charge value.
     * @param objectParams Object parameters associated to the 3D object.
     * @param chargeValue Value of charge (-1, 0, 1).
     * @returns Whether the charge is equal to the value.
     */
    private shouldColorByCharge;
    /**
     * Initialize momentum color options.
     */
    private initMomColorOptions;
    /**
     * Apply momentum color options.
     */
    private applyMomColorOptions;
    /**
     * Color event data based on the momentum property of each object.
     * @param minOrMax If the momentum to color objects by is minimum or maximum momentum.
     * This is to apply the stored momentum colors for minimum and maximum separated at the mid value.
     */
    private colorByMomentum;
    /**
     * Get momentum from object parameters.
     * @param objectParams Parameters associated to the 3D object.
     * @returns THe momentum value.
     */
    private getMomentum;
    /**
     * Apply color by vertex to tracks.
     */
    private applyVertexColorOptions;
    /**
     * Show configs of only the currently selected color by option.
     */
    private onlySelectedColorByOption;
}
