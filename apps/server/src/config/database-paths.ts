import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { APP_IDENTIFIER } from "@arrtemplar/shared";

export const DEV_DATABASE_URL = `data/db/${APP_IDENTIFIER}-dev.sqlite`;
export const TEST_DATABASE_URL = `data/db/${APP_IDENTIFIER}-test.sqlite`;

export type DatabaseUrlKind = "absolute-path" | "relative-path" | "memory" | "file-uri";
export type UnsupportedDatabaseUrlKind = "empty-file-uri" | "file-uri-query" | "memory-file-uri";
export type DatabaseStorage = "file" | "file-uri" | "memory";

export type ResolvedDatabaseTarget = {
  databaseUrl: string;
  databaseUrlKind: DatabaseUrlKind;
  isFileBacked: boolean;
  storage: DatabaseStorage;
};

export class UnsupportedDatabaseUrlError extends Error {
  constructor(readonly databaseUrlKind: UnsupportedDatabaseUrlKind) {
    super(`Unsupported SQLite database URL form: ${databaseUrlKind}.`);
    this.name = "UnsupportedDatabaseUrlError";
  }
}

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

export function resolveWorkspacePath(path: string): string {
  return isAbsolute(path) ? path : join(workspaceRoot, path);
}

export function resolveDatabaseUrl(databaseUrl: string): string {
  return resolveDatabaseTarget(databaseUrl).databaseUrl;
}

export function resolveDatabaseTarget(databaseUrl: string): ResolvedDatabaseTarget {
  if (databaseUrl === ":memory:") {
    return {
      databaseUrl,
      databaseUrlKind: "memory",
      isFileBacked: false,
      storage: "memory",
    };
  }

  if (databaseUrl.startsWith("file:")) {
    return resolveFileDatabaseTarget(databaseUrl);
  }

  return {
    databaseUrl: resolveWorkspacePath(databaseUrl),
    databaseUrlKind: isAbsolute(databaseUrl) ? "absolute-path" : "relative-path",
    isFileBacked: true,
    storage: "file",
  };
}

function resolveFileDatabaseTarget(databaseUrl: string): ResolvedDatabaseTarget {
  const { pathPart, searchParams } = parseFileDatabaseUrl(databaseUrl);

  if (pathPart.toLowerCase().startsWith(":memory:") || isMemoryMode(searchParams)) {
    throw new UnsupportedDatabaseUrlError("memory-file-uri");
  }

  if (hasFileUriQuery(searchParams)) {
    throw new UnsupportedDatabaseUrlError("file-uri-query");
  }

  const databasePath = decodeFileDatabasePath(databaseUrl, pathPart);

  if (!databasePath) {
    throw new UnsupportedDatabaseUrlError("empty-file-uri");
  }

  return {
    databaseUrl: resolveWorkspacePath(databasePath),
    databaseUrlKind: "file-uri",
    isFileBacked: true,
    storage: "file-uri",
  };
}

function parseFileDatabaseUrl(databaseUrl: string): {
  pathPart: string;
  searchParams: URLSearchParams;
} {
  const fileUriBody = databaseUrl.slice("file:".length);
  const queryStart = fileUriBody.indexOf("?");

  if (queryStart === -1) {
    return { pathPart: fileUriBody, searchParams: new URLSearchParams() };
  }

  return {
    pathPart: fileUriBody.slice(0, queryStart),
    searchParams: new URLSearchParams(fileUriBody.slice(queryStart + 1)),
  };
}

function isMemoryMode(searchParams: URLSearchParams): boolean {
  return searchParams.get("mode")?.toLowerCase() === "memory";
}

function hasFileUriQuery(searchParams: URLSearchParams): boolean {
  return Array.from(searchParams).length > 0;
}

function decodeFileDatabasePath(databaseUrl: string, pathPart: string): string {
  if (pathPart.startsWith("//")) {
    return fileURLToPath(new URL(databaseUrl));
  }

  return decodeURIComponent(pathPart);
}
