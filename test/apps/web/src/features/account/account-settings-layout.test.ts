import { describe, expect, it } from "bun:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../../../");
const accountSettingsSourcePath = `${workspaceRoot}/apps/web/src/features/account/AccountSettings.tsx`;

describe("profile self-service settings layout", () => {
  it("keeps profile settings focused on self-service pages and moves theme to top-level settings", async () => {
    const source = await Bun.file(accountSettingsSourcePath).text();

    expect(source).toContain('"/profile/settings/main"');
    expect(source).toContain('"/profile/settings/password"');
    expect(source).toContain('"/profile/settings/notifications"');
    expect(source).not.toContain('"/settings/theme"');
    expect(source).not.toContain('"/account"');
    expect(source).not.toContain('"/account/theme"');
    expect(source).not.toContain('"/profile/settings/theme"');
    expect(source).not.toContain("ADMIN_PERMISSION_CATALOG");
    expect(source).not.toContain("hasDelegatedAccountPermission");
    expect(source).not.toContain('label: "Users"');
    expect(source).not.toContain('label: "Import"');
    expect(source).not.toContain('label: "Logs"');
  });

  it("keeps profile identity and password forms inside settings without dashboard content", async () => {
    const source = await Bun.file(accountSettingsSourcePath).text();

    expect(source).toContain("getUserProfile");
    expect(source).toContain("updateUserProfile");
    expect(source).toContain("changePassword");
    expect(source).toContain("currentPassword");
    expect(source).toContain("newPassword");
    expect(source).toContain("confirmPassword");
    expect(source).toContain("Profile Settings");
    expect(source).not.toContain("ProfileOverview");
    expect(source).not.toContain('case "profile"');
    expect(source).not.toContain('activePage === "profile"');
    expect(source).toContain("ThemeSettings");
    expect(source).not.toContain("Theme settings");
    expect(source).not.toContain("Personal theme preference");
    expect(source).not.toContain("Theme settings affect only the signed-in user.");
    expect(source).not.toContain("profile.role");
  });

  it("keeps theme flavor options as real activatable buttons", async () => {
    const source = await Bun.file(accountSettingsSourcePath).text();

    expect(source).toContain("export function ThemeSettings()");
    expect(source).toContain("function ThemePackCard");
    expect(source).toContain("themePacks.map");
    expect(source).toContain("pack.logoSrc");
    expect(source).toContain('alt=""');
    expect(source).toContain('aria-hidden="true"');
    expect(source).toContain("<Card");
    expect(source).toContain("grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))]");
    expect(source).not.toContain("grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),24rem))]");
    expect(source).toContain("items-start");
    expect(source).toContain("<CardTitle");
    expect(source).toContain("{pack.label}");
    expect(source).toContain("</CardTitle>");
    expect(source).toContain("<Separator");
    expect(source).not.toContain("palettes");
    expect(source).toContain("useState(false)");
    expect(source).toContain("aria-expanded={isExpanded}");
    expect(source).toContain("onToggle={() => setIsExpanded((current) => !current)}");
    expect(source).toContain("onClick={onToggle}");
    expect(source).toContain("isExpanded ? (");
    expect(source).not.toContain("DropdownMenu");
    expect(source).toContain("pack.previewSwatches");
    expect(source).toContain("swatches={pack.previewSwatches}");
    expect(source).not.toContain("selectedOption?.previewSwatches");
    expect(source).toContain("option.previewSwatches ?? pack.previewSwatches");
    expect(source).toContain("pack.themes.map");
    expect(source).toContain("<fieldset");
    expect(source).toContain("{pack.label} themes</legend>");
    expect(source).toContain("aria-pressed={isSelected}");
    expect(source).toContain("onClick={() => onThemeChange(option.value)}");
    expect(source).toContain("onThemeChange={setTheme}");
    expect(source).not.toContain("CATPPUCCIN_PREVIEW_SWATCHES");
    expect(source).not.toContain("CATPPUCCIN_LOGO_SRC");
    expect(source).not.toContain("SettingsRow description={option.description}");
    expect(source).not.toContain("option.description");
  });
});
