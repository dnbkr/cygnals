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

/**
 * Get the type of the value of a Readable
 */
export type ValueOf<T extends Readable<unknown>> = ReturnType<T["current"]>;

/**
 * Get the types of the values in a list of Readables
 */
type ValuesOf<T extends Readable<unknown>[]> = {
  [I in keyof T]: ValueOf<T[I]>;
};

/**
 * a unique symbol to represent an undefined value in an
 * environment where `undefined` might in fact _be_ the value
 * and we need to distingush between the two
 */
const empty = Symbol();

/**
 * the unique 'type' of `empty`
 */
type Empty = typeof empty;

/**
 * Compute a new value from one or more existing Readables
 * @param dependency a readable to track
 * @param fn a function to create the computed value
 * @example ```typescript
 * const message = state("hello")
 * const shout = from(message, message => message.toUpperCase())
 * console.log(shout.current()) // "HELLO"
 *
 * const a = state(2)
 * const b = state(2)
 * const sum = from([a, b], (a, b) => a + b)
 * console.log(sum.current()) // 4
 * ```
 */
export function from<T, D extends Readable<unknown>>(
  dependency: D,
  fn: (value: ValueOf<D>) => T
): Readable<T>;
/**
 *
 * @param dependencies a list of readables to track
 * @param fn a function to create the computed value
 * ```
 */
export function from<T, D extends Readable<unknown>[]>(
  dependencies: [...D],
  fn: (...values: ValuesOf<D>) => T
): Readable<T>;
export function from<T, D extends Readable<unknown>[]>(
  dependencies: D[number] | [...D],
  fn: (...values: ValuesOf<D>) => T
): Readable<T> {
  const deps = Array.isArray(dependencies) ? dependencies : [dependencies];

  function computeValue() {
    const depValues = deps.map((dep) => dep.current()) as ValuesOf<D>;
    return fn(...depValues);
  }

  const value = state<T | Empty>(empty);
  const dirty = state(true);

  function safelyGetCurrentValue() {
    const current = value.current();
    const isDirty = dirty.current();
    if (current === empty || isDirty) {
      const computed = computeValue();
      if (computed !== current) {
        dirty.set(false);
        value.set(computed);
      }
      return computed;
    }
    return current;
  }

  deps.forEach((dep) => dep.onChange(() => dirty.set(true)));

  function callCallback(callback: ValueCallback<T>) {
    return function (dirty: boolean) {
      if (dirty) {
        callback(safelyGetCurrentValue());
      }
    };
  }

  return {
    current() {
      return safelyGetCurrentValue();
    },
    subscribe(callback) {
      return dirty.subscribe(callCallback(callback));
    },
    onChange(callback) {
      return dirty.onChange(callCallback(callback));
    },
  };
}

/**
 * create a readable from a writable
 * @param state the writable to create a readable from
 * @returns a readable derived from the writable
 * @example ```typescript
 * const writable = state(42)
 * const readable = readonly(writable)
 *
 * console.log(readable.current()) // 42
 * ```
 */
export function readonly<T>(state: Readable<T>): Readable<T> {
  const { current, subscribe, onChange } = state;
  return { current, subscribe, onChange };
}

/**
 * a function to limit a readable. is is passed a value to evaluate
 * and should return a boolean to decide if the value should be kept
 * or not. It is also passed the result writable, which can be useful
 * for limitations that need to delay the value being written
 */
export type Limitation<T> = (
  value: T,
  writable?: Writable<T | null>
) => boolean;

/**
 * limit a source readable using one or more limitation functions
 * @param source the readable to limit
 * @param limitations a series of function to decide if a value should be accepted
 * @returns the result readable, after limitations have been applied
 * @example ```typescript
 * const number = state(1)
 *
 * const oddOnly = limit(number, number => number % 2 === 1)
 *
 * console.log(oddOnly.current()) // 1
 * number.set(2)
 * console.log(oddOnly.current()) // 1
 * number.set(3)
 * console.log(oddOnly.current()) // 3
 * ```
 */
export function limit<T>(
  source: Readable<T>,
  ...limitations: Limitation<T>[]
): Readable<T | null> {
  const initialSource = source.current();

  const value = state(
    limitations.every((limitation) => limitation(initialSource))
      ? initialSource
      : null
  );

  source.onChange((source) => {
    if (limitations.every((limitation) => limitation(source, value))) {
      value.set(source);
    }
  });

  return readonly(value);
}

/**
 * a debounce limitation. useful to slow down a series of rapid
 * changes from a source
 * @param ms the number of miliseconds to wait before accepting the latest value
 * @returns a debounce limitation function
 * @example ```typescript
 * const textInputValue = state("")
 * const debounced = limit(textInputValue, debounce(500))
 * ```
 */
export function debounce<T>(ms: number): Limitation<T> {
  let timeout: number | undefined;
  return function (value, writable) {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      writable?.set(value);
    }, ms);
    return false;
  };
}

/**
 * a promise that has been 'unwrapped' so that you can observe it's state
 */
export interface UnwrappedPromise<T> {
  /**
   * the promise's result, or undefined if not resolved
   */
  result: T | undefined;
  /**
   * true if the promise is 'pending'
   */
  pending: boolean;
  /**
   * a reason that the promise may have rejected with.
   * could be a string, or an error objected, or anything
   */
  error: unknown | undefined;
}

/**
 * create a readable of an unwrapped promise, from a readable of a promise
 *
 * **this will `await` the promise**
 *
 * @param readable a readable containing a promise
 * @returns the unwrapped value of the promise
 * @example ```typescript
 * const url = state("/api")
 * const request = from(url, fetch)
 * const result = unwrapPromise(request)
 *
 * console.log(result.current().result) // undefined
 *
 * // wait some time for the fetch to complete
 *
 * console.log(result.current().result) // the response from fetch
 *
 * ```
 */
export function unwrapPromise<T>(
  readable: Readable<Promise<T>>
): Readable<UnwrappedPromise<T>> {
  const unwrapped = state<UnwrappedPromise<T>>({
    result: undefined,
    pending: false,
    error: undefined,
  });

  readable.subscribe(async (promise) => {
    unwrapped.set({ error: undefined, result: undefined, pending: true });
    try {
      const result = await promise;
      unwrapped.set({ pending: false, result, error: undefined });
    } catch (error) {
      unwrapped.set({ pending: false, result: undefined, error });
    }
  });

  return readonly(unwrapped);
}

/**
 * extract a readable of just the fulfulled value of the promise.
 *
 * this will retain the latest known value, even if the promise changes
 * to pending or rejects.
 *
 * **this will `await` the promise**
 *
 * @param promise a readable containing a promise
 * @returns a readable of the promise's last known value
 * @example ```typescript
 * const url = state("/api")
 * const request = from(url, fetch)
 * const response = fullfilled(request)
 * response.onChange(console.log) // eventually will log the response
 * ```
 */
export function fulfilled<T>(
  promise: Readable<Promise<T>>
): Readable<T | undefined> {
  return from(
    limit(
      unwrapPromise(promise),
      ({ pending, error }) => !pending && error === undefined
    ),
    (promise) => promise?.result
  );
}

/**
 * extract the pending state of a readable promise
 *
 * **this will `await` the promise**
 * @param promise a readable containing a promise
 * @returns a readable containing a boolean, which is true of the promise is pending
 * @example ```typescript
 * const url = state("/api")
 * const request = from(url, fetch)
 * const loading = pending(request)
 * response.onChange(console.log) // eventually will log `true`
 * ```
 */
export function pending<T>(promise: Readable<Promise<T>>): Readable<boolean> {
  return from(unwrapPromise(promise), ({ pending }) => pending);
}

/**
 * extract any rejection value of a readable promise
 *
 * **this will `await` the promise**
 *
 * @param promise a readable containing a promise
 * @returns a readable containing the reason for a rejection, if any
 * @example ```typescript
 * const url = state("/api")
 * const request = from(url, fetch)
 * const errors = rejected(request)
 * errors.onChange(console.log) // eventually will log... nothing, if all goes well!
 * ```
 */
export function rejected<T>(promise: Readable<Promise<T>>): Readable<unknown> {
  return from(unwrapPromise(promise), ({ error }) => error);
}
