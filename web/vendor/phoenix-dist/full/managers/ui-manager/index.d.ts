import { Color, Object3D, Vector3 } from 'three';
import { ThreeManager } from '../three-manager/index';
import type { Configuration } from '../../lib/types/configuration';
import { PresetView } from '../../lib/models/preset-view.model';
import { Cut } from '../../lib/models/cut.model';
import { type PhoenixUI } from './phoenix-ui';
import { type AnimationPreset } from '../../managers/three-manager/animations-manager';
/**
 * Manager for UI related operations including the dat.GUI menu, stats-js and theme settings.
 */
export declare class UIManager {
    private three;
    /** The dat.GUI menu UI. A wrapper for dat.GUI menu to perform UI related operations. */
    private uiMenus;
    /** Stats object from stats-js. */
    private stats;
    /** If the geometry folder is added or not */
    private geomFolderAdded;
    /** If the labels folder is added or not */
    private labelsFolderAdded;
    /** Configuration options for preset views and event data loader. */
    private configuration;
    /** If dark theme is enabled or disabled. */
    private darkTheme;
    /** State manager for managing the event display's state. */
    private stateManager;
    /**
     * Constructor for the UI manager.
     * @param three Three manager to perform three.js related operations.
     */
    constructor(three: ThreeManager);
    /**
     * Show/load the UI including stats, the dat.GUI menu and theme.
     * @param configuration Configuration options for preset views and event data loader.
     */
    init(configuration: Configuration): void;
    /**
     * Show stats including FPS, milliseconds to render a frame, allocated memory etc.
     * @param elementId ID of the wrapper element.
     */
    private showStats;
    /**
     * Update the UI by updating stats for each frame.
     */
    updateUI(): void;
    /**
     * Clear the UI by removing the dat.GUI and phoenix menu(s).
     */
    clearUI(): void;
    /**
     * Add geometry (detector geometry) folder to the dat.GUI and Phoenix menu.
     */
    addGeomFolder(): void;
    /**
     * Add geometry to the menus geometry folder and set up its configurable options.
     * @param object Object to add to the UI menu.
     * @param menuSubfolder Subfolder in the menu to add the geometry to. Example `Folder > Subfolder`.
     */
    addGeometry(object: Object3D, menuSubfolder?: string): void;
    /**
     * Functions for event data toggles like show/hide and depthTest.
     */
    addEventDataFolder(): void;
    /**
     * Add folder for event data type like tracks or hits to the dat.GUI and Phoenix menu.
     * @param typeName Name of the type of event data.
     * @returns dat.GUI and Phoenix menu's folder for event data type.
     */
    addEventDataTypeFolder(typeName: string): void;
    /**
     * Add collection folder and its configurable options to the event data type (tracks, hits etc.) folder.
     * @param eventDataType Name of the event data type.
     * @param collectionName Name of the collection to be added in the type of event data (tracks, hits etc.).
     * @param cuts Cuts to the collection of event data that are to be made configurable to filter event data.
     */
    addCollection(eventDataType: string, collectionName: string, cuts?: Cut[], collectionColor?: Color): void;
    /**
     * Add labels folder to dat.GUI and Phoenix menu.
     */
    addLabelsFolder(): void;
    /**
     * Add configuration UI for label.
     * @param labelId Unique ID of the label.
     */
    addLabel(labelId: string): void;
    /**
     * Remove label from UI, scene and event data loader if it exists.
     * @param labelId A unique label ID string.
     * @param removeFolders Whether to remove label folders from dat.GUI and Phoenix menu.
     */
    removeLabel(labelId: string, removeFolders?: boolean): void;
    /**
     * Sets the visibility of a geometry in the scene.
     * @param name Name of the geometry in the scene
     * @param visible Value for the visibility of the object
     */
    geometryVisibility(name: string, visible: boolean): void;
    /**
     * Rotate the starting angle of clipping on detector geometry.
     * @param angle Angle of rotation of the clipping.
     */
    rotateStartAngleClipping(angle: number): void;
    /**
     * Rotate the opening angle of clipping on detector geometry.
     * @param angle Angle of rotation of the clipping.
     */
    rotateOpeningAngleClipping(angle: number): void;
    /**
     * Set if the detector geometry is to be clipped or not.
     * @param value Set clipping to be true or false.
     */
    setClipping(value: boolean): void;
    /**
     * Detect the current theme and set it.
     */
    detectColorScheme(): void;
    /**
     * Set if the theme is to be dark or light.
     * @param dark If the theme is to be dark or light. True for dark and false for light theme.
     */
    setDarkTheme(dark: boolean): void;
    /**
     * Get if the theme is dark or not.
     * @returns If the theme is dark or not.
     */
    getDarkTheme(): boolean;
    /**
     * Set autorotate for the orbit controls.
     * @param rotate If the autorotate is to be set or not.
     */
    setAutoRotate(rotate: boolean): void;
    /**
     * Set whether to show the axis or not
     * @param show If the axis is to be shown or not.
     */
    setShowAxis(show: boolean): void;
    /**
     * Translate the cartesian grid
     */
    translateCartesianGrid(translate: Vector3): void;
    /**
     * Translate the cartesian labels
     */
    translateCartesianLabels(translate: Vector3): void;
    /**
     * Show labels on cartesian grid
     * @param visible if the labels are to be shown or not
     */
    showLabels(visible: boolean): void;
    /**
     * Set whether to show the cartesian or not
     * @param show If the grid is to be shown or not.
     * @param scale The maximum dimensions (height, width, length) of the grid
     * @param config Configuration related to the visibility of the grid, such as visibility of the planes, number of planes in each direction, sparsity of the gridlines
     */
    setShowCartesianGrid(show: boolean, scale: number, config?: {
        showXY: boolean;
        showYZ: boolean;
        showZX: boolean;
        xDistance: number;
        yDistance: number;
        zDistance: number;
        sparsity: number;
    }): void;
    /**
     * Returns the cartesian grid configuration
     */
    getCartesianGridConfig(): {
        showXY: boolean;
        showYZ: boolean;
        showZX: boolean;
        xDistance: number;
        yDistance: number;
        zDistance: number;
        sparsity: number;
    };
    /**
     * Set whether to show the eta/phi or not
     * @param show If the grid is to be shown or not.
     */
    setShowEtaPhiGrid(show: boolean): void;
    /**
     * Show 3D coordinates where the mouse pointer clicks
     * @param show If the coordinates are to be shown or not.
     */
    show3DMousePoints(show: boolean): void;
    /**
     * Show 3D Distance between two clicked points
     */
    show3DDistance(show: boolean): void;
    /**
     * Shift cartesian grid by a mouse click
     */
    shiftCartesianGridByPointer(): void;
    /**
     * Get preset views from the configuration.
     * @returns Available preset views.
     */
    getPresetViews(): PresetView[];
    /**
     * Get preset animations from the configuration.
     * @returns Available preset animations.
     */
    getPresetAnimations(): AnimationPreset[];
    /**
     * Change camera view to a preset view.
     * @param view Preset view to which the camera has to be transformed.
     */
    displayView(view: PresetView): void;
    /**
     * Toggle orthographic/perspective view.
     * @param orthographic If the camera is to be orthographic or perspective.
     */
    toggleOrthographicView(orthographic: boolean): void;
    /**
     * Set the renderer for the secondary overlay canvas.
     * @param overlayCanvas Canvas for which the overlay renderer is to be set.
     */
    setOverlayRenderer(overlayCanvas: HTMLCanvasElement): void;
    /**
     * Enable keyboard controls for some UI manager operations.
     */
    enableKeyboardControls(): void;
    /**
     * Load labels from a file.
     */
    private loadLabelsFile;
    /**
     * Load previous state of the event data folder in Phoenix menu if any.
     */
    loadEventFolderPhoenixMenuState(): void;
    /**
     * Get all the UI menus.
     * @returns An array containing UI menus. (Phoenix menu, dat.GUI menu etc.)
     */
    getUIMenus(): PhoenixUI<unknown>[];
}
