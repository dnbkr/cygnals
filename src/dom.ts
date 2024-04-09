import { type Readable, state } from "./index.ts";

/**
 * create a readable of events from a DOM element
 * @param element any HTML element
 * @param event any valid DOM event type
 * @returns a readable of the DOM event
 * @example ```typescript
 * const element = document.getElementById("my-element")
 * const clicks = fromEvent(element, "click")
 * clicks.onChange(console.log) // will log all click events on the element
 * ```
 */
export function fromEvent<
  E extends HTMLElement,
  V extends keyof HTMLElementEventMap
>(element: E, event: V): Readable<HTMLElementEventMap[V] | undefined> {
  const events = state<HTMLElementEventMap[V] | undefined>(undefined);

  function listener(event: HTMLElementEventMap[V]) {
    events.set(event);
  }

  const subCount = state(0);
  subCount.onChange((count) => {
    if (count > 0) {
      element.addEventListener(event, listener);
    } else {
      element.removeEventListener(event, listener);
    }
  });

  return {
    current: events.current,
    subscribe(callback) {
      const unsubscribe = events.subscribe(callback);
      subCount.set(subCount.current() + 1);
      return () => {
        subCount.set(subCount.current() - 1);
        unsubscribe();
      };
    },
    onChange(callback) {
      const unsubscribe = events.onChange(callback);
      subCount.set(subCount.current() + 1);
      return () => {
        subCount.set(subCount.current() - 1);
        unsubscribe();
      };
    },
  };
}
