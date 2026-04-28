/**
 * Preset view settings for clipping
 */
export var ClippingSetting;
(function (ClippingSetting) {
    ClippingSetting[ClippingSetting["NotForced"] = 0] = "NotForced";
    ClippingSetting[ClippingSetting["On"] = 1] = "On";
    ClippingSetting[ClippingSetting["Off"] = 2] = "Off";
})(ClippingSetting || (ClippingSetting = {}));
/**
 * Preset view for easily transforming/changing camera position to a specified position.
 * Also allows to point the camera to a given target and to define the default clipping for that view
 */
export class PresetView {
    /**
     * Create a preset view.
     * @param name Name of the preset view.
     * @param cameraPos Position to which the camera is to be set.
     * @param cameraTarget Target to which the camera is pointing.
     * @param icon Icon of the preset view (to describe the view angle).
     */
    constructor(name, cameraPos, cameraTarget, icon, clipping = ClippingSetting.NotForced, clippingStartAngle = 0, clippingOpeningAngle = 0) {
        this.name = name;
        this.cameraPos = cameraPos;
        this.cameraTarget = cameraTarget;
        this.icon = icon;
        this.clipping = clipping;
        this.clippingStartAngle = clippingStartAngle;
        this.clippingOpeningAngle = clippingOpeningAngle;
    }
    /**
     * Get the URL of the preset view icon.
     * @returns Icon URL.
     */
    getIconURL() {
        return 'assets/preset-views/' + this.icon + '.svg#' + this.icon;
    }
}
//# sourceMappingURL=preset-view.model.js.map