import { describe, expect, it } from "bun:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../../../");
const adminSettingsSourcePath = `${workspaceRoot}/apps/web/src/features/admin/AdminSettings.tsx`;
const appShellSourcePath = `${workspaceRoot}/apps/web/src/components/layout/AppShell.tsx`;
const settingsNavSourcePath = `${workspaceRoot}/apps/web/src/features/admin/settings/SettingsNav.tsx`;
const switchSourcePath = `${workspaceRoot}/apps/web/src/components/ui/switch.tsx`;
const stylesSourcePath = `${workspaceRoot}/apps/web/src/styles.css`;

describe("admin settings layout", () => {
  it("keeps a page-level heading available to assistive technology", async () => {
    const source = await Bun.file(adminSettingsSourcePath).text();

    expect(source).toContain('<h1 className="sr-only">Admin settings</h1>');
  });

  it("uses a single shell scroll container on mobile instead of nesting viewport and page scrolling", async () => {
    const source = await Bun.file(appShellSourcePath).text();

    expect(source).toContain("h-dvh w-full max-w-full overflow-hidden");
    expect(source).toContain("grid h-dvh");
    expect(source).toContain("grid-rows-[auto_minmax(0,1fr)]");
    expect(source).toContain("min-h-0 overflow-y-auto lg:h-dvh");
    expect(source).not.toContain('className="min-w-0 h-dvh overflow-y-auto"');
  });

  it("keeps the compact account menu button accessible", async () => {
    const source = await Bun.file(appShellSourcePath).text();

    expect(source).toContain("Open account menu for");
    expect(source).toContain("user.username");
  });

  it("styles native scrollbars with theme tokens", async () => {
    const source = await Bun.file(stylesSourcePath).text();

    expect(source).toContain("scrollbar-color:");
    expect(source).toContain("var(--primary)");
    expect(source).toContain("var(--background)");
    expect(source).toContain("::-webkit-scrollbar-thumb");
    expect(source).toContain(".scrollbar-hidden");
    expect(source).toContain("scrollbar-width: none");
  });
});

describe("admin settings navigation", () => {
  it("exposes horizontal tab semantics and keyboard movement", async () => {
    const source = await Bun.file(settingsNavSourcePath).text();

    expect(source).toContain('role="tablist"');
    expect(source).toContain('role="tab"');
    expect(source).toContain("aria-selected={isActive}");
    expect(source).toContain("aria-controls={");
    expect(source).toContain("-settings-panel`}");
    expect(source).toContain("scrollbar-hidden");
    expect(source).toContain("tabIndex={isActive ? 0 : -1}");
    expect(source).toContain("ArrowRight");
    expect(source).toContain("ArrowLeft");
    expect(source).toContain("Home");
    expect(source).toContain("End");
  });
});

describe("settings switch styling", () => {
  it("does not combine conflicting border colors and uses canonical translate utilities", async () => {
    const source = await Bun.file(switchSourcePath).text();

    expect(source).not.toContain("border border-input border-transparent");
    expect(source).toContain("data-[state=checked]:translate-x-5.5");
    expect(source).not.toContain("data-[state=checked]:translate-x-[1.375rem]");
  });
});
