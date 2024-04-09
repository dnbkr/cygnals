// @deno-types="npm:@types/react"
import { useSyncExternalStore } from "npm:react";
import type { Readable } from "./index.ts";

/**
 * a react hook for using the current value of a readable and re-rendering on change
 *
 * @param readable the readable you want to use
 * @returns the current value of the readable
 * @example ```tsx
 * const text = state("")
 *
 * function Component() {
 *   const value = useCygnal(text)
 *   return <span>{value}</span>
 * }
 * ```
 */
export function useCygnal<T>(readable: Readable<T>): Readonly<T> {
  return useSyncExternalStore(
    readable.onChange,
    readable.current,
    readable.current
  );
}
