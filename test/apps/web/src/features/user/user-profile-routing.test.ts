import { describe, expect, it } from "bun:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../../../");
const profileMediaPickerSourcePath = `${workspaceRoot}/apps/web/src/features/user/ProfileMediaPickerDialog.tsx`;
const userProfileSourcePath = `${workspaceRoot}/apps/web/src/features/user/UserProfilePage.tsx`;
const userSettingsSourcePath = `${workspaceRoot}/apps/web/src/features/user/UserSettings.tsx`;

describe("profile dashboard and managed user routing", () => {
  it("renders a personal profile dashboard without the settings tab shell", async () => {
    const source = await Bun.file(userProfileSourcePath).text();

    expect(source).toContain("PersonalProfileRoute");
    expect(source).toContain("Edit Profile");
    expect(source).toContain('to="/profile/settings/main"');
    expect(source).toContain("function ProfileBannerButton");
    expect(source).toContain("function ProfileAvatarButton");
    expect(source).toContain("...props");
    expect(source).toContain("ref={ref}");
    expect(source).toContain("pointer-events-none size-full object-cover");
    expect(source).not.toContain("SettingsNav");
    expect(source).not.toContain("AccountSettings");
  });

  it("uses /profile public-id routes for managed dashboards and a single settings button", async () => {
    const source = await Bun.file(userProfileSourcePath).text();

    expect(source).toContain('from: "/profile/$publicUserId"');
    expect(source).toContain("publicUserId === actor.id");
    expect(source).toContain('<Navigate replace to="/profile" />');
    expect(source).toContain('to="/profile/$publicUserId/settings/main"');
    expect(source).not.toContain('to="/profile/$publicUserId/settings/password"');
    expect(source).not.toContain('to="/profile/$publicUserId/settings/permissions"');
    expect(source).not.toContain('"/users/$publicUserId"');
  });

  it("uses /profile public-id settings routes for managed user settings", async () => {
    const source = await Bun.file(userSettingsSourcePath).text();

    expect(source).toContain("canManageUsers(actor)");
    expect(source).toContain("getSelfProfileSettingsRedirect");
    expect(source).toContain("publicUserId === actor.id");
    expect(source).toContain('return "/profile/settings/main"');
    expect(source).toContain('return "/profile/settings/password"');
    expect(source).toContain('"/profile/$publicUserId/settings/main"');
    expect(source).toContain('"/profile/$publicUserId/settings/password"');
    expect(source).toContain('"/profile/$publicUserId/settings/permissions"');
    expect(source).not.toContain("as [UserSettingsEntry");
    expect(source).not.toContain('"/users/$publicUserId/settings/main"');
    expect(source).not.toContain('"/users/$publicUserId/settings/password"');
    expect(source).not.toContain('"/users/$publicUserId/settings/permissions"');
  });

  it("uses a full-surface avatar hover overlay to avoid clipped edge seams", async () => {
    const source = await Bun.file(userProfileSourcePath).text();
    const avatarButtonStart = source.indexOf("function ProfileAvatarButton");
    const avatarButtonEnd = source.indexOf("function ProfileDashboardTitle", avatarButtonStart);
    const avatarButton = source.slice(avatarButtonStart, avatarButtonEnd);

    expect(avatarButton).toContain("overflow-hidden rounded-full bg-card p-1");
    expect(avatarButton).toContain(
      "relative block size-full overflow-hidden rounded-full bg-background",
    );
    expect(avatarButton).toContain("absolute inset-0");
    expect(avatarButton).toContain("rounded-full bg-linear-to-t");
    expect(avatarButton).toContain("bg-linear-to-t from-card/95 via-background/45 to-transparent");
    expect(avatarButton).not.toContain("overflow-hidden rounded-full border-4");
    expect(avatarButton).not.toContain("absolute -inset-1");
    expect(avatarButton).not.toContain("absolute inset-x-0 bottom-0");
    expect(avatarButton).not.toContain("backdrop-blur-sm");
    expect(avatarButton).not.toContain("ring-1 ring-background ring-inset");
    expect(avatarButton).not.toContain("inset-x-2.5");
    expect(avatarButton).not.toContain("clip-path");
    expect(avatarButton).not.toContain("h-1/2");
  });

  it("keeps profile media hover overlays independent of hover media capability", async () => {
    const source = await Bun.file(userProfileSourcePath).text();
    const bannerButtonStart = source.indexOf("function ProfileBannerButton");
    const bannerButtonEnd = source.indexOf("function ProfileAvatarRow", bannerButtonStart);
    const bannerButton = source.slice(bannerButtonStart, bannerButtonEnd);
    const avatarButtonStart = source.indexOf("function ProfileAvatarButton");
    const avatarButtonEnd = source.indexOf("function ProfileDashboardTitle", avatarButtonStart);
    const avatarButton = source.slice(avatarButtonStart, avatarButtonEnd);

    expect(bannerButton).toContain("group-[:hover]:opacity-100");
    expect(avatarButton).toContain("group-[:hover]:opacity-100");
    expect(bannerButton).not.toContain("group-hover:opacity-100");
    expect(avatarButton).not.toContain("group-hover:opacity-100");
  });

  it("renders the profile banner image with a separator and no persistent fade effects", async () => {
    const source = await Bun.file(userProfileSourcePath).text();
    const dashboardStart = source.indexOf("function ProfileDashboard");
    const dashboardEnd = source.indexOf("function ProfileBanner", dashboardStart);
    const dashboard = source.slice(dashboardStart, dashboardEnd);
    const bannerImageStart = source.indexOf("const bannerImage = (");
    const bannerImageEnd = source.indexOf("const avatarImage", bannerImageStart);
    const bannerImage = source.slice(bannerImageStart, bannerImageEnd);
    const bannerStart = source.indexOf("function ProfileBanner");
    const bannerEnd = source.indexOf("function ProfileBannerButton", bannerStart);
    const banner = source.slice(bannerStart, bannerEnd);
    const bannerButtonStart = source.indexOf("function ProfileBannerButton");
    const bannerButtonEnd = source.indexOf("function ProfileAvatarRow", bannerButtonStart);
    const bannerButton = source.slice(bannerButtonStart, bannerButtonEnd);

    expect(dashboard).toContain("border-t border-border/70 px-4 pb-4");
    expect(banner).toContain("relative h-40 overflow-hidden");
    expect(bannerImage).toContain("pointer-events-none size-full object-cover");
    expect(bannerImage).not.toContain("bg-linear-to-t");
    expect(bannerImage).not.toContain("to-transparent");
    expect(bannerImage).not.toContain("mask-");
    expect(bannerImage).not.toContain("backdrop-blur");
    expect(bannerButton).toContain("overflow-hidden text-left");
    expect(bannerButton).toContain("right-4 bottom-4");
    expect(bannerButton).toContain("bg-background px-2.5 py-1");
    expect(bannerButton).not.toContain("backdrop-blur-sm");
  });

  it("uses compact picker previews when media options provide them", async () => {
    const source = await Bun.file(profileMediaPickerSourcePath).text();

    expect(source).toContain("previewSrc?: string");
    expect(source).toContain("src={option.previewSrc ?? option.src}");
  });
});
