import { loadFile, saveFile } from '../helpers/file';
import { ActiveVariable } from '../helpers/active-variable';
/**
 * A singleton manager for managing the scene's state.
 */
export class StateManager {
    /**
     * Create the state manager.
     * @returns The state manager instance.
     */
    constructor() {
        /** Whether the clipping is enabled or not. */
        this.clippingEnabled = new ActiveVariable(false);
        /** Starting angle of the clipping. */
        this.startClippingAngle = new ActiveVariable(0);
        /** Opening angle of the clipping. */
        this.openingClippingAngle = new ActiveVariable(0);
        /** Current loaded event's metadata. */
        this.eventMetadata = {
            runNumber: '000',
            eventNumber: '000',
        };
        if (StateManager.instance === undefined) {
            StateManager.instance = this;
        }
        return StateManager.instance;
    }
    /**
     * Get the instance of state manager.
     * @returns The state manager instance.
     */
    static getInstance() {
        return StateManager.instance;
    }
    /**
     * Set the root node of Phoenix menu.
     * @param phoenixMenuRoot Phoenix menu root node.
     */
    setPhoenixMenuRoot(phoenixMenuRoot) {
        this.phoenixMenuRoot = phoenixMenuRoot;
        if (this.phoenixMenuRoot) {
            // Add save and load config buttons to the root node
            this.phoenixMenuRoot
                .addConfig({
                type: 'button',
                label: 'Save state',
                onClick: () => {
                    this.saveStateAsJSON();
                },
            })
                .addConfig({
                type: 'button',
                label: 'Load state',
                onClick: () => {
                    loadFile((data) => {
                        this.loadStateFromJSON(JSON.parse(data));
                    });
                },
            });
        }
    }
    /**
     * Save the state of the event display as JSON.
     */
    saveStateAsJSON() {
        const state = {
            phoenixMenu: this.phoenixMenuRoot.getNodeState(),
            eventDisplay: {
                cameraPosition: this.activeCamera.position.toArray(),
                startClippingAngle: this.clippingEnabled.value
                    ? this.startClippingAngle.value
                    : null,
                openingClippingAngle: this.clippingEnabled.value
                    ? this.openingClippingAngle.value
                    : null,
            },
        };
        saveFile(JSON.stringify(state), `run${this.eventMetadata.runNumber}_evt${this.eventMetadata.eventNumber}.json`);
    }
    /**
     * Load the state from JSON.
     * @param json JSON for state.
     */
    loadStateFromJSON(json) {
        const jsonData = typeof json === 'string' ? JSON.parse(json) : json;
        if (jsonData['phoenixMenu'] && this.phoenixMenuRoot) {
            console.log('StateManager: Processing phoenixMenu configuration');
            this.phoenixMenuRoot.loadStateFromJSON(jsonData['phoenixMenu']);
            this.phoenixMenuRoot.configActive = false;
        }
        if (jsonData['eventDisplay']) {
            console.log('StateManager: Processing eventDisplay configuration');
            this.activeCamera.position.fromArray(jsonData['eventDisplay']?.['cameraPosition']);
            const startAngle = jsonData['eventDisplay']?.['startClippingAngle'];
            const openingAngle = jsonData['eventDisplay']?.['openingClippingAngle'];
            if (startAngle || openingAngle) {
                this.setClippingEnabled(true);
                this.eventDisplay.getUIManager().setClipping(true);
                if (startAngle) {
                    this.eventDisplay
                        .getUIManager()
                        .rotateStartAngleClipping(jsonData['eventDisplay']['startClippingAngle']);
                }
                if (openingAngle) {
                    this.eventDisplay
                        .getUIManager()
                        .rotateOpeningAngleClipping(jsonData['eventDisplay']['openingClippingAngle']);
                }
            }
        }
    }
    /**
     * Set the state of clipping.
     * @param clipping Whether the clipping is enabled or not.
     */
    setClippingEnabled(clipping) {
        this.clippingEnabled.update(clipping);
    }
    /**
     * Set the start clipping angle of clipping.
     * @param angle Angle for clipping.
     */
    setStartClippingAngle(angle) {
        this.startClippingAngle.update(angle);
    }
    /**
     * Get the start clipping angle of clipping.
     * @returns The starting angle of clipping.
     */
    getStartClippingAngle() {
        return this.startClippingAngle.value ?? 0.0;
    }
    /**
     * Set the opening angle of clipping.
     * @param angle Angle for clipping.
     */
    setOpeningClippingAngle(angle) {
        this.openingClippingAngle.update(angle);
    }
    /**
     * Get the opening angle of clipping.
     * @returns The opening angle of clipping.
     */
    getOpeningClippingAngle() {
        return this.openingClippingAngle.value ?? 0.0;
    }
    /**
     * Set the scene camera for state.
     * @param camera The camera.
     */
    setCamera(camera) {
        this.activeCamera = camera;
    }
    /**
     * Set the event display.
     * @param eventDisplay The event display.
     */
    setEventDisplay(eventDisplay) {
        this.eventDisplay = eventDisplay;
    }
}
//# sourceMappingURL=state-manager.js.map