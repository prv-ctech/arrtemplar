import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { APP_IDENTIFIER } from "@arrtemplar/shared";

export const DEV_DATABASE_URL = `data/db/${APP_IDENTIFIER}-dev.sqlite`;
export const TEST_DATABASE_URL = `data/db/${APP_IDENTIFIER}-test.sqlite`;

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

export function resolveWorkspacePath(path: string): string {
  return isAbsolute(path) ? path : join(workspaceRoot, path);
}

export function resolveDatabaseUrl(databaseUrl: string): string {
  if (databaseUrl === ":memory:" || databaseUrl.startsWith("file:")) {
    return databaseUrl;
  }

  return resolveWorkspacePath(databaseUrl);
}
