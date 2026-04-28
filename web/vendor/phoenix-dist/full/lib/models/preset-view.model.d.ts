/**
 * Preset view settings for clipping
 */
export declare enum ClippingSetting {
    NotForced = 0,
    On = 1,
    Off = 2
}
/**
 * Preset view for easily transforming/changing camera position to a specified position.
 * Also allows to point the camera to a given target and to define the default clipping for that view
 */
export declare class PresetView {
    /** Icon of the preset view (to describe the view angle). */
    icon: string;
    /** Position to which the camera is to be set. */
    cameraPos: number[];
    /** Target to which the camera is pointing. */
    cameraTarget: number[];
    /** Name of the preset view. */
    name: string;
    /** Whether clipping should be used. */
    clipping: ClippingSetting;
    /** In case of clipping, value of the start angle. */
    clippingStartAngle: number;
    /** In case of clipping, value of the opening angle. */
    clippingOpeningAngle: number;
    /**
     * Create a preset view.
     * @param name Name of the preset view.
     * @param cameraPos Position to which the camera is to be set.
     * @param cameraTarget Target to which the camera is pointing.
     * @param icon Icon of the preset view (to describe the view angle).
     */
    constructor(name: string, cameraPos: number[], cameraTarget: number[], icon: string, clipping?: ClippingSetting, clippingStartAngle?: number, clippingOpeningAngle?: number);
    /**
     * Get the URL of the preset view icon.
     * @returns Icon URL.
     */
    getIconURL(): string;
}
