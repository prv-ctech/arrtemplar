# Rule: rt-webview

## Rationale

`Bun.WebView` provides native headless browser automation for testing and integration scenarios. Not for application runtime code.

## API

```typescript
await using view = new Bun.WebView({ width: 800, height: 600 });
await view.navigate("https://example.com");
await view.click("a[href='/docs']");
const title = await view.evaluate("document.title");
const png = await view.screenshot();
await Bun.write("page.png", png);
```

- **macOS**: WebKit (zero dependencies)
- **Linux/Windows**: Chrome/Chromium via DevTools Protocol

## Constructor Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `width` | `number` | 800 | Viewport width |
| `height` | `number` | 600 | Viewport height |
| `url` | `string` | — | Navigate immediately |
| `headless` | `boolean` | true | Only true implemented |
| `backend` | `"webkit" \| "chrome" \| object` | platform-dependent | Rendering engine |
| `console` | `typeof console \| (type, ...args) => void` | — | Capture page console |
| `dataStore` | `"ephemeral" \| { directory }` | "ephemeral" | Persistent storage |

## Methods

| Method | Description |
|--------|-------------|
| `navigate(url)` | Navigate to URL |
| `evaluate(expr)` | Run JS in page (expression only) |
| `screenshot({format, quality, encoding})` | PNG/JPEG/WebP capture |
| `click(x, y)` / `click(selector)` | Click (waits for actionability) |
| `type(text)` | Type text into focused element |
| `press(key, {modifiers})` | Press key with modifiers |
| `scroll(dx, dy)` / `scrollTo(selector)` | Scroll |
| `goBack()` / `goForward()` / `reload()` | Navigation |
| `resize(w, h)` | Resize viewport |
| `cdp(method, params)` | Raw Chrome DevTools Protocol |

## Guidelines

- **TESTING ONLY**: Use for integration/E2E tests, not app runtime code
- **AWAIT USING**: Use `await using view = new Bun.WebView()` for automatic cleanup
- **SELECTOR CLICK**: `view.click(selector)` waits for element to be actionable (attached, visible, stable, unobscured)
- **EVALUATE**: Script is wrapped as `await (<your script>)` — must be an expression
- **ONE OP AT A TIME**: Only one operation per slot (navigate, evaluate, screenshot, etc.)
