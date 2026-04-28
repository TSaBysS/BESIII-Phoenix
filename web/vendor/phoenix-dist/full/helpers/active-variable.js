/**
 * An active variable whose value can be changed and the change can be observed.
 */
export class ActiveVariable {
    /**
     * Create the observable active variable.
     * @param value Initial value.
     */
    constructor(value) {
        this.value = value;
        /**
         * Callbacks to call on update.
         */
        this.callbacks = [];
    }
    /**
     * Update the value of variable.
     * @param updatedValue New updated value.
     */
    update(updatedValue) {
        this.value = updatedValue;
        this.callbacks.forEach((callback) => callback(updatedValue));
    }
    /**
     * Call a function on updating the value of variable.
     * @param callback Callback to call with updated value when the variable is updated.
     */
    onUpdate(callback) {
        this.callbacks.push(callback);
    }
}
//# sourceMappingURL=active-variable.js.map