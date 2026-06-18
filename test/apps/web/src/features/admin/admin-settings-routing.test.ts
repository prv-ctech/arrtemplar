import { describe, expect, it } from "bun:test";
import { readWorkspaceSource } from "./admin-settings-test-sources";

const settingsSourcePath = "apps/web/src/features/admin/AdminSettings.tsx";

const SETTINGS_PAGE_IDS = [
  "about",
  "theme",
  "general",
  "library",
  "import",
  "notifications",
  "services",
  "logs",
] as const;

const SPECIAL_PATHS = [{ id: "users", path: "/settings/users" }] as const;

describe("settings routing metadata", () => {
  it("defines canonical /settings paths for every supported section", async () => {
    const source = await readWorkspaceSource(settingsSourcePath);

    for (const id of SETTINGS_PAGE_IDS) {
      expect(source).toContain(`id: "${id}"`);
      expect(source).toContain(`path: "/settings/${id}"`);
    }

    for (const entry of SPECIAL_PATHS) {
      expect(source).toContain(`id: "${entry.id}"`);
      expect(source).toContain(`path: "${entry.path}"`);
    }
  });

  it("does not contain any /admin route metadata or query-param tab mapping", async () => {
    const source = await readWorkspaceSource(settingsSourcePath);

    expect(source).not.toContain('"/admin/');
    expect(source).not.toContain("?tab=");
    expect(source).not.toContain("tab=");
    expect(source).not.toContain("$section");
  });
});
