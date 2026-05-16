# Rule: rt-markdown

## Rationale

Bun provides a built-in fast Markdown parser (written in Zig) with GFM extensions, supporting HTML rendering, ANSI terminal rendering, and React JSX output. Unstable API.

## APIs

### `Bun.markdown.html(markdown, options?)` → `string`

Convert Markdown to HTML with GFM extensions.

```typescript
const html = Bun.markdown.html("# Hello **world**");
// "<h1>Hello <strong>world</strong></h1>\n"
```

**Parser Options:**

| Option | Default | Description |
|--------|---------|-------------|
| `tables` | false | GFM tables |
| `strikethrough` | false | `~~text~~` |
| `tasklists` | false | `- [x] item` |
| `autolinks` | false | Auto-link URLs |
| `headings` | false | `{ ids: true }` adds IDs |
| `hardSoftBreaks` | false | Soft → hard breaks |
| `wikiLinks` | false | `[[wiki links]]` |
| `underline` | false | `__text__` → `<u>` |
| `latexMath` | false | `$inline$` and `$$display$$` |

### `Bun.markdown.ansi(markdown, options?)` → `string`

Render Markdown to ANSI-colored terminal output.

```typescript
const out = Bun.markdown.ansi("# Hello\n\n**bold** and *italic*\n");
process.stdout.write(out);

const plain = Bun.markdown.ansi("# Hello", { colors: false });
const linked = Bun.markdown.ansi("[docs](https://bun.sh)", { hyperlinks: true });
const wrapped = Bun.markdown.ansi(longText, { columns: 60 });
```

Also: `bun ./file.md` renders Markdown files directly in the terminal.

### `Bun.markdown.render(markdown, callbacks, options?)` → `string`

Custom rendering with per-element callbacks.

```typescript
const result = Bun.markdown.render("# Hello **world**", {
  heading: (children, { level }) => `<h${level}>${children}</h${level}>`,
  strong: (children) => `<b>${children}</b>`,
  paragraph: (children) => `<p>${children}</p>`,
});
```

**listItem metadata (Bun 1.3.11+):**

| Property | Type | Description |
|----------|------|-------------|
| `index` | `number` | 0-based position in parent list |
| `depth` | `number` | Nesting level (0 = top-level) |
| `ordered` | `boolean` | Whether parent is ordered |
| `start` | `number \| undefined` | Start number (ordered only) |
| `checked` | `boolean \| undefined` | Task list state |

### `Bun.markdown.react(markdown, overrides?, options?)` → React Fragment

Render Markdown to React JSX elements with component overrides.

```tsx
const el = Bun.markdown.react(content, {
  pre: CodeComponent,
  a: LinkComponent,
  h2: HeadingComponent,
}, { headings: { ids: true } });
```

## Guidelines

- **ANSI FOR CLI**: Use `Bun.markdown.ansi()` for CLI output — replaces `marked`/`markdown-it`
- **HTML FOR DOCS**: Use `Bun.markdown.html()` for server-side rendering
- **REACT FOR UI**: Use `Bun.markdown.react()` for React components
- **CUSTOM RENDER**: Use `Bun.markdown.render()` for full control
- **UNSTABLE**: API is marked unstable — may change between versions
