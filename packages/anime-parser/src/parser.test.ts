import { describe, expect, it } from "bun:test";
import { normalizeAnimeTitle, parseAnimeRelease } from ".";

describe("normalizeAnimeTitle", () => {
  it("normalizes spacing, punctuation, case, and unicode width", () => {
    expect(normalizeAnimeTitle("Ｓｏｕｓｏｕ__NO...Frieren.mkv")).toBe("sousou no frieren");
  });
});

describe("parseAnimeRelease", () => {
  it("extracts common release fields without pretending to know everything", () => {
    const parsed = parseAnimeRelease("[SubsPlease] Sousou no Frieren - 12 (1080p) [A1B2C3D4].mkv");

    expect(parsed.releaseGroup).toBe("SubsPlease");
    expect(parsed.animeTitle).toBe("Sousou no Frieren");
    expect(parsed.normalizedAnimeTitle).toBe("sousou no frieren");
    expect(parsed.episodeNumber).toBe(12);
    expect(parsed.absoluteEpisode).toBe(12);
    expect(parsed.resolution).toBe("1080p");
    expect(parsed.hash).toBe("A1B2C3D4");
    expect(parsed.isBatch).toBe(false);
  });

  it("returns safe defaults for unknown release names", () => {
    const parsed = parseAnimeRelease("Mystery Upload.mkv");

    expect(parsed.animeTitle).toBe("Mystery Upload");
    expect(parsed.normalizedAnimeTitle).toBe("mystery upload");
    expect(parsed.extraTags).toEqual([]);
  });
});
