---
name: "Frontend GUI Quality"
description: "Use when writing or reviewing React, shadcn/ui, Tailwind CSS, or browser-rendered frontend code. Enforces viewport containment, mobile-first responsiveness, concise GUI copy, shadcn-first choices, and reusable GUI components."
applyTo: "apps/web/src/**"
---

# Frontend GUI quality rules

Apply these rules to every React component, shadcn/ui primitive, Tailwind layout, route, dialog, table, form, and any code that renders into the web frontend.

## Viewport containment is mandatory

- Every rendered component must stay inside the viewport and its intended page container. Do not allow global horizontal bleed, clipped controls, or content that escapes the app shell.
- Prefer responsive constraints: `min-w-0`, `max-w-full`, `w-full` only inside bounded parents, `overflow-hidden` for clipping shells, and `overflow-auto` for intentional internal scroll areas.
- Avoid fixed widths that can exceed a phone viewport. Use fluid widths, grid/flex wrapping, `minmax(0, 1fr)`, and responsive max widths instead.
- Data-dense UI such as tables, permission lists, dialogs, drawers, and sheets must scroll inside their own bounded container when needed, never by pushing the whole page wider than the viewport.
- Before considering frontend work complete, verify the page has no unintended horizontal overflow at phone and desktop widths.

## Mobile-first, desktop-second design

- Build the mobile layout first. Tailwind base classes must work on phone-sized viewports; `sm:`, `md:`, `lg:`, and larger classes should progressively enhance for wider screens.
- When the viewport shrinks, components must adapt instead of overflowing. Reflow, wrap, stack, group controls, move secondary actions into menus/sheets, reduce nonessential copy, or use icon-only controls with accessible labels in tight spaces.
- Do not remove core functionality on small screens. If visible UI is collapsed or simplified, keep the action reachable through an accessible menu, drawer, tab, accordion, or details pattern.
- Buttons and controls should remain intrinsic-size by default. Do not stretch action buttons across the full viewport unless the mobile form flow explicitly benefits from a full-width primary action.
- Validate at minimum phone, tablet, and desktop widths when changing layout, spacing, navigation, tables, dialogs, or forms.

## Use shadcn/ui and proven blocks first

- Reuse existing local shadcn/ui primitives from `@/components/ui/*` before creating custom components.
- Prefer maintained shadcn patterns for dialogs, drawers, sheets, tabs, tables, menus, command palettes, forms, buttons, badges, tooltips, and skeletons.
- When a new pattern is needed, research free shadcn-compatible examples from [shadcn components](https://shadcncomponents.dev/components) and [shadcn blocks](https://shadcncomponents.dev/blocks), then adapt them to this repo's components, theme tokens, accessibility, and code style.
- Do not paste external component code blindly. Remove unused variants, replace raw colors with project design tokens, preserve keyboard behavior, and keep the final component smaller than the borrowed example when possible.
- If no existing shadcn primitive or block fits, create a focused React/Tailwind component that follows this repo's design system and native component contracts.

## Reuse frontend blocks as single sources of truth

- Once a custom GUI block or component exists, reuse it across the app instead of recreating the same structure in another route, endpoint surface, settings section, dashboard panel, or feature folder.
- Treat reusable components as app-level entities. For example, if a `poster_card` component renders an image with an integrated footer, all poster-style surfaces should import and compose `poster_card` instead of copying its markup and Tailwind classes.
- If another section needs small visual or content differences, extend the existing component with clear props, slots, variants, or composition before creating a second component.
- Create a new component entity only when the required behavior, semantics, accessibility contract, or layout model is genuinely different. Use a descriptive name such as `poster_card_compact`, `poster_card_selectable`, or `poster_card_with_actions`; avoid vague numeric duplicates like `poster_card_2` unless it is a temporary migration name.
- When extracting or changing a shared GUI component, update all relevant callers to use the shared source and delete confirmed duplicate markup.

## Text and content must not bleed

- GUI text must wrap, truncate, or clamp within its container. Use `min-w-0`, `break-words`, `truncate`, or measured line clamps where appropriate.
- Section descriptions should be extremely minimal: one short sentence when useful, otherwise omit them. Do not write paragraph-length explanations inside cards, panels, table headers, dialogs, or settings sections.
- Keep labels and helper text direct. Prefer concise action language over marketing copy.
- If content comes from users or APIs, assume it can be long and hostile to layout. Protect usernames, IDs, URLs, emails, titles, and descriptions from forcing overflow.

## Frontend quality checks

- Inspect the changed UI in the VS Code integrated browser, not just from code review.
- Check that the page loads without console errors or warnings after the change.
- Verify the accessibility tree still exposes meaningful headings, labels, tab names, button names, and table/dialog names.
- For layout changes, verify no unintended horizontal overflow using browser inspection or equivalent runtime checks.
- Run the smallest relevant tests plus Biome and TypeScript checks for touched frontend files before marking the work complete.
