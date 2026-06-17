import { $, Glob } from "bun";
import {
  getProfileAvatarAssetPath,
  getProfileBannerAssetPath,
  PROFILE_AVATAR_IDS,
  PROFILE_BANNER_IDS,
  type ProfileBannerId,
} from "../packages/shared/src";

const referenceAvatarsUrl = new URL("../.reference/avatars/", import.meta.url);
const referenceBannersUrl = new URL("../.reference/banner/", import.meta.url);
const profileMediaUrl = new URL("../apps/web/public/profile-media/", import.meta.url);
const avatarOutputDir = Bun.fileURLToPath(new URL("avatars/", profileMediaUrl));
const bannerOutputDir = Bun.fileURLToPath(new URL("banners/", profileMediaUrl));

const bannerSvgs: Partial<Record<ProfileBannerId, string>> = {
  "aurora-hills": createBannerSvg("#ff79c6", "#bd93f9", "#8be9fd", "#50fa7b"),
  "ember-valley": createBannerSvg("#ff5555", "#ffb86c", "#f1fa8c", "#44475a"),
  "midnight-ridge": createBannerSvg("#282a36", "#44475a", "#6272a4", "#8be9fd"),
  "solar-meadow": createBannerSvg("#f1fa8c", "#50fa7b", "#8be9fd", "#1e2029"),
  "violet-tide": createBannerSvg("#bd93f9", "#ff79c6", "#6272a4", "#282a36"),
};

await generateProfileMedia();

async function generateProfileMedia() {
  await $`mkdir -p ${avatarOutputDir} ${bannerOutputDir}`.quiet();
  await removeGeneratedFiles(avatarOutputDir, "*.webp");
  await removeGeneratedFiles(avatarOutputDir, "**/*.webp");
  await removeGeneratedFiles(bannerOutputDir, "*.svg");
  await removeGeneratedFiles(bannerOutputDir, "**/*.svg");
  await removeGeneratedFiles(bannerOutputDir, "*.webp");
  await removeGeneratedFiles(bannerOutputDir, "**/*.webp");

  const sourceAvatarsById = await readSourceAvatars();
  const sourceBannersById = await readSourceBanners();

  for (const avatarId of PROFILE_AVATAR_IDS) {
    const sourcePath = sourceAvatarsById.get(avatarId);
    const assetPath = getProfileAvatarAssetPath(avatarId);

    if (!sourcePath) {
      throw new Error(`Missing reference avatar for ${avatarId}.`);
    }

    await ensureOutputDirectory(assetPath);
    await Bun.file(sourcePath)
      .image()
      .resize(192, 192, { fit: "inside", filter: "lanczos3", withoutEnlargement: true })
      .webp({ quality: 78 })
      .write(Bun.fileURLToPath(new URL(assetPath, profileMediaUrl)));
  }

  for (const bannerId of PROFILE_BANNER_IDS) {
    const bannerSvg = bannerSvgs[bannerId];
    const assetPath = getProfileBannerAssetPath(bannerId);

    if (bannerSvg) {
      await Bun.write(Bun.fileURLToPath(new URL(assetPath, profileMediaUrl)), bannerSvg, {
        createPath: true,
      });
      continue;
    }

    const sourcePath = sourceBannersById.get(bannerId);

    if (!sourcePath) {
      throw new Error(`Missing reference banner for ${bannerId}.`);
    }

    await ensureOutputDirectory(assetPath);
    await Bun.file(sourcePath)
      .image()
      .resize(1920, 640, { fit: "inside", filter: "lanczos3", withoutEnlargement: true })
      .webp({ quality: 90 })
      .write(Bun.fileURLToPath(new URL(assetPath, profileMediaUrl)));
  }

  console.log(
    `Generated ${PROFILE_AVATAR_IDS.length} avatars and ${PROFILE_BANNER_IDS.length} banners.`,
  );
}

async function readSourceAvatars(): Promise<Map<string, string>> {
  const sourceAvatarsById = new Map<string, string>();
  const glob = new Glob("**/*.png");

  for await (const relativePath of glob.scan(Bun.fileURLToPath(referenceAvatarsUrl))) {
    const [groupPath, filename] = relativePath.split("/");

    if (!groupPath || !filename) {
      continue;
    }

    const avatarId = `${slugify(groupPath)}-${slugify(filename.replace(/\.png$/i, ""))}`;
    sourceAvatarsById.set(avatarId, Bun.fileURLToPath(new URL(relativePath, referenceAvatarsUrl)));
  }

  return sourceAvatarsById;
}

async function readSourceBanners(): Promise<Map<string, string>> {
  const sourceBannersById = new Map<string, string>();
  const glob = new Glob("**/*.png");

  for await (const relativePath of glob.scan(Bun.fileURLToPath(referenceBannersUrl))) {
    const [groupPath, filename] = relativePath.split("/");

    if (!groupPath || !filename) {
      continue;
    }

    const bannerId = `${slugify(groupPath)}-${slugify(filename.replace(/\.png$/i, ""))}`;
    sourceBannersById.set(bannerId, Bun.fileURLToPath(new URL(relativePath, referenceBannersUrl)));
  }

  return sourceBannersById;
}

async function removeGeneratedFiles(directory: string, pattern: string) {
  const glob = new Glob(pattern);

  for await (const filePath of glob.scan({ absolute: true, cwd: directory })) {
    await $`rm -f ${filePath}`.quiet();
  }
}

async function ensureOutputDirectory(assetPath: string) {
  const parentPath = assetPath.split("/").slice(0, -1).join("/");

  if (parentPath.length === 0) {
    return;
  }

  await $`mkdir -p ${Bun.fileURLToPath(new URL(`${parentPath}/`, profileMediaUrl))}`.quiet();
}

function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function createBannerSvg(primary: string, secondary: string, tertiary: string, base: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 420" role="img">
  <defs>
    <linearGradient id="sky" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="${primary}"/>
      <stop offset="0.48" stop-color="${secondary}"/>
      <stop offset="1" stop-color="${tertiary}"/>
    </linearGradient>
    <linearGradient id="glow" x1="0" x2="1">
      <stop offset="0" stop-color="${tertiary}" stop-opacity="0.86"/>
      <stop offset="1" stop-color="${primary}" stop-opacity="0.18"/>
    </linearGradient>
  </defs>
  <rect width="1440" height="420" fill="${base}"/>
  <path d="M0 116c178 62 306 66 499 17 211-53 371-41 559 80 145 94 269 128 382 106V0H0Z" fill="url(#sky)"/>
  <path d="M0 301c190-84 386-91 587-18 166 60 312 58 476-5 135-53 258-66 377-28v170H0Z" fill="url(#glow)"/>
  <circle cx="1082" cy="96" r="164" fill="#f8f8f2" opacity="0.13"/>
  <circle cx="1252" cy="246" r="72" fill="#282a36" opacity="0.26"/>
</svg>`;
}
