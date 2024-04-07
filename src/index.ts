/**
 * A callback function that is passed the current value
 */
export type ValueCallback<T> = (value: T) => void;

/**
 * An unsubscribe function which can be used to remove the subscription that produced it
 */
export type Unsubscribe = () => void;

/**
 * Creates a subscription which will call your callback when a value has changed.
 * It returns an unsubscription function to turn off the subscription.
 */
export type Subscribe<T> = (callback: ValueCallback<T>) => Unsubscribe;

/**
 * A Readable is a store for a particular value. The current value at this point in time
 * can be read, or you can subscribe to changes.
 */
export type Readable<T> = {
  /**
   * Get the current value at this point in time
   * @returns The Readable's value
   */
  current: () => T;
  /**
   * Subscribe to changes to the value and also get told the value right now.
   */
  subscribe: Subscribe<T>;
  /**
   * Subscribe to future changes to the value but not the value right now.
   */
  onChange: Subscribe<T>;
};

/**
 * A Writeable is a Readable that can also be written to.
 */
export type Writable<T> = Readable<T> & {
  /**
   * Set the current value
   * @param value the new value to set
   * @returns nothing
   */
  set: (value: T) => void;
};

/**
 * Create a new Writable
 * @param initialValue the initial value to start off the writable
 * @returns a writeable
 * @example ```typescript
 * const message = state("Hello")
 *
 * console.log(message.current()) // "Hello"
 * message.set("Hello, World!")
 * console.log(message.current()) // "Hello, World!"
 *
 * message.onChange(console.log)
 * message.set("Hello, There!")
 * // "Hello, There"
 * ```
 */
export function state<T>(initialValue: T): Writable<T> {
  const subscriptions = new Set<ValueCallback<T>>();
  let value = initialValue;
  return {
    current() {
      return value;
    },
    set(newValue) {
      const notify = newValue !== value;
      value = newValue;
      if (notify) {
        subscriptions.forEach((callback) => callback(value));
      }
    },
    subscribe(callback) {
      subscriptions.add(callback);
      callback(value);
      return () => subscriptions.delete(callback);
    },
    onChange(callback) {
      subscriptions.add(callback);
      return () => subscriptions.delete(callback);
    },
  };
}
