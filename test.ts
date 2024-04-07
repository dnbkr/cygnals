import { state } from "./src/index.ts";

import { assertEquals } from "https://deno.land/std@0.221.0/assert/mod.ts";
import {
  assertSpyCalls,
  assertSpyCallArg,
  spy,
} from "https://deno.land/std@0.221.0/testing/mock.ts";

Deno.test("get current state", () => {
  const message = state("hello");
  assertEquals(message.current(), "hello");
});

Deno.test("set state", () => {
  const message = state("hello");
  assertEquals(message.current(), "hello");
  message.set("world");
  assertEquals(message.current(), "world");
});

Deno.test("subscribe to state changes", () => {
  const callback = spy();
  const message = state("hello");
  message.onChange(callback);
  assertSpyCalls(callback, 0);
  message.set("world");
  assertSpyCalls(callback, 1);
});

Deno.test("no alert on equal values", () => {
  const callback = spy();
  const message = state("hello");
  message.onChange(callback);
  assertSpyCalls(callback, 0);
  message.set("hello");
  assertSpyCalls(callback, 0);
});

Deno.test("subscribe to state", () => {
  const callback = spy();
  const message = state("hello");
  message.subscribe(callback);
  assertSpyCallArg(callback, 0, 0, "hello");
  message.set("world");
  assertSpyCallArg(callback, 1, 0, "world");
  assertSpyCalls(callback, 2);
});

Deno.test("unsubscribe to state", () => {
  const callback = spy();
  const message = state("hello");
  const unsubscribe = message.subscribe(callback);
  assertSpyCallArg(callback, 0, 0, "hello");
  unsubscribe();
  message.set("world");
  assertSpyCalls(callback, 1);
});
