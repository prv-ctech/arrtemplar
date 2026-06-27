# Rule: rt-image

## Rationale

Bun 1.3.14 ships a built-in image processing API (`Bun.Image`) that handles JPEG, PNG, WebP, GIF, and BMP — plus HEIC, AVIF, and TIFF on macOS and Windows — with zero native module installs. It provides a chainable pipeline for decoding, transforming, and encoding images, shaped after [Sharp](https://sharp.pixelplumbing.com/), built on libjpeg-turbo, spng, libwebp, and SIMD geometry kernels. Work executes off the JavaScript thread. Drop-in alternative to `sharp`/`jimp` for common server-side image operations.

## APIs

### Constructor & Inputs

`new Bun.Image(input, options?)` constructs a **lazy pipeline** — nothing runs until a terminal is awaited. `Blob#image()` / `BunFile#image()` / `S3File#image()` are shorthand for `new Bun.Image(blob)`:

```typescript
new Bun.Image("./photo.jpg");           // filesystem path (UNTRUSTED — see Security)
new Bun.Image(buffer);                  // Buffer / ArrayBuffer / TypedArray
new Bun.Image(Bun.file("photo.jpg"));   // BunFile — read lazily, off-thread
Bun.file("photo.jpg").image();          // same as above
Bun.s3("bucket/photo.jpg").image();     // S3File
```

The format is **sniffed from the bytes** — file extensions and `Content-Type` are ignored.

Constructor `options` guard against decompression bombs and control EXIF handling:

```typescript
new Bun.Image(input, {
  // Reject if width*height > this. Checked after reading the header,
  // before allocating the pixel buffer. Default matches Sharp (~268 MP).
  maxPixels: 4096 * 4096,
  // Apply JPEG EXIF Orientation before any other op. Default: true.
  autoOrient: true,
});
```

#### Security: path strings are arbitrary-file-read primitives

Path strings are **filesystem paths**. Never pass user-controlled strings directly to the constructor — an attacker can read `/etc/passwd`, `.env`, source, etc. Read untrusted input into a `Buffer` first (via `fetch`, or `Bun.file` behind your own allowlist), then pass the bytes.

```typescript
// ❌ arbitrary file read (IDOR / LFI)
new Bun.Image(req.query.path);

// ✅ validate against an allowlist, then pass bytes
const allowed = /^[a-z0-9-]+\.(jpg|png|webp)$/;
if (!allowed.test(name)) throw new BadRequest();
const bytes = await Bun.file(`uploads/${name}`).bytes();
new Bun.Image(bytes);
```

#### Buffer ownership

When passing a `TypedArray` / `ArrayBuffer`, decode runs off-thread and **borrows the bytes** — do not mutate the buffer while a terminal is pending. `SharedArrayBuffer` and resizable buffers are refused; pass a fixed view via `buf.slice()`.

### Metadata

Read `width`, `height`, and `format` without decoding pixel data:

```typescript
const { width, height, format } = await new Bun.Image(input).metadata();
// => { width: 1920, height: 1080, format: "jpeg" }
```

`img.width` and `img.height` are `-1` before any terminal resolves; after one resolves they reflect the **output** dimensions.

### Resize

```typescript
img.resize(800);                                   // width 800, keep aspect ratio
img.resize(800, 600);                              // exactly 800×600 (stretch, default fit)
img.resize(800, 600, { fit: "inside" });           // fit within 800×600
img.resize(800, 600, { withoutEnlargement: true }); // never upscale
img.resize(800, 600, { filter: "mitchell" });
```

| `fit` | Behavior |
| ----- | -------- |
| `"fill"` *(default)* | Stretch to exactly `width × height` |
| `"inside"` | Preserve aspect ratio; result fits *within* the box |

#### Resize filters

`filter` selects the resampling kernel. The default `"lanczos3"` is the right choice for photographs.

| Filter | Use when |
| ------ | -------- |
| `"lanczos3"` *(default)* | General-purpose, sharpest for photos |
| `"lanczos2"` | Slightly softer, fewer ringing artifacts |
| `"mitchell"` | Smooth gradients; the classic bicubic compromise |
| `"cubic"` | Catmull-Rom — sharper than Mitchell, can ring |
| `"mks2013"` / `"mks2021"` | "Magic Kernel Sharp"; used by Facebook/Instagram |
| `"bilinear"` / `"linear"` | Fast, soft |
| `"box"` | Area-average; good for large integer downscales |
| `"nearest"` | Pixel art / hard edges |

#### JPEG IDCT shortcut

When the source is a JPEG and the target is at most half the source size, decode skips straight to the nearest M/8 IDCT scale — generating a thumbnail from a 24 MP photo never materializes the full-resolution buffer.

### Rotate · Flip

```typescript
img.rotate(90);  // 90° clockwise (multiples of 90 only: 90, 180, 270)
img.flip();      // mirror vertically (about the x-axis)
img.flop();      // mirror horizontally (about the y-axis)
```

### Modulate

```typescript
img.modulate({
  brightness: 1.2, // 1 = unchanged, >1 = brighter
  saturation: 0,   // 0 = greyscale, 1 = unchanged, >1 = boost
});
```

### Output Formats

Calling a format method sets the encode target. Without one, the source format is reused (or, for `.write(path)`, the extension picks).

```typescript
img.jpeg({ quality: 85, progressive: true, mozjpeg: true }); // quality 1–100, default 80
img.png({ compressionLevel: 6 });                            // zlib level 0–9
img.png({ palette: true, colors: 64, dither: true });        // indexed PNG
img.webp({ quality: 80, alphaQuality, lossless, nearLossless, smartSubsample, preset });
img.heic({ quality: 80 });                  // macOS / Windows only
img.avif({ quality: 60, lossless: true });  // macOS / Windows only (encode Apple Silicon M3+)
```

- **Indexed PNG** (`palette: true`) quantizes to a ≤256-color palette and emits an indexed (color-type 3) PNG, optionally with Floyd–Steinberg `dither`. Typically **3–5× smaller** than truecolor for screenshots and UI assets.
- **Progressive JPEG** (`progressive: true`) enables coarse-to-fine rendering — use for large photos served to browsers.

### Terminals (await to execute)

A pipeline does **no work until one of these is awaited**. All encode/transform work runs off the JavaScript thread (`metadata()` is the exception):

```typescript
await img.bytes();        // Uint8Array
await img.buffer();       // Buffer
await img.blob();         // Blob with .type set to the output MIME
await img.toBase64();     // base64 string
await img.dataurl();      // "data:image/png;base64,…"
await img.write("out.webp");              // number (bytes written)
await img.write(Bun.s3("bucket/out.webp"));
```

`.write()` accepts the same destinations as `Bun.write` — a path string, `Bun.file()`, `Bun.s3()`, or an fd. If no format method was chained and the destination is a path string, the **extension picks** the format (`.jpg` / `.png` / `.webp` / `.heic` / `.avif`).

### Placeholders

`.placeholder()` returns a [ThumbHash](https://evanw.github.io/thumbhash/)-rendered ≤32px blur as a `data:` URL (~400–700 bytes, no client-side decoder needed) — ideal for a low-quality inline placeholder (LQIP) before the real image loads:

```typescript
const lqip = await Bun.file("hero.jpg").image().placeholder();
// <img src={lqip} … /> — then swap to the real URL on load.
```

For coarse-to-fine rendering of the image *itself*, encode a progressive JPEG instead: `img.jpeg({ progressive: true })`.

### `Bun.serve` / Response Body Integration

A `Bun.Image` pipeline is a valid `Response` body and sets `Content-Type` automatically. In an Elysia handler (this repo's HTTP backbone), **validate untrusted input before touching the filesystem** and **await a terminal first** to keep encode off the JS thread:

```typescript
new Elysia().get("/avatar/:id", async ({ params }) => {
  if (!/^[a-z0-9]+$/.test(params.id)) return new Response(null, { status: 400 });
  const out = await Bun.file(`avatars/${params.id}.png`)
    .image()
    .resize(128, 128)
    .webp()
    .blob();
  return new Response(out);
});
```

Passing the pipeline directly (`new Response(img)`) also works, but currently runs the encode **synchronously during body init** — prefer awaiting a terminal in hot paths.

### Clipboard

```typescript
const img = Bun.Image.fromClipboard();
if (img) {
  const png = await img.resize(800, 800, { fit: "inside" }).png().bytes();
}
```

- **`Bun.Image.fromClipboard()`** reads PNG, TIFF, HEIC, JPEG, WebP, GIF, or BMP from the system pasteboard on **macOS and Windows**; returns `null` if empty, and **always `null` on Linux** (call `wl-paste` / `xclip` yourself and pass the bytes to the constructor). The regular decode pipeline takes it from there.
- **`Bun.clipboardChangeCount()`** — a single integer read. macOS has no clipboard-change notification, so poll the count and only call `hasClipboardImage()` when it moves (for a passive "image in clipboard, press ⌘V" hint).
- **`Bun.hasClipboardImage()`** — whether an image is currently on the pasteboard.

### Platform Backends

| | Linux | macOS | Windows |
| --- | --- | --- | --- |
| JPEG / PNG / WebP | libjpeg-turbo · spng · libwebp | same | same |
| BMP / GIF (decode) | built-in | ImageIO | WIC |
| TIFF (decode) | ❌ | ImageIO | WIC |
| Resize / rotate / flip | Highway SIMD | Accelerate vImage | Highway SIMD |
| HEIC / AVIF | ❌ `ERR_IMAGE_FORMAT_UNSUPPORTED` | ImageIO ² | WIC ¹ |
| Clipboard | ❌ returns `null` | NSPasteboard | Win32 |

¹ Windows requires the **HEIF Image Extensions** / **AV1 Video Extension** from the Microsoft Store.
² AVIF **encode** needs an OS AV1 encoder — **Apple Silicon M3+ only**. Intel Mac and M1/M2 reject with `ERR_IMAGE_FORMAT_UNSUPPORTED`; AVIF **decode** works everywhere ImageIO does (macOS 13+).

JPEG, PNG, and WebP go through the same statically-linked codecs on every platform, so encoded output is **byte-identical** across Linux, macOS, and Windows. TIFF, HEIC, AVIF, and clipboard inherit the **OS's** patch level — keep macOS / Windows updated.

Force the portable Highway path for geometry too (e.g. for golden-image tests) via the process-global backend:

```typescript
Bun.Image.backend = "bun"; // default is "system" on macOS/Windows
```

#### Format-unsupported fallback

When a system-backend format isn't available on the current machine, the terminal rejects with `error.code === "ERR_IMAGE_FORMAT_UNSUPPORTED"` — branch on that to fall back to a portable format:

```typescript
const out = await img
  .avif({ quality: 50 })
  .bytes()
  .catch((e) => {
    if (e.code === "ERR_IMAGE_FORMAT_UNSUPPORTED") return img.webp({ quality: 80 }).bytes();
    throw e;
  });
```

## Performance

Benchmarked on linux/x64 with 50 iterations vs sharp 0.34.5:

| Operation | Bun.Image | sharp | Speedup |
| --------- | --------- | ----- | ------- |
| `metadata()` | 0.004 ms | 0.28 ms | 70× |
| 1080p PNG → 400×400 → JPEG | 28.6 ms | 39.5 ms | 1.38× |
| 1080p PNG → 800×600 → WebP | 82.7 ms | 110.1 ms | 1.33× |
| 4K JPEG → 800×450 → JPEG | 35.8 ms | 45.5 ms | 1.27× |
| 4K JPEG → 1920×1080 → JPEG | 57.2 ms | 69.9 ms | 1.22× |
| 12MP JPEG → 1024×768 → WebP | 138 ms | 165 ms | 1.20× |

Performance comes from i16 fixed-point SIMD resize kernels, JPEG IDCT scaling to the smallest sufficient size, zero-copy ArrayBuffer borrowing, and a single pre-allocated arena for resize scratch memory.

## Guidelines

- **REPLACE `sharp` / `jimp`**: Use `Bun.Image` for all server-side image processing — zero native module installs, chainable API, comparable or better performance.
- **NEVER pass user-controlled path strings to the constructor** — it's an arbitrary-file-read primitive. Validate against an allowlist and pass bytes instead (see Security).
- **DEFEND AGAINST DECOMPRESSION BOMBS**: Set `maxPixels` on untrusted inputs (e.g. `4096 * 4096`). The check runs after the header is read, before the pixel buffer is allocated.
- **KEEP `autoOrient: true`** (the default) so JPEG EXIF Orientation is applied before any other op.
- **DON'T MUTATE** a `TypedArray`/`ArrayBuffer` input while a terminal is pending — decode borrows the bytes off-thread. `SharedArrayBuffer`/resizable buffers are refused; use `buf.slice()`.
- **METADATA FIRST**: Use `.metadata()` for fast inspection without full decode (0.004 ms). Remember `width`/`height` are `-1` until a terminal resolves.
- **THUMBNAILS**: `.resize().jpeg()` or `.resize().webp()`. Large-JPEG-to-small-thumbnail never materializes the full buffer (JPEG IDCT shortcut).
- **BLUR-UP PLACEHOLDERS**: `.placeholder()` returns a ThumbHash `data:` URL (~400–700 bytes, no client decoder). For coarse-to-fine of the image itself, use `.jpeg({ progressive: true })`.
- **SCREENSHOTS / UI ASSETS**: `.png({ palette: true, colors: 64, dither: true })` — indexed PNGs are typically 3–5× smaller than truecolor.
- **RESPONSE BODIES**: Pass a `Bun.Image` directly to `new Response()` for automatic `Content-Type`, but **await a terminal first in hot paths** — passing the pipeline directly runs encode synchronously during body init.
- **WRITE DESTINATIONS**: `.write()` accepts a path, `Bun.file()`, `Bun.s3()`, or an fd. Without a chained format method and with a path destination, the extension picks the format.
- **PLATFORM AWARENESS**: HEIC/AVIF/TIFF encode is macOS/Windows only; AVIF encode is Apple Silicon **M3+** only; TIFF decode is unavailable on Linux; clipboard is `null` on Linux. Use JPEG/WebP/PNG for cross-platform server deployments, and **branch on `ERR_IMAGE_FORMAT_UNSUPPORTED`** to fall back.
- **GOLDEN-IMAGE TESTS**: Set `Bun.Image.backend = "bun"` to force the portable Highway geometry path for byte-stable cross-platform output.
- **ZERO-COPY**: Pass `ArrayBuffer`/`TypedArray` inputs for zero-copy pipelines.

## Examples

### Correct

```typescript
// Thumbnail generation
await Bun.file("upload.jpg")
  .image()
  .resize(200, 200, { fit: "cover", filter: "lanczos3" })
  .webp({ quality: 80 })
  .write("thumb.webp");

// Blur-up placeholder
const placeholder = await Bun.file("hero.jpg").image().placeholder();

// Untrusted upload — guard against decompression bombs
const meta = await new Bun.Image(uploadBytes, { maxPixels: 4096 * 4096 }).metadata();
if (meta.width > 8192) throw new PayloadTooLarge();
const out = await new Bun.Image(uploadBytes).resize(800, 800, { fit: "inside" }).jpeg({ quality: 85 });

// Elysia handler — validate before filesystem, await terminal to keep encode off-thread
new Elysia().get("/avatar/:id", async ({ params }) => {
  if (!/^[a-z0-9]+$/.test(params.id)) return new Response(null, { status: 400 });
  const blob = await Bun.file(`avatars/${params.id}.png`).image().resize(128, 128).webp().blob();
  return new Response(blob);
});

// Cross-platform AVIF → WebP fallback
const bytes = await img
  .avif({ quality: 50 })
  .bytes()
  .catch((e) =>
    e.code === "ERR_IMAGE_FORMAT_UNSUPPORTED" ? img.webp({ quality: 80 }).bytes() : Promise.reject(e),
  );

// Indexed PNG for a screenshot asset (3–5× smaller)
await Bun.file("screenshot.png").image().png({ palette: true, colors: 64, dither: true }).write("ui.png");

// Clipboard (macOS/Windows only — Linux returns null)
const clip = Bun.Image.fromClipboard();
if (clip) await clip.resize(800, 800, { fit: "inside" }).png().write("pasted.png");
```

### Incorrect

```typescript
import sharp from "sharp"; // ❌ unnecessary native dependency

const thumbnail = await sharp("photo.jpg").resize(200).webp().toBuffer();

new Bun.Image(req.query.path); // ❌ arbitrary file read — never pass user-controlled paths

// ❌ passing the pipeline directly to Response runs encode synchronously on the JS thread
return new Response(Bun.file("big.jpg").image().resize(1920).webp());
```
