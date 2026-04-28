import { type PhoenixMenuConfigs } from './config-types';
/**
 * A single node of phoenix menu item.
 */
export declare class PhoenixMenuNode {
    /** Name of the node. */
    name: string;
    /** Icon of the node. */
    icon: string;
    /** Function on toggling the node. */
    onToggle: (value: boolean) => void;
    /** If the node toggle state is true or false. */
    toggleState: boolean;
    /** Children of the node. */
    children: PhoenixMenuNode[];
    /** Configuration options in the node. */
    configs: PhoenixMenuConfigs[keyof PhoenixMenuConfigs][];
    /** Level of the node. */
    nodeLevel: number;
    /** Parent of the node. */
    private parent;
    /**
     * Previous toggle state of child nodes. This is so that the
     * previous state of child can be restored if we toggle the parent back on.
     */
    private childrenToggleState;
    /** If the node children are active or not. */
    childrenActive: boolean;
    /** If the node configuration options are active or not. */
    configActive: boolean;
    /**
     * Create the phoenix menu node.
     * @param name Name of the node.
     * @param icon Icon of the node.
     * @param onToggle Function on toggling the node.
     * @param children Children of the node.
     * @param configs Configuration options in the node.
     * @param parent Parent of the node.
     */
    constructor(name: string, icon?: string, onToggle?: (value: boolean) => void, children?: PhoenixMenuNode[], configs?: PhoenixMenuConfigs[keyof PhoenixMenuConfigs][], parent?: PhoenixMenuNode);
    /**
     * Add a child to the phoenix menu item.
     * @param name Name of the child.
     * @param onToggle Function on toggling the child.
     * @param icon Icon of the child.
     * @returns The child node.
     */
    addChild(name: string, onToggle?: (value: boolean) => void, icon?: string): PhoenixMenuNode;
    /**
     * Remove a child node.
     * @param child The child node to be removed.
     * @returns The current node.
     */
    removeChild(child: PhoenixMenuNode): PhoenixMenuNode;
    /**
     * Remove the current node.
     */
    remove(): void;
    /**
     * Remove all children.
     */
    truncate(): void;
    /**
     * Add a config to the phoenix menu item.
     * @param config config to be displayed as a Phoenix Menu item.
     * @returns The current node.
     */
    addConfig(config: PhoenixMenuConfigs[keyof PhoenixMenuConfigs]): PhoenixMenuNode;
    /**
     * Function for toggling the current and all child nodes.
     * @param value If the node itself and descendants are to be made true or false.
     */
    toggleSelfAndDescendants(value: boolean): void;
    /**
     * Apply the current values of config by calling the change function.
     * @param config Config whose values are to be applied.
     */
    applyConfigState(config: any): void;
    /**
     * Get current state of the node as an object.
     * @returns State of the node as an object.
     */
    getNodeState(): {
        [key: string]: any;
    };
    /**
     * Load the state of the phoenix menu node from JSON.
     * @param json JSON containing the phoenix menu node state.
     */
    loadStateFromJSON(json: string | {
        [key: string]: any;
    }): void;
    /**
     * Find a node in the tree by name.
     * @param name Name of the node to find.
     * @returns The found node.
     */
    findInTree(name: string): PhoenixMenuNode | undefined;
    /**
     * Find a node in the tree by name or create one.
     * @param name Name of the node to find or create.
     * @returns The found or created node.
     */
    findInTreeOrCreate(name: string): PhoenixMenuNode;
}
