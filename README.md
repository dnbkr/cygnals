<div align="center">

# Cygnals

![an illustration of a cygnet](cygnet.png)

Tools for working with reactive data

</div>

## Installation

This package is published to JSR and NPM

### NPM

https://www.npmjs.com/package/cygnals

| Package Manager | Command               |
| --------------- | --------------------- |
| NPM             | `npm install cygnals` |
| Yarn            | `yarn add cygnals`    |
| pnpm            | `pnpm cygnals`        |
| Bun             | `bun add cygnals`     |

### JSR

https://jsr.io/@dnbkr/cygnals

| Package Manager | Command                           |
| --------------- | --------------------------------- |
| Deno            | `deno add @dnbkr/cygnals`         |
| NPM             | `npx jsr add @dnbkr/cygnals`      |
| Yarn            | `yarn dlx jsr add @dnbkr/cygnals` |
| pnpm            | `pnpm dlx jsr add @dnbkr/cygnals` |
| Bun             | `bunx jsr add @dnbkr/cygnals`     |

## Tutorial

### State

Encapsulate data that can change using `state`

```typescript
const message = state("hello");
```

You can set the state, and get the current state for any given point in time:

```typescript
const message = state("hello");

message.current(); // "hello"

message.set("hello, world");

message.current(); // "hello, world"
```

And you can subscribe to changes:

```typescript
const message = state("hello");
message.subscribe(console.log); // Console: "hello"

message.set("hello, world"); // Console: "hello, world"
```

if your handler only cares about future changes, you can do that too:

```typescript
const message = state("hello");
message.onChange(console.log);

message.set("hello, world"); // Console: "hello, world"
```

both `.subscribe` and `.onChange` return unsubscribe functions too

```typescript
const message = state("hello");
const unsubscribe = message.onChange(console.log);

message.set("hello, world"); // Console: "hello, world"

unsubscribe();

message.set("hello?"); // nothing is output, because you unsubscribed
```

### Computed / derived values

If you want to calculate a value from some other values, you can do that too

```typescript
const message = state("hello");
const shouted = from(message, (message) => message.toUpperCase());

shouted.current(); // "HELLO"
```

`from` returns a `Readable`, which is the same as what `.state` returns, except without the `.set` method, so it can be subscribed to in the same way.

It's also lazily evaluated, so your computation function will only be run when `.current` or `.subscribe` is called.

And you can track multiple values too:

```typescript
const a = state(1);
const doubled = from(a, (a) => a * 2);
const b = state(3);
const sum = from([doubled, b], (doubled, b) => doubled + b); // 5
```

With just `state` and `from` you've got the nuts and bolts of a reactive data system. But there's some more tools included to help you out...

### Async

It's common to need to deal with async values. `state` and `from` don't do anything special when your value is a promise:

```typescript
const url = state("/api");
const promise = from(url, fetch); // the value of this readable is a Promise
```

but if you want to deal with the value of your promise without any hassle, you can:

```typescript
const url = state("/api");
const request = from(url, fetch);
const response = fulfilled(request); // the value of this readable is a Response
```

Note that in the above example, if you change the url state with `url.set` then your `response` readable will (eventually) change with the new response too.

You might need to know if the promise is pending, for example to animate a loading spinner in your UI:

```typescript
const url = state("/api");
const request = from(url, fetch);
const busy = pending(request); // the value of this readable is a boolean
```

or if the promise rejects too:

```typescript
const url = state("/api");
const request = from(url, fetch);
const error = rejected(request); // the value of this readable is a unknown, because a promise could reject with anything as the reason
```

and actually, you might want all these things at once:

```typescript
const url = state("/api");
const request = from(url, fetch);
const response = unwrapPromise(request); // the value of this readable is `{ result, pending, error }`
```

### Readonly

If you have a piece of state and you just want to expose a read only view of it, you can use this utility:

```typescript
const message = state("hello");
const readOnlyMessage = readonly(message);
```

if you want to create a value that can never change, you can do

```typescript
const immutable = readonly(state("hello"));
```

### Limitations

It's not uncommon to want to filter a source of values when deriving your new value. You can do that with limitations:

```typescript
const number = state(1);
const oddNumbers = limit(number, (number) => number % 2 === 1);
oddNumbers.subscribe(console.log); // Console: 1
number.set(2); // nothing is logged to the console
number.set(3); // Console: 3
```

And you can pass in a bunch of limitations; they are evaluated in order and just need to return a boolean - `true` if you want to keep the value and `false` if you want to filter it:

```typescript
const oddOnly = (number) => number % 2 === 1;
const lessThanSeven = (number) => number < 7;

const number = state(3);
const filtered = limit(number, oddOnly, lessThanSeven);
filtered.subscribe(console.log); // Console: 3
number.set(4);
number.set(5); // Console: 5
number.set(6);
number.set(7);
```

Limitation functions are passed a second parameter - a writable. This is the writable that the limit function stores internally which will be returned as a readable to consume. One example of this being useful would be if you wanted to alter the time that values are written to the store, such as with a debounce...

#### Debounce

An included limitation function is debounce. It can be useful when you're wanting to react to state changes and expect the upstream state to change rapidly, such as a text input field that controls an async action when the user has finished typing:

```typescript
const input = state("");
const search = limit(input, debounce(500));
const results = fulfilled(
  from(search, (search) => fetch(`/search?q=${search}`))
);
```

You need to specify the number of milliseconds the debounce should wait for subsequent changes before firing.
