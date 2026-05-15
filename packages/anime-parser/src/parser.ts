import type { ParsedAnimeRelease } from "@arrweeb-anime/shared";
import { normalizeAnimeTitle } from "./normalizer";

const RELEASE_GROUP_PATTERN = /^\[([^\]]+)]\s*/;
const HASH_PATTERN = /\[([a-f0-9]{8})](?:\.[a-z0-9]+)?$/i;
const RESOLUTION_PATTERN = /\b(480p|720p|1080p|2160p)\b/i;
const EPISODE_PATTERN = /(?:^|\s-\s)(\d{1,4})(?:\b|\s|\[|\()/;

export function parseAnimeRelease(rawTitle: string): ParsedAnimeRelease {
  const releaseGroup = rawTitle.match(RELEASE_GROUP_PATTERN)?.[1];
  const hash = rawTitle.match(HASH_PATTERN)?.[1]?.toUpperCase();
  const resolution = rawTitle.match(RESOLUTION_PATTERN)?.[1]?.toLowerCase() as
    | ParsedAnimeRelease["resolution"]
    | undefined;
  const episodeNumber = readNumber(rawTitle.match(EPISODE_PATTERN)?.[1]);
  const isBatch = /\bbatch\b/i.test(rawTitle);
  const animeTitle = extractTitleCandidate(rawTitle);

  const parsed: ParsedAnimeRelease = {
    animeTitle,
    normalizedAnimeTitle: normalizeAnimeTitle(animeTitle),
    isBatch,
    extraTags: extractBracketTags(rawTitle, releaseGroup, hash),
  };

  if (releaseGroup) {
    parsed.releaseGroup = releaseGroup;
  }

  if (episodeNumber !== undefined) {
    parsed.episodeNumber = episodeNumber;
    parsed.absoluteEpisode = episodeNumber;
  }

  if (resolution) {
    parsed.resolution = resolution;
  }

  if (hash) {
    parsed.hash = hash;
  }

  return parsed;
}

function extractTitleCandidate(rawTitle: string): string {
  const withoutGroup = rawTitle.replace(RELEASE_GROUP_PATTERN, "");
  const withoutExtension = withoutGroup.replace(/\.[a-z0-9]{2,4}$/i, "");
  const withoutHash = withoutExtension.replace(HASH_PATTERN, "");
  const withoutBracketTags = withoutHash.replace(/\[[^\]]+]/g, " ");
  const beforeEpisode = withoutBracketTags.split(/\s+-\s+\d{1,4}\b/)[0];

  return (beforeEpisode ?? withoutBracketTags).replace(/\s+/g, " ").trim();
}

function extractBracketTags(rawTitle: string, releaseGroup?: string, hash?: string): string[] {
  return Array.from(rawTitle.matchAll(/\[([^\]]+)]/g))
    .map((match) => match[1])
    .filter((tag): tag is string => Boolean(tag))
    .filter((tag) => tag !== releaseGroup)
    .filter((tag) => tag.toUpperCase() !== hash);
}

function readNumber(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);

  return Number.isInteger(parsed) ? parsed : undefined;
}
