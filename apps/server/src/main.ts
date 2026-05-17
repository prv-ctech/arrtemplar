import { APP_NAME } from "@arrweeb-anime/shared";
import { createApp } from "./app";
import { env } from "./config/env";
import { migrateDatabase as runDatabaseMigrations } from "./db/migrate";

type RuntimeApp = {
  listen: (port: number) => unknown;
};

type StartServerOptions = {
  migrateDatabase?: () => void;
  createRuntimeApp?: () => RuntimeApp;
  serverPort?: number;
  log?: (message: string) => void;
};

export function startServer(options: StartServerOptions = {}): RuntimeApp {
  const migrateDatabase = options.migrateDatabase ?? runDatabaseMigrations;
  const createRuntimeApp = options.createRuntimeApp ?? createApp;
  const serverPort = options.serverPort ?? env.serverPort;
  const log = options.log ?? ((message: string) => console.info(message));

  migrateDatabase();
  const app = createRuntimeApp();
  app.listen(serverPort);
  log(`${APP_NAME} API listening on http://localhost:${serverPort}`);

  return app;
}

if (import.meta.main) {
  startServer();
}
