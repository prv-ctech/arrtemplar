# Rule: rt-streams

## Rationale

Bun provides standard `ReadableStream` with additional optimizations: direct streams (zero-copy), `ArrayBufferSink` for incremental writing, and async generator support.

## Standard ReadableStream

```typescript
const stream = new ReadableStream({
  start(controller) {
    controller.enqueue("hello");
    controller.enqueue("world");
    controller.close();
  },
});

for await (const chunk of stream) {
  console.log(chunk);
}
```

## Direct ReadableStream (Bun Optimization)

Avoids data copying and queue management:

```typescript
const stream = new ReadableStream({
  type: "direct",
  pull(controller) {
    controller.write("hello");
    controller.write("world");
  },
});
```

Use `controller.write()` instead of `controller.enqueue()`. The destination handles all chunk queueing.

## Async Generator Streams

```typescript
const response = new Response(
  (async function* () {
    yield "hello";
    yield "world";
  })(),
);
```

## ArrayBufferSink

Fast incremental writer for constructing `ArrayBuffer` of unknown size.

```typescript
const sink = new Bun.ArrayBufferSink();
sink.write("h");
sink.write("ello");
sink.end(); // ArrayBuffer(5) [104, 101, 108, 108, 111]

const sink2 = new Bun.ArrayBufferSink();
sink2.start({ asUint8Array: true });
sink2.write("hello");
sink2.end(); // Uint8Array(5)

// Streaming mode
const sink3 = new Bun.ArrayBufferSink();
sink3.start({ stream: true });
sink3.write("hel");
sink3.flush(); // ArrayBuffer [104, 101, 108]
sink3.write("lo");
sink3.flush(); // ArrayBuffer [108, 111]
```

### Type Reference

```typescript
class ArrayBufferSink {
  start(options?: { asUint8Array?: boolean; highWaterMark?: number; stream?: boolean }): void;
  write(chunk: string | ArrayBufferView | ArrayBuffer | SharedArrayBuffer): number;
  flush(): number | Uint8Array | ArrayBuffer;
  end(): ArrayBuffer | Uint8Array;
}
```

## Convenience Functions

```typescript
await Bun.readableStreamToArrayBuffer(stream);
await Bun.readableStreamToBytes(stream);
await Bun.readableStreamToBlob(stream);
await Bun.readableStreamToJSON(stream);
await Bun.readableStreamToText(stream);
await Bun.readableStreamToArray(stream);
await Bun.readableStreamToFormData(stream, boundary?);
```

## Guidelines

- **DIRECT STREAMS**: Use `type: "direct"` for zero-copy performance
- **ARRAYBUFFERSINK**: Use for incremental buffer construction (replaces manual Buffer concatenation)
- **CONVENIENCE FUNCTIONS**: Use `Bun.readableStreamTo*()` for one-shot conversions
- **ASYNC GENERATORS**: Use async generators as Response bodies for streaming
