# Rule: rt-color

## Rationale

`Bun.color()` provides fast color conversion between CSS named colors, hex, RGB, RGBA, HSL, ANSI, and numeric formats. Can be used as a build-time macro.

## API: `Bun.color(input, outputFormat?)`

```typescript
Bun.color("red", "css");          // "red"
Bun.color(0xff0000, "css");       // "red"
Bun.color("hsl(0, 100%, 50%)", "hex"); // "#ff0000"
Bun.color("red", "ansi-16m");     // "\x1b[38;2;255;0;0m"
Bun.color("red", "number");       // 16711680
Bun.color("red", "{rgba}");       // { r: 255, g: 0, b: 0, a: 1 }
Bun.color("red", "[rgba]");       // [255, 0, 0, 255]
Bun.color("red", "hex");          // "#ff0000"
Bun.color("red", "HEX");          // "#FF0000"
Bun.color("red", "rgb");          // "rgb(255, 0, 0)"
Bun.color("red", "rgba");         // "rgba(255, 0, 0, 1)"
Bun.color("red", "hsl");          // "hsl(0, 100%, 50%)"
```

Returns `null` if input fails to parse.

### Input Types

CSS color names, numbers (0xff0000), hex strings ("#f00"), RGB/RGBA/HSL/HSLA strings, RGB/RGBA objects, RGB/RGBA arrays, LAB strings — anything CSS can parse.

### Output Formats

| Format | Example Output |
|--------|---------------|
| `"css"` | `"red"` |
| `"ansi"` | Auto-detects terminal color depth |
| `"ansi-16"` | 16-color ANSI |
| `"ansi-256"` | `"\x1b[38;5;196m"` |
| `"ansi-16m"` | 24-bit ANSI |
| `"number"` | 24-bit integer |
| `"hex"` / `"HEX"` | `"#ff0000"` / `"#FF0000"` |
| `"rgb"` / `"rgba"` / `"hsl"` | CSS function strings |
| `"{rgb}"` / `"{rgba}"` | `{ r, g, b }` / `{ r, g, b, a }` (a: 0-1) |
| `"[rgb]"` / `"[rgba]"` | `[255, 0, 0]` / `[255, 0, 0, 255]` (a: 0-255) |

## Build-Time Macro

```typescript
import { color } from "bun" with { type: "macro" };
console.log(color("#f00", "css")); // compiled to: console.log("red");
```

## Guidelines

- **REPLACE color LIBRARIES**: Use `Bun.color()` instead of `color`, `tinycolor2`, etc.
- **MACRO FOR CONSTANTS**: Use `with { type: "macro" }` for compile-time color conversion
- **ANSI FOR CLI**: Use `"ansi"` / `"ansi-16m"` format for terminal output
- **NULL CHECK**: Returns `null` for unparseable inputs — always check
