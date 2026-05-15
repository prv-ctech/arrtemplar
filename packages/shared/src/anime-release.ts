export type MetadataProviderName = "jikan" | "anilist" | "tmdb" | "manual";

export type SearchProviderName = "nyaa" | "prowlarr" | "jackett" | "torznab";

export type ParsedAnimeRelease = {
  releaseGroup?: string;
  animeTitle: string;
  normalizedAnimeTitle: string;
  seasonNumber?: number;
  episodeNumber?: number;
  absoluteEpisode?: number;
  episodeRange?: {
    start: number;
    end: number;
  };
  isBatch: boolean;
  resolution?: "480p" | "720p" | "1080p" | "2160p" | "unknown";
  source?: string;
  videoCodec?: string;
  audioCodec?: string;
  bitDepth?: "8bit" | "10bit" | "unknown";
  subtitles?: string[];
  audioLanguages?: string[];
  isDub?: boolean;
  isDualAudio?: boolean;
  hash?: string;
  extraTags: string[];
};
