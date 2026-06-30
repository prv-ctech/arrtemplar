import { describe, expect, it } from "bun:test";
import { readWorkspaceSource } from "../admin/admin-settings-test-sources";

const settingsNavSourcePath = "apps/web/src/features/settings/SettingsNav.tsx";
const settingsPrimitivesSourcePath = "apps/web/src/features/settings/SettingsPrimitives.tsx";

describe("settings navigation", () => {
  it("uses shared tabs primitives with touch-friendly horizontal scrolling", async () => {
    const source = await readWorkspaceSource(settingsNavSourcePath);

    expect(source).toContain('from "./SettingsPrimitives"');
    expect(source).toContain('activationMode="automatic"');
    expect(source).toContain("value={active}");
    expect(source).toContain("onValueChange={handleSelect}");
    expect(source).toContain("<SettingsTabsList");
    expect(source).toContain("<SettingsTabsTrigger");
    expect(source).toMatch(/aria-controls=\{`\$\{entry\.id\}-settings-panel`\}/);
    expect(source).toMatch(/id=\{`\$\{entry\.id\}-settings-tab`\}/);
    expect(source).toContain("touch-pan-x");
    expect(source).toContain("touch-manipulation");
    expect(source).toContain("overflow-x-auto");
    expect(source).toContain("min-h-10");
    expect(source).toContain("rounded-lg");
    expect(source).toContain("px-2.5 py-2");
    expect(source).toContain('className="relative z-10 w-full"');
    expect(source).not.toContain("bg-background/95");
    expect(source).not.toContain("group-data-[orientation=horizontal]/tabs:h-auto");
    expect(source).not.toContain("min-h-11");
    expect(source).not.toContain("KeyboardEvent");
    expect(source).not.toContain("handleTabKeyDown");
  });

  it("defines shadcn-style settings tabs primitives with default and line variants", async () => {
    const source = await readWorkspaceSource(settingsPrimitivesSourcePath);

    expect(source).toContain("settingsTabsListVariants");
    expect(source).toContain('default: "bg-muted"');
    expect(source).toContain('line: "gap-1 bg-transparent"');
    expect(source).toContain("group-data-[orientation=horizontal]/settings-tabs:h-auto");
    expect(source).not.toContain("group-data-[orientation=horizontal]/settings-tabs:h-9");
    expect(source).toContain("TabsPrimitive.Trigger");
  });

  it("keeps the active tab selection above the settings nav surface", async () => {
    const source = await readWorkspaceSource(settingsPrimitivesSourcePath);

    expect(source).toContain("data-[state=active]:z-10");
  });

  it("aligns shared settings panels with the tabs rail inset", async () => {
    const source = await readWorkspaceSource(settingsPrimitivesSourcePath);

    expect(source).toContain('className="min-w-0 flex-1 px-1 pt-6"');
  });
});
