import {
  DEFAULT_PROFILE_AVATAR_ID,
  DEFAULT_PROFILE_BANNER_ID,
  getProfileAvatarAssetPath,
  getProfileBannerAssetPath,
  getProfileMediaAnimeGroup,
  isProfileAvatarId,
  isProfileBannerId,
  PROFILE_AVATAR_IDS,
  PROFILE_BANNER_IDS,
  type ProfileAvatarId,
  type ProfileBannerId,
} from "@arrtemplar/shared";

export type ProfileAvatarOption = {
  id: ProfileAvatarId;
  label: string;
  group: string;
  src: string;
  alt: string;
};

export type ProfileBannerOption = {
  id: ProfileBannerId;
  label: string;
  group?: string;
  src: string;
  alt: string;
};

const bannerLabels = {
  "demon-slayer-banner-1": "Banner 1",
  "demon-slayer-nezuko": "Nezuko",
  "aurora-hills": "Aurora Hills",
  "ember-valley": "Ember Valley",
  "midnight-ridge": "Midnight Ridge",
  "solar-meadow": "Solar Meadow",
  "violet-tide": "Violet Tide",
} satisfies Record<ProfileBannerId, string>;

export const PROFILE_AVATAR_OPTIONS: readonly ProfileAvatarOption[] = PROFILE_AVATAR_IDS.map(
  (id) => {
    const group = getProfileMediaAnimeGroup(id);
    const labelSlug = group ? id.slice(group.prefix.length) : id;
    const label = titleCaseSlug(labelSlug);

    return {
      id,
      label,
      group: group?.label ?? "Avatars",
      src: `/profile-media/${getProfileAvatarAssetPath(id)}`,
      alt: `${label} profile avatar`,
    };
  },
);

export const PROFILE_BANNER_OPTIONS: readonly ProfileBannerOption[] = PROFILE_BANNER_IDS.map(
  (id) => {
    const group = getProfileMediaAnimeGroup(id);
    const label = bannerLabels[id];

    return {
      id,
      label,
      ...(group ? { group: group.label } : {}),
      src: `/profile-media/${getProfileBannerAssetPath(id)}`,
      alt: group ? `${label} ${group.label} profile banner` : `${label} profile banner`,
    };
  },
);

export function getProfileAvatarOption(id: unknown): ProfileAvatarOption {
  const resolvedId = isProfileAvatarId(id) ? id : DEFAULT_PROFILE_AVATAR_ID;

  return findProfileAvatarOption(resolvedId);
}

export function getProfileBannerOption(id: unknown): ProfileBannerOption {
  const resolvedId = isProfileBannerId(id) ? id : DEFAULT_PROFILE_BANNER_ID;

  return findProfileBannerOption(resolvedId);
}

function findProfileAvatarOption(id: ProfileAvatarId): ProfileAvatarOption {
  const option = PROFILE_AVATAR_OPTIONS.find((entry) => entry.id === id);

  if (!option) {
    throw new Error(`Missing profile avatar option for ${id}`);
  }

  return option;
}

function findProfileBannerOption(id: ProfileBannerId): ProfileBannerOption {
  const option = PROFILE_BANNER_OPTIONS.find((entry) => entry.id === id);

  if (!option) {
    throw new Error(`Missing profile banner option for ${id}`);
  }

  return option;
}

function titleCaseSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}
