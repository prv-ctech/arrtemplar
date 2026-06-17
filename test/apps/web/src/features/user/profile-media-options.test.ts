import { describe, expect, it } from "bun:test";
import {
  getProfileAvatarOption,
  getProfileBannerOption,
  PROFILE_AVATAR_OPTIONS,
  PROFILE_BANNER_OPTIONS,
} from "../../../../../../apps/web/src/features/user/profile-media-options";
import {
  DEFAULT_PROFILE_AVATAR_ID,
  DEFAULT_PROFILE_BANNER_ID,
  PROFILE_AVATAR_IDS,
  PROFILE_BANNER_IDS,
} from "../../../../../../packages/shared/src";

describe("profile media options", () => {
  it("maps every predetermined avatar id to an optimized public WebP asset", () => {
    expect(PROFILE_AVATAR_OPTIONS.map((option) => option.id)).toEqual([...PROFILE_AVATAR_IDS]);
    expect(new Set(PROFILE_AVATAR_OPTIONS.map((option) => option.src)).size).toBe(
      PROFILE_AVATAR_OPTIONS.length,
    );

    for (const option of PROFILE_AVATAR_OPTIONS) {
      expect(option.src).toMatch(/^\/profile-media\/avatars\/anime\/[a-z0-9-]+\/[a-z0-9-]+\.webp$/);
      expect(option.alt).toContain("avatar");
      expect(option.label.length).toBeGreaterThan(0);
      expect(option.group.length).toBeGreaterThan(0);
    }
  });

  it("maps every predetermined banner id to a compact public asset", () => {
    expect(PROFILE_BANNER_OPTIONS.map((option) => option.id)).toEqual([...PROFILE_BANNER_IDS]);

    for (const option of PROFILE_BANNER_OPTIONS) {
      expect(option.src).toMatch(
        /^\/profile-media\/banners\/(anime\/[a-z0-9-]+|custom)\/[a-z0-9-]+\.(svg|webp)$/,
      );
      expect(option.alt).toContain("banner");
      expect(option.label.length).toBeGreaterThan(0);
    }
  });

  it("maps representative media ids to nested scalable asset paths", () => {
    expect(getProfileAvatarOption("demon-slayer-inosuke").src).toBe(
      "/profile-media/avatars/anime/demon-slayer/inosuke.webp",
    );
    expect(getProfileBannerOption("demon-slayer-banner-1").src).toBe(
      "/profile-media/banners/anime/demon-slayer/banner-1.webp",
    );
    expect(getProfileBannerOption("aurora-hills").src).toBe(
      "/profile-media/banners/custom/aurora-hills.svg",
    );
  });

  it("includes the optimized Demon Slayer anime banner in its category", () => {
    const option = PROFILE_BANNER_OPTIONS.find((entry) => entry.id === "demon-slayer-banner-1");

    expect(option).toEqual({
      id: "demon-slayer-banner-1",
      label: "Banner 1",
      group: "Demon Slayer",
      src: "/profile-media/banners/anime/demon-slayer/banner-1.webp",
      alt: "Banner 1 Demon Slayer profile banner",
    });
  });

  it("resolves missing profile media ids to safe defaults", () => {
    expect(getProfileAvatarOption("missing-avatar").id).toBe(DEFAULT_PROFILE_AVATAR_ID);
    expect(getProfileBannerOption("missing-banner").id).toBe(DEFAULT_PROFILE_BANNER_ID);
  });
});
