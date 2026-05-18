import { APP_NAME } from "@arrweeb-anime/shared";
import { getLogger } from "@logtape/logtape";
import { createApp } from "./app";
import { env } from "./config/env";
import { migrateDatabase as runDatabaseMigrations } from "./db/migrate";
import { configureServerLogging } from "./logging/config";

const serverLogger = getLogger(["arrweeb", "server"]);

type RuntimeApp = {
  listen: (port: number) => unknown;
};

type StartServerOptions = {
  configureLogging?: () => Promise<void> | void;
  migrateDatabase?: () => void;
  createRuntimeApp?: () => RuntimeApp;
  serverPort?: number;
  logServerStarted?: (event: { appName: string; port: number; url: string }) => void;
};

export async function startServer(options: StartServerOptions = {}): Promise<RuntimeApp> {
  const configureLogging = options.configureLogging ?? configureServerLogging;
  const migrateDatabase = options.migrateDatabase ?? runDatabaseMigrations;
  const createRuntimeApp = options.createRuntimeApp ?? createApp;
  const serverPort = options.serverPort ?? env.serverPort;
  const logServerStarted = options.logServerStarted ?? logDefaultServerStarted;

  await configureLogging();
  migrateDatabase();
  const app = createRuntimeApp();
  app.listen(serverPort);
  logServerStarted({
    appName: APP_NAME,
    port: serverPort,
    url: `http://localhost:${serverPort}`,
  });

  return app;
}

function logDefaultServerStarted(event: { appName: string; port: number; url: string }): void {
  serverLogger.info("{appName} API listening on {url}", event);
}

if (import.meta.main) {
  await startServer();
}
