# Rule: rt-html-rewriter

## Rationale

`HTMLRewriter` provides streaming HTML transformation using CSS selectors. Based on Cloudflare's `lol_html`. Useful for injecting scripts, modifying attributes, and transforming HTML responses.

## API

```typescript
const rewriter = new HTMLRewriter();

rewriter.on("div.content", {
  element(element) {
    element.setAttribute("class", "new-content");
    element.append("<p>New content</p>", { html: true });
  },
});

const transformed = rewriter.transform(new Response("<div>content</div>"));
```

## Handler Methods

### Element Handler

```typescript
{
  element(element) {
    element.tagName;                        // read tag name
    element.setAttribute("class", "foo");   // set attribute
    element.getAttribute("class");          // get attribute
    element.removeAttribute("class");       // remove attribute
    element.hasAttribute("class");          // check attribute
    element.attributes;                     // iterable [name, value] pairs

    element.before("before").after("after");
    element.prepend("first").append("last");
    element.setInnerContent("new content");
    element.setInnerContent("<p>html</p>", { html: true });
    element.remove();
    element.removeAndKeepContent();

    element.onEndTag(endTag => {
      endTag.before("before end tag");
      endTag.after("after end tag");
      endTag.remove();
    });
  },
  text(text) {
    text.before("before").after("after").replace("new").remove();
  },
  comments(comment) {
    comment.text = "new comment";
    comment.remove();
  },
}
```

### Document Handler

```typescript
{
  doctype(doctype) {
    console.log(doctype.name, doctype.publicId, doctype.systemId);
  },
  text(text) {},
  comments(comment) {},
  end(end) {
    end.append("<!-- Footer -->", { html: true });
  },
}
```

## Input Types

```typescript
rewriter.transform(new Response("<div>content</div>"));
rewriter.transform("<div>content</div>");
rewriter.transform(new TextEncoder().encode("<div>content</div>").buffer);
rewriter.transform(new Blob(["<div>content</div>"]));
rewriter.transform(Bun.file("index.html"));
```

## CSS Selector Support

Tag (`p`), class (`p.red`), ID (`h1#header`), attribute selectors, combinators, pseudo-classes (`:nth-child`, `:first-child`, `:not()`), universal (`*`)

## Guidelines

- **STREAMING**: Handlers process HTML as a stream — no full DOM parse
- **ASYNC HANDLERS**: Handlers can be async (return Promise)
- **RESPONSE PRESERVED**: Status and headers preserved during transform
- **CONTENT-ENCODING**: Gzip handled automatically
- **CLOUDFLARE COMPAT**: Same API as Cloudflare Workers HTMLRewriter (Bun extends with string/Buffer/Blob/File input)
