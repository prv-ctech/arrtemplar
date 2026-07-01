---
name: "Frontend GUI Quality"
description: "Use when writing or reviewing React, shadcn/ui, Tailwind CSS, or browser-rendered frontend code. Enforces shadcn-first component sourcing and extremely minimal, compact GUI copy."
applyTo: "apps/web/src/**"
---

# Frontend GUI quality rules

## Use shadcn and existing components — never hand-roll

- Always use shadcn/ui components, blocks, and Tailwind primitives that are already built by official shadcn or maintained community packages.
- Reuse local primitives from `@/components/ui/*` first. Do not create a custom version of something shadcn already provides.
- When a new pattern is needed, find it via shadcn components and blocks first. Only search the web for other libraries when no shadcn option fits.
- Never paste external component code blindly. Adapt it to this repo's components, theme tokens, and code style. Remove anything unused.

## GUI copy must be extremely minimal

- Cards, dialogs, popups, panels, and settings sections must be compact. No verbose descriptions, no explanatory paragraphs, no over-the-top comments.
- Do not restate what the user already knows. A delete confirmation is just `Delete X?` with `Yes` / `No` — never `This removes the additional service instance. The original service stays available.` We already know what is being deleted.
- Omit descriptions entirely unless they are strictly necessary. When a short label is enough, stop there.
- Keep button labels short and direct. No marketing language.
- If text comes from users or APIs, clamp/truncate it so it never breaks the layout.

## components, blocks, buttons, and more

- the size of the components, blocks, buttons, and other GUI elements must be consistent with the rest of the app. Do not create oversized elements, everything must be compact and minimal. Use the same padding, margins, and font sizes as existing components.
- try to not have a popup or dialog window when pressing a button, instead use a dropdown or a small inline panel. Only use a popup or dialog when absolutely necessary.
- always use the all the space available in the component, block, or panel. Do not leave empty space when adding text or other elemts. Use the full width and height of the component, block, or panel to display the content.
- Make sure the outlines of the fill-in boxes, dropdown menus or other input fields are visible accross the themes, we need clear outlines of the input fields to make it easy for the user to see where to click or type. Use the same outline color and thickness as existing components when possible
- When adding icons or logos do not wrap them in a circle or square, use the original shape of the icon or logo. Only wrap them in a circle or square when it is necessary to match the design of the rest of the app or when user request it.