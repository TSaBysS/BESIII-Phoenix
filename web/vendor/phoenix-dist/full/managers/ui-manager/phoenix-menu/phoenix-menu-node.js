/**
 * A single node of phoenix menu item.
 */
export class PhoenixMenuNode {
    /**
     * Create the phoenix menu node.
     * @param name Name of the node.
     * @param icon Icon of the node.
     * @param onToggle Function on toggling the node.
     * @param children Children of the node.
     * @param configs Configuration options in the node.
     * @param parent Parent of the node.
     */
    constructor(name, icon, onToggle, children, configs, parent) {
        /** If the node toggle state is true or false. */
        this.toggleState = true;
        /** Children of the node. */
        this.children = [];
        /** Configuration options in the node. */
        this.configs = [];
        /** Level of the node. */
        this.nodeLevel = 0;
        /**
         * Previous toggle state of child nodes. This is so that the
         * previous state of child can be restored if we toggle the parent back on.
         */
        this.childrenToggleState = {};
        /** If the node children are active or not. */
        this.childrenActive = false;
        /** If the node configuration options are active or not. */
        this.configActive = false;
        this.name = name;
        if (icon)
            this.icon = icon;
        if (onToggle)
            this.onToggle = onToggle;
        if (children)
            this.children = children;
        if (configs)
            this.configs = configs;
        if (parent)
            this.parent = parent;
    }
    /**
     * Add a child to the phoenix menu item.
     * @param name Name of the child.
     * @param onToggle Function on toggling the child.
     * @param icon Icon of the child.
     * @returns The child node.
     */
    addChild(name, onToggle, icon) {
        const child = new PhoenixMenuNode(name, icon, onToggle);
        child.parent = this;
        child.nodeLevel = this.nodeLevel + 1;
        this.children.push(child);
        return child;
    }
    /**
     * Remove a child node.
     * @param child The child node to be removed.
     * @returns The current node.
     */
    removeChild(child) {
        const childIndex = this.children.indexOf(child);
        this.children.splice(childIndex, 1);
        return this;
    }
    /**
     * Remove the current node.
     */
    remove() {
        if (this.parent) {
            this.parent.removeChild(this);
        }
        else {
            console.error('Cannot delete root node of phoenix menu. Set it to undefined/null instead.');
        }
    }
    /**
     * Remove all children.
     */
    truncate() {
        this.children = [];
    }
    /**
     * Add a config to the phoenix menu item.
     * @param config config to be displayed as a Phoenix Menu item.
     * @returns The current node.
     */
    addConfig(config) {
        this.configs.push(config);
        // Apply the values of config
        this.applyConfigState(config);
        return this;
    }
    /**
     * Function for toggling the current and all child nodes.
     * @param value If the node itself and descendants are to be made true or false.
     */
    toggleSelfAndDescendants(value) {
        this.onToggle?.(value);
        this.toggleState = value;
        for (const child of this.children) {
            if (!value) {
                // Save previous toggle state of children and toggle them false
                this.childrenToggleState[child.name] = child.toggleState;
                child.toggleSelfAndDescendants(value);
            }
            else {
                // Restore previous toggle state of children
                child.toggleState = this.childrenToggleState[child.name];
                child.toggleSelfAndDescendants(child.toggleState);
            }
        }
    }
    /**
     * Apply the current values of config by calling the change function.
     * @param config Config whose values are to be applied.
     */
    applyConfigState(config) {
        // Apply configs of different config types - manual
        if (config.type === 'checkbox' && config?.['isChecked']) {
            config.onChange?.(config?.['isChecked']);
        }
        else if (config.type === 'color' && config?.['color']) {
            if (this.name === 'Labels' || this.parent?.name === 'Labels') {
                // Exception for Labels node (and sub labels), which should always have color applied
                config.onChange?.(config?.['color']);
            }
            else if (config.group !== undefined) {
                // Ignore color by options with `!config.group`, otherwise the collection color is overridden
                config.onChange?.(config?.['color']);
            }
        }
        else if (config.type === 'slider' && config?.['value']) {
            config.onChange?.(config?.['value']);
        }
        else if (config.type === 'rangeSlider' &&
            config?.['value'] !== undefined) {
            config.onChange?.({
                value: config?.['value'],
                highValue: config?.['highValue'],
            });
            config.setEnableMin?.(config?.['enableMin']);
            config.setEnableMax?.(config?.['enableMax']);
        }
    }
    /**
     * Get current state of the node as an object.
     * @returns State of the node as an object.
     */
    getNodeState() {
        const phoenixNodeJSON = {};
        phoenixNodeJSON['name'] = this.name;
        phoenixNodeJSON['nodeLevel'] = this.nodeLevel;
        phoenixNodeJSON['toggleState'] = this.toggleState;
        phoenixNodeJSON['childrenActive'] = this.childrenActive;
        phoenixNodeJSON['configs'] = this.configs;
        phoenixNodeJSON['children'] = [];
        for (const child of this.children) {
            phoenixNodeJSON['children'].push(child.getNodeState());
        }
        return phoenixNodeJSON;
    }
    /**
     * Load the state of the phoenix menu node from JSON.
     * @param json JSON containing the phoenix menu node state.
     */
    loadStateFromJSON(json) {
        let jsonObject;
        if (typeof json === 'string') {
            jsonObject = JSON.parse(json);
        }
        else {
            jsonObject = json;
        }
        this.childrenActive = jsonObject['childrenActive'];
        this.toggleState = jsonObject['toggleState'];
        this.onToggle?.(this.toggleState);
        for (const configState of jsonObject['configs']) {
            const nodeConfigs = this.configs.filter((nodeConfig) => nodeConfig.type === configState['type'] &&
                nodeConfig.label === configState['label']);
            if (nodeConfigs.length > 1) {
                console.error('Multiple configs found with same label and type in phoenix menu node.');
            }
            if (nodeConfigs.length === 0) {
                console.error('No config found with label and type in phoenix menu node. Aborting.');
                return;
            }
            const nodeConfig = nodeConfigs[0];
            // console.log('nodeConfig', nodeConfig);
            if (nodeConfig) {
                for (const prop in configState) {
                    const key = prop;
                    // console.log('prop',prop, 'key', key, 'nodeConfig[key]', nodeConfig[key]);
                    nodeConfig[key] = configState[key];
                }
                this.applyConfigState(nodeConfig);
            }
        }
        // Now handle children
        for (const childState of jsonObject['children']) {
            const nodeChild = this.children.filter((nodeChild) => nodeChild.name === childState.name &&
                nodeChild.nodeLevel === childState.nodeLevel)[0];
            if (nodeChild) {
                nodeChild.loadStateFromJSON(childState);
            }
        }
    }
    /**
     * Find a node in the tree by name.
     * @param name Name of the node to find.
     * @returns The found node.
     */
    findInTree(name) {
        if (this.name === name) {
            return this;
        }
        else {
            for (const child of this.children) {
                const nodeFound = child.findInTree(name);
                if (nodeFound) {
                    return nodeFound;
                }
            }
        }
    }
    /**
     * Find a node in the tree by name or create one.
     * @param name Name of the node to find or create.
     * @returns The found or created node.
     */
    findInTreeOrCreate(name) {
        let prevNode = this;
        name.split('>').forEach((nodeName) => {
            nodeName = nodeName.trim();
            const nodeFound = prevNode.findInTree(nodeName);
            // const nodeFound = prevNode.children.find(child => child.name === nodeName);
            prevNode = nodeFound ? nodeFound : prevNode.addChild(nodeName, () => { });
        });
        return prevNode;
    }
}
//# sourceMappingURL=phoenix-menu-node.js.map