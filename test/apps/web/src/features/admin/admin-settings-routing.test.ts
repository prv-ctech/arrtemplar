import { describe, expect, it } from "bun:test";
import { readWorkspaceSource } from "./admin-settings-test-sources";

const adminSettingsSourcePath = "apps/web/src/features/admin/AdminSettings.tsx";

const CANONICAL_PATHS = [
  "/admin/general",
  "/admin/library",
  "/admin/users",
  "/admin/import",
  "/admin/notifications",
  "/admin/services",
  "/admin/logs",
  "/admin/about",
] as const;

const ADMIN_PAGE_IDS = [
  "general",
  "library",
  "users",
  "import",
  "notifications",
  "services",
  "logs",
  "about",
] as const;

describe("admin settings routing metadata", () => {
  it("defines admin settings entries with canonical paths for every section", async () => {
    const source = await readWorkspaceSource(adminSettingsSourcePath);

    for (const path of CANONICAL_PATHS) {
      expect(source).toContain(`path: "${path}"`);
    }
  });

  it("does not contain any legacy query-param tab mapping", async () => {
    const source = await readWorkspaceSource(adminSettingsSourcePath);

    // No helper that maps query-param tab values to paths
    expect(source).not.toContain("?tab=");
    expect(source).not.toContain("tab=");
    // No legacy query-param value map like {'users': '/admin/users'}
    expect(source).not.toMatch(/['"`]\w+['"`]\s*:\s*['"`]\/admin\//);
  });

  it("does not map unknown page IDs to valid paths", async () => {
    const source = await readWorkspaceSource(adminSettingsSourcePath);

    // Unknown IDs like "nope" should not appear as path entries
    expect(source).not.toContain('/admin/nope"');
    expect(source).not.toContain("/admin/nope'");
    expect(source).not.toContain("`/admin/nope`");
  });

  it("exports AdminSettingsPage type as a finite union of supported sections", async () => {
    const source = await readWorkspaceSource(adminSettingsSourcePath);

    for (const id of ADMIN_PAGE_IDS) {
      expect(source).toContain(`"${id}"`);
    }
  });

  it("associates each entry ID with a path that matches the entry id", async () => {
    const source = await readWorkspaceSource(adminSettingsSourcePath);

    for (const id of ADMIN_PAGE_IDS) {
      // Each entry has both id and path
      expect(source).toContain(`id: "${id}"`);
      expect(source).toContain(`path: "/admin/${id}"`);
    }
  });

  it("only allows canonical admin paths from the known sections", async () => {
    const source = await readWorkspaceSource(adminSettingsSourcePath);

    // Count the canonical path references
    const pathMatches = source.match(/path: "\/admin\/\w+"/g) ?? [];
    expect(pathMatches.length).toBe(CANONICAL_PATHS.length);

    // Verify every found path is in our canonical set
    for (const match of pathMatches) {
      const path = match.replace(/^path: "/, "").replace(/"$/, "");
      expect(CANONICAL_PATHS as readonly string[]).toContain(path);
    }
  });

  it("does not use a catch-all dynamic section route", async () => {
    const source = await readWorkspaceSource(adminSettingsSourcePath);

    // No dynamic param pattern for admin section
    expect(source).not.toContain("$section");
  });
});
