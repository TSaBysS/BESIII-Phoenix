import { EventDisplay } from '../event-display';
import { Camera } from 'three';
import { PhoenixMenuNode } from './ui-manager/phoenix-menu/phoenix-menu-node';
import { ActiveVariable } from '../helpers/active-variable';
/**
 * A singleton manager for managing the scene's state.
 */
export declare class StateManager {
    /** Instance of the state manager. */
    private static instance;
    /** Root node of the phoenix menu. */
    phoenixMenuRoot: PhoenixMenuNode;
    /** Whether the clipping is enabled or not. */
    clippingEnabled: ActiveVariable<boolean>;
    /** Starting angle of the clipping. */
    startClippingAngle: ActiveVariable<number>;
    /** Opening angle of the clipping. */
    openingClippingAngle: ActiveVariable<number>;
    /** The active camera. */
    activeCamera: Camera;
    /** The event display. */
    eventDisplay: EventDisplay;
    /** Current loaded event's metadata. */
    eventMetadata: {
        runNumber: string;
        eventNumber: string;
    };
    /**
     * Create the state manager.
     * @returns The state manager instance.
     */
    constructor();
    /**
     * Get the instance of state manager.
     * @returns The state manager instance.
     */
    static getInstance(): StateManager;
    /**
     * Set the root node of Phoenix menu.
     * @param phoenixMenuRoot Phoenix menu root node.
     */
    setPhoenixMenuRoot(phoenixMenuRoot: PhoenixMenuNode): void;
    /**
     * Save the state of the event display as JSON.
     */
    saveStateAsJSON(): void;
    /**
     * Load the state from JSON.
     * @param json JSON for state.
     */
    loadStateFromJSON(json: string | {
        [key: string]: any;
    }): void;
    /**
     * Set the state of clipping.
     * @param clipping Whether the clipping is enabled or not.
     */
    setClippingEnabled(clipping: boolean): void;
    /**
     * Set the start clipping angle of clipping.
     * @param angle Angle for clipping.
     */
    setStartClippingAngle(angle: number): void;
    /**
     * Get the start clipping angle of clipping.
     * @returns The starting angle of clipping.
     */
    getStartClippingAngle(): number;
    /**
     * Set the opening angle of clipping.
     * @param angle Angle for clipping.
     */
    setOpeningClippingAngle(angle: number): void;
    /**
     * Get the opening angle of clipping.
     * @returns The opening angle of clipping.
     */
    getOpeningClippingAngle(): number;
    /**
     * Set the scene camera for state.
     * @param camera The camera.
     */
    setCamera(camera: Camera): void;
    /**
     * Set the event display.
     * @param eventDisplay The event display.
     */
    setEventDisplay(eventDisplay: EventDisplay): void;
}
