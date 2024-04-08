import {
  state,
  from,
  readonly,
  limit,
  debounce,
  unwrapPromise,
  fulfilled,
  pending,
  rejected,
} from "./src/index.ts";
import { fromEvent } from "./src/dom.ts";

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

Deno.test("promise won't resolve unless current called", async () => {
  const time = new FakeTime();
  const spyFn = spy();
  try {
    const fatch = <T extends string>(url: T) =>
      new Promise<{ result: true; url: T }>((resolve) =>
        setTimeout(() => {
          spyFn();
          resolve({ result: true, url });
        }, 500)
      );

    const url = state("/api");
    from(url, fatch);
    assertSpyCalls(spyFn, 0);
    await time.tickAsync(1000);
    assertSpyCalls(spyFn, 0);
  } finally {
    time.restore();
  }
});

Deno.test("unwraped promise", async () => {
  const time = new FakeTime();
  const spyFn = spy();
  try {
    const fatch = <T extends string>(url: T) =>
      new Promise<{ result: true; url: T }>((resolve) =>
        setTimeout(() => {
          spyFn();
          resolve({ result: true, url });
        }, 500)
      );

    const url = state("/api");
    const result = unwrapPromise(from(url, fatch));
    assertEquals(result.current().pending, true);
    assertEquals(result.current().result, undefined);
    await time.tickAsync(1000);
    assertEquals(result.current().pending, false);
    assertEquals(result.current().result?.result, true);
  } finally {
    time.restore();
  }
});

Deno.test("unwraped promise subscription", async () => {
  const time = new FakeTime();
  const spyFn = spy();
  try {
    const fatch = (url: string) =>
      new Promise<string>((resolve) =>
        setTimeout(() => {
          resolve("resolved: " + url);
        }, 500)
      );

    const url = state("/api");
    const result = unwrapPromise(from(url, fatch));
    result.subscribe(spyFn);
    assertSpyCallArg(spyFn, 0, 0, {
      error: undefined,
      pending: true,
      result: undefined,
    });
    await time.tickAsync(1000);
    assertSpyCallArg(spyFn, 1, 0, {
      error: undefined,
      pending: false,
      result: "resolved: /api",
    });
    url.set("/foo");
    assertSpyCallArg(spyFn, 2, 0, {
      error: undefined,
      pending: true,
      result: undefined,
    });
    await time.tickAsync(1000);
    assertSpyCallArg(spyFn, 3, 0, {
      error: undefined,
      pending: false,
      result: "resolved: /foo",
    });
    assertSpyCalls(spyFn, 4);
  } finally {
    time.restore();
  }
});

Deno.test("fulfilled promise", async () => {
  const time = new FakeTime();
  const spyFn = spy();
  try {
    const fatch = (url: string) =>
      new Promise<string>((resolve) =>
        setTimeout(() => {
          resolve("resolved: " + url);
        }, 500)
      );

    const url = state("/api");
    const result = fulfilled(from(url, fatch));
    result.subscribe(spyFn);
    assertSpyCallArg(spyFn, 0, 0, undefined);
    await time.tickAsync(1000);
    assertSpyCallArg(spyFn, 1, 0, "resolved: /api");
    url.set("/foo");
    await time.tickAsync(1000);
    assertSpyCallArg(spyFn, 2, 0, "resolved: /foo");
    assertSpyCalls(spyFn, 3);
  } finally {
    time.restore();
  }
});

Deno.test("pending promise status", async () => {
  const time = new FakeTime();
  const spyFn = spy();
  try {
    const fatch = (url: string) =>
      new Promise<string>((resolve) =>
        setTimeout(() => {
          resolve("resolved: " + url);
        }, 500)
      );

    const url = state("/api");
    const isPending = pending(from(url, fatch));
    isPending.subscribe(spyFn);
    assertSpyCallArg(spyFn, 0, 0, true);
    await time.tickAsync(1000);
    assertSpyCallArg(spyFn, 1, 0, false);
    url.set("/foo");
    assertSpyCallArg(spyFn, 2, 0, true);
    await time.tickAsync(1000);
    assertSpyCallArg(spyFn, 3, 0, false);
    assertSpyCalls(spyFn, 4);
  } finally {
    time.restore();
  }
});

Deno.test("rejected promise", async () => {
  const time = new FakeTime();
  const spyFn = spy();
  try {
    const fatch = <T extends string>(url: T) =>
      new Promise<{ result: true; url: T }>((_, reject) =>
        setTimeout(() => {
          spyFn();
          reject("rejected: " + url);
        }, 500)
      );

    const url = state("/api");
    const result = unwrapPromise(from(url, fatch));
    assertEquals(result.current().pending, true);
    assertEquals(result.current().result, undefined);
    assertEquals(result.current().error, undefined);
    await time.tickAsync(1000);
    assertEquals(result.current().pending, false);
    assertEquals(result.current().result, undefined);
    assertEquals(result.current().error, "rejected: /api");
  } finally {
    time.restore();
  }
});

Deno.test("rejected promise status", async () => {
  const time = new FakeTime();
  const spyFn = spy();
  try {
    const fatch = (url: string) =>
      new Promise<string>((_, reject) =>
        setTimeout(() => {
          reject("rejected: " + url);
        }, 500)
      );

    const url = state("/api");
    const error = rejected(from(url, fatch));
    error.subscribe(spyFn);
    assertSpyCallArg(spyFn, 0, 0, undefined);
    await time.tickAsync(1000);
    assertSpyCallArg(spyFn, 1, 0, "rejected: /api");
    assertSpyCalls(spyFn, 2);
  } finally {
    time.restore();
  }
});

Deno.test("DOM: fromEvent", () => {
  const mockElement = {
    _callbacks: new Set<(event: MouseEvent) => void>(),
    addEventListener(_event: "click", callback: (event: MouseEvent) => void) {
      this._callbacks.add(callback);
    },
    removeEventListener(
      _event: "click",
      callback: (event: MouseEvent) => void
    ) {
      this._callbacks.delete(callback);
    },
    click() {
      this._callbacks.forEach((callback) => {
        callback({ event: true } as unknown as MouseEvent);
      });
    },
  };
  const element = mockElement as unknown as HTMLElement;

  const callback = spy();
  const clicks = fromEvent(element, "click");
  assertEquals(clicks.current(), undefined);
  const unsub = clicks.onChange(callback);
  element.click();
  assertSpyCallArg(callback, 0, 0, { event: true });
  element.click();
  assertSpyCallArg(callback, 1, 0, { event: true });
  unsub();
  element.click();
  assertSpyCalls(callback, 2);
});
