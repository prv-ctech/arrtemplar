const DEFAULT_SERVER_PORT = 3000;
const DEFAULT_WEB_ORIGIN = "http://localhost:5173";

function readPort(value: string | undefined): number {
  if (!value) {
    return DEFAULT_SERVER_PORT;
  }

  const port = Number(value);

  if (!Number.isInteger(port) || port <= 0 || port > 65_535) {
    throw new Error(`SERVER_PORT must be an integer from 1 to 65535, received: ${value}`);
  }

  return port;
}

export const env = {
  serverPort: readPort(Bun.env.SERVER_PORT),
  webOrigin: Bun.env.WEB_ORIGIN ?? DEFAULT_WEB_ORIGIN,
  databaseUrl: Bun.env.DATABASE_URL ?? "data/arrweeb-anime.sqlite",
} as const;
