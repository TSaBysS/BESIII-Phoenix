/** Callback function type. */
export type CallbackFunction<T = any> = (updatedValue: T) => void;
/**
 * An active variable whose value can be changed and the change can be observed.
 */
export declare class ActiveVariable<T = any> {
    value?: T;
    /**
     * Create the observable active variable.
     * @param value Initial value.
     */
    constructor(value?: T);
    /**
     * Callbacks to call on update.
     */
    private callbacks;
    /**
     * Update the value of variable.
     * @param updatedValue New updated value.
     */
    update(updatedValue: T): void;
    /**
     * Call a function on updating the value of variable.
     * @param callback Callback to call with updated value when the variable is updated.
     */
    onUpdate(callback: CallbackFunction<T>): void;
}
