# Rule: rt-image

## Rationale

Bun 1.3.14 ships a built-in image processing API (`Bun.Image`) that handles JPEG, PNG, WebP, GIF, and BMP — plus HEIC, AVIF, and TIFF on macOS and Windows — with zero native module installs. It provides a chainable pipeline for decoding, transforming, and encoding images, designed as a drop-in alternative to `sharp` for common server-side image operations.

## APIs

### `Bun.Image` — Chainable Pipeline

```typescript
// Resize and convert a photo to WebP
await Bun.file("photo.jpg")
  .image()
  .resize(1024, 1024, { fit: "inside" })
  .rotate(90)
  .webp({ quality: 85 })
  .write("thumb.webp");

// Generate a thumbnail from an upload in a single expression
return new Response(new Bun.Image(upload).resize(200).jpeg());
```

### Input Sources

`Bun.Image` accepts:
- Path strings
- `ArrayBuffer` / `TypedArray` (zero-copy)
- `Blob` / `BunFile` / `S3File`
- `data:` URLs
- `Bun.file("photo.jpg").image()` or `blob.image()` shorthand

### Chainable Transforms

| Method | Description |
|--------|-------------|
| `.resize(w, h?, { filter, fit, withoutEnlargement })` | Resize with optional height, filter, fit mode |
| `.rotate(90 \| 180 \| 270)` | Rotate image |
| `.flip()` | Flip vertically |
| `.flop()` | Flip horizontally |
| `.modulate({ brightness, saturation })` | Adjust brightness/saturation |

### Output Formats

```typescript
.jpeg({ quality, progressive, mozjpeg })
.png({ compressionLevel, palette })
.webp({ quality, alphaQuality, lossless, nearLossless, smartSubsample, preset })
.heic({ quality })
.avif({ quality, lossless })
```

### Resize Filters

All sharp filters supported: `nearest`, `box`, `bilinear`, `cubic`, `mitchell`, `lanczos2`, `lanczos3`, plus `mks2013` and `mks2021`.

### Terminal Methods

All processing runs off the main thread (except `metadata()`):

```typescript
const meta = await new Bun.Image(buf).metadata();
// { width: 1920, height: 1080, format: "jpeg", ... }

const placeholder = await Bun.file("hero.jpg").image().placeholder(); // thumbhash data URL for blur-up

await image.bytes();     // Uint8Array
await image.buffer();    // ArrayBuffer
await image.blob();      // Blob
await image.toBase64();  // base64 string
await image.dataurl();   // data: URL
await image.write(dest); // write to file path
```

### Body Integration

`Bun.Image` instances work directly as response/request bodies with automatic `Content-Type`:

```typescript
return new Response(new Bun.Image(upload).resize(200).jpeg());
```

### Platform-Specific Formats

| Format | Decode | Encode | Notes |
|--------|--------|--------|-------|
| JPEG | ✅ | ✅ | Statically linked codec |
| PNG | ✅ | ✅ | Statically linked codec |
| WebP | ✅ | ✅ | Statically linked codec |
| GIF | ✅ | ✅ | Statically linked codec |
| BMP (simple) | ✅ | ✅ | Statically linked codec |
| TIFF | ✅ decode | ✅ decode | macOS/Windows only |
| HEIC | ✅ decode + encode | ✅ decode + encode | macOS/Windows only |
| AVIF | ✅ decode (+ encode Apple Silicon) | ✅ decode + encode | macOS/Windows only |

JPEG, PNG, WebP, GIF, and BMP use statically linked codecs and produce identical output across all platforms. HEIC, AVIF, and TIFF use OS system backends (ImageIO + vImage on macOS, WIC on Windows) with lazy symbol resolution for zero startup cost.

## Performance

Benchmarked on linux/x64 with 50 iterations vs sharp 0.34.5:

| Operation | Bun.Image | sharp | Speedup |
|-----------|-----------|-------|---------|
| `metadata()` | 0.004 ms | 0.28 ms | 70× |
| 1080p PNG → 400×400 → JPEG | 28.6 ms | 39.5 ms | 1.38× |
| 1080p PNG → 800×600 → WebP | 82.7 ms | 110.1 ms | 1.33× |
| 4K JPEG → 800×450 → JPEG | 35.8 ms | 45.5 ms | 1.27× |
| 4K JPEG → 1920×1080 → JPEG | 57.2 ms | 69.9 ms | 1.22× |
| 12MP JPEG → 1024×768 → WebP | 138 ms | 165 ms | 1.20× |

Performance comes from i16 fixed-point SIMD resize kernels, JPEG IDCT scaling to the smallest sufficient size, zero-copy ArrayBuffer borrowing, and a single pre-allocated arena for resize scratch memory.

## Guidelines

- **REPLACE `sharp` / `jimp`**: Use `Bun.Image` for all server-side image processing — zero native module installs, chainable API, comparable or better performance.
- **THUMBNAILS**: Use `.resize().jpeg()` or `.resize().webp()` for on-the-fly thumbnail generation.
- **BLUR-UP PLACEHOLDERS**: Use `.placeholder()` to generate thumbhash data URLs for progressive image loading.
- **METADATA**: Use `.metadata()` for fast image inspection without full decode (0.004 ms).
- **RESPONSE BODIES**: Pass `Bun.Image` instances directly to `new Response()` — automatic `Content-Type`.
- **ZERO-COPY**: Pass `ArrayBuffer` / `TypedArray` inputs for zero-copy pipelines.
- **PLATFORM AWARENESS**: HEIC/AVIF/TIFF encode is only available on macOS and Windows. Use JPEG/WebP/PNG for cross-platform server deployments.

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

// Direct response
return new Response(
  new Bun.Image(uploadBuffer)
    .resize(800, 600, { fit: "inside" })
    .jpeg({ quality: 85 })
);

// Metadata inspection
const meta = await Bun.file("photo.png").image().metadata();
console.log(meta.width, meta.height, meta.format);
```

### Incorrect

```typescript
import sharp from "sharp"; // ❌ unnecessary native dependency

const thumbnail = await sharp("photo.jpg")
  .resize(200)
  .webp()
  .toBuffer();
```
