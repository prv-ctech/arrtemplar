export const PROFILE_AVATAR_IDS = [
  "demon-slayer-akaza",
  "demon-slayer-doma",
  "demon-slayer-giyu",
  "demon-slayer-gyomei",
  "demon-slayer-inosuke",
  "demon-slayer-kokushibo",
  "demon-slayer-mitsuri",
  "demon-slayer-muichiro",
  "demon-slayer-muzan",
  "demon-slayer-nezuko",
  "demon-slayer-obanai",
  "demon-slayer-rengoku",
  "demon-slayer-sanemi",
  "demon-slayer-shinobu",
  "demon-slayer-tanjiro",
  "demon-slayer-tengen",
  "demon-slayer-zenitsu",
  "demon-slayer-zohakuten",
  "jujutsu-kaisen-aoi-todo",
  "jujutsu-kaisen-choso",
  "jujutsu-kaisen-hanami",
  "jujutsu-kaisen-jogo",
  "jujutsu-kaisen-kento-nanami",
  "jujutsu-kaisen-mahito",
  "jujutsu-kaisen-maki-zenin",
  "jujutsu-kaisen-maki-zenin-adult",
  "jujutsu-kaisen-megumi-fushiguro",
  "jujutsu-kaisen-nobara-kugisaki",
  "jujutsu-kaisen-satoru-gojo",
  "jujutsu-kaisen-toge-inumaki",
  "jujutsu-kaisen-yuji-itadori",
  "jujutsu-kaisen-yuta-okkotsu",
  "naruto-naruto",
  "one-piece-brook",
  "one-piece-chopper",
  "one-piece-franky",
  "one-piece-jinbe",
  "one-piece-luffy",
  "one-piece-nami",
  "one-piece-robin",
  "one-piece-sanji",
  "one-piece-usopp",
  "one-piece-zoro",
  "re-zero-beatrice",
  "re-zero-emilia",
  "re-zero-ram",
  "re-zero-rem",
  "re-zero-subaru",
] as const;

export const PROFILE_BANNER_IDS = [
  "demon-slayer-banner-1",
  "demon-slayer-nezuko",
  "aurora-hills",
  "ember-valley",
  "midnight-ridge",
  "solar-meadow",
  "violet-tide",
] as const;

export type ProfileAvatarId = (typeof PROFILE_AVATAR_IDS)[number];
export type ProfileBannerId = (typeof PROFILE_BANNER_IDS)[number];

export const PROFILE_MEDIA_ANIME_GROUPS = [
  { prefix: "demon-slayer-", slug: "demon-slayer", label: "Demon Slayer" },
  { prefix: "jujutsu-kaisen-", slug: "jujutsu-kaisen", label: "Jujutsu Kaisen" },
  { prefix: "naruto-", slug: "naruto", label: "Naruto" },
  { prefix: "one-piece-", slug: "one-piece", label: "One Piece" },
  { prefix: "re-zero-", slug: "re-zero", label: "Re:Zero" },
] as const;

export const DEFAULT_PROFILE_AVATAR_ID = "demon-slayer-tanjiro" satisfies ProfileAvatarId;
export const DEFAULT_PROFILE_BANNER_ID = "aurora-hills" satisfies ProfileBannerId;

const profileAvatarIdSet = new Set<string>(PROFILE_AVATAR_IDS);
const profileBannerIdSet = new Set<string>(PROFILE_BANNER_IDS);

export function isProfileAvatarId(value: unknown): value is ProfileAvatarId {
  return typeof value === "string" && profileAvatarIdSet.has(value);
}

export function isProfileBannerId(value: unknown): value is ProfileBannerId {
  return typeof value === "string" && profileBannerIdSet.has(value);
}

export function getProfileMediaAnimeGroup(
  id: string,
): (typeof PROFILE_MEDIA_ANIME_GROUPS)[number] | null {
  return PROFILE_MEDIA_ANIME_GROUPS.find((group) => id.startsWith(group.prefix)) ?? null;
}

export function getProfileAvatarAssetPath(id: ProfileAvatarId): string {
  const group = requireProfileMediaAnimeGroup(id);
  const fileSlug = id.slice(group.prefix.length);

  return `avatars/anime/${group.slug}/${fileSlug}.webp`;
}

export function getProfileBannerAssetPath(id: ProfileBannerId): string {
  const group = getProfileMediaAnimeGroup(id);

  if (!group) {
    return `banners/custom/${id}.svg`;
  }

  const fileSlug = id.slice(group.prefix.length);

  return `banners/anime/${group.slug}/${fileSlug}.webp`;
}

function requireProfileMediaAnimeGroup(
  id: ProfileAvatarId,
): (typeof PROFILE_MEDIA_ANIME_GROUPS)[number] {
  const group = getProfileMediaAnimeGroup(id);

  if (!group) {
    throw new Error(`Missing anime group for profile avatar ${id}`);
  }

  return group;
}
