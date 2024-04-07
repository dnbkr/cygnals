import { state, from, readonly, limit, debounce } from "./src/index.ts";

import { assertEquals } from "https://deno.land/std@0.221.0/assert/mod.ts";
import {
  assertSpyCalls,
  assertSpyCallArg,
  spy,
} from "https://deno.land/std@0.221.0/testing/mock.ts";
import { FakeTime } from "https://deno.land/std@0.221.0/testing/time.ts";

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

Deno.test("get current computed value", () => {
  const message = state("hello");
  const shouted = from(message, (message) => message.toUpperCase());
  assertEquals(shouted.current(), "HELLO");
});

Deno.test("get computed value after state change", () => {
  const message = state("hello");
  const shouted = from(message, (message) => message.toUpperCase());
  assertEquals(shouted.current(), "HELLO");
  message.set("world");
  assertEquals(shouted.current(), "WORLD");
});

Deno.test("subscribe to computed changes", () => {
  const callback = spy();
  const message = state("hello");
  const shouted = from(message, (message) => message.toUpperCase());
  shouted.subscribe(callback);
  assertSpyCallArg(callback, 0, 0, "HELLO");
  message.set("world");
  assertSpyCallArg(callback, 1, 0, "WORLD");
  assertSpyCalls(callback, 2);
});

Deno.test("subscribe to computed from computed", () => {
  const callback = spy();
  const message = state("hello");
  const shouted = from(message, (message) => message.toUpperCase());
  const formatted = from(shouted, (message) => `Message: ${message}`);
  formatted.subscribe(callback);
  assertSpyCallArg(callback, 0, 0, "Message: HELLO");
  message.set("world");
  assertSpyCallArg(callback, 1, 0, "Message: WORLD");
  assertSpyCalls(callback, 2);
});

Deno.test("multiple dependencies computed", () => {
  const callback = spy();
  const one = state(1);
  const two = state(2);
  const three = state(3);
  const sum = from([one, two, three], (one, two, three) => one + two + three);
  sum.subscribe(callback);
  assertSpyCallArg(callback, 0, 0, 6);
  assertSpyCalls(callback, 1);
});

Deno.test("multiple dependencies computed with change", () => {
  const callback = spy();
  const one = state(1);
  const two = state(2);
  const three = state(3);
  const sum = from([one, two, three], (one, two, three) => one + two + three);
  sum.subscribe(callback);
  assertSpyCallArg(callback, 0, 0, 6);
  three.set(6);
  assertSpyCallArg(callback, 1, 0, 9);
  assertSpyCalls(callback, 2);
});

Deno.test("lazy computations", () => {
  const spyFn = spy();
  const number = state(1);
  const double = from(number, (number) => {
    spyFn();
    return number * 2;
  });
  assertSpyCalls(spyFn, 0);
  number.set(2);
  assertSpyCalls(spyFn, 0);
  double.current();
  assertSpyCalls(spyFn, 1);
});

Deno.test("lazy change alerts, eager subscriptions", () => {
  const spyFn = spy();
  const number = state(1);
  const double = from(number, (number) => {
    spyFn();
    return number * 2;
  });
  double.onChange(() => {});
  assertSpyCalls(spyFn, 0);
  double.subscribe(() => {});
  assertSpyCalls(spyFn, 1);
  number.set(2);
  assertSpyCalls(spyFn, 2);
});

Deno.test("readonly", () => {
  const writable = state("hello");
  const noWritable = readonly(writable);
  assertEquals("set" in noWritable, false);
});

Deno.test("allow all limitation", () => {
  const string = state("hello");
  const limited = limit(string, () => true);
  assertEquals(limited.current(), "hello");
});

Deno.test("prevent all limitation", () => {
  const string = state("hello");
  const limited = limit(string, () => false);
  assertEquals(limited.current(), null);
});

Deno.test("limitation subscription", () => {
  const callback = spy();
  const string = state("hello");
  const limited = limit(string, (string) => string === "hello");
  limited.subscribe(callback);
  assertSpyCallArg(callback, 0, 0, "hello");
  string.set("world");
  assertSpyCalls(callback, 1);
});

Deno.test("debounce limitation", () => {
  const time = new FakeTime();
  try {
    const callback = spy();
    const string = state("hello");
    const debounced = limit(string, debounce(1000));
    debounced.onChange(callback);
    assertSpyCalls(callback, 0);
    string.set("w");
    string.set("wo");
    string.set("wor");
    string.set("worl");
    string.set("world");
    assertSpyCalls(callback, 0);
    time.tick(1000);
    assertSpyCalls(callback, 1);
    assertSpyCallArg(callback, 0, 0, "world");
  } finally {
    time.restore();
  }
});
