import { APP_LOG_CATEGORY, APP_NAME } from "@arrtemplar/shared";
import { dispose, getLogger } from "@logtape/logtape";
import { createApp } from "./app";
import { env } from "./config/env";
import { migrateDatabase as runDatabaseMigrations } from "./db/migrate";
import { configureServerLogging } from "./logging/config";

const serverLogger = getLogger([APP_LOG_CATEGORY, "server"]);

type RuntimeApp = {
  listen: (port: number) => unknown;
  stop?: (closeActiveConnections?: boolean) => unknown | Promise<unknown>;
};

type StartServerOptions = {
  configureLogging?: () => Promise<void> | void;
  migrateDatabase?: () => void;
  createRuntimeApp?: () => RuntimeApp;
  serverPort?: number;
  logServerStarted?: (event: { appName: string; port: number; url: string }) => void;
};

type RunServerProcessOptions = StartServerOptions & {
  disposeLogging?: () => Promise<void>;
  registerShutdown?: (options: RegisterShutdownHandlersOptions) => void;
};

type ShutdownSignal = "SIGINT" | "SIGTERM";

type RegisterShutdownHandlersOptions = {
  disposeLogging?: () => Promise<void>;
  exitProcess?: (code: number) => void;
  onSignal?: (signal: ShutdownSignal, listener: () => void | Promise<void>) => void;
  stopServer?: () => unknown | Promise<unknown>;
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

export async function runServerProcess(options: RunServerProcessOptions = {}): Promise<void> {
  const {
    disposeLogging = dispose,
    registerShutdown = registerShutdownHandlers,
    ...startOptions
  } = options;

  try {
    const app = await startServer(startOptions);
    registerShutdown({ stopServer: () => app.stop?.() });
  } catch (error) {
    await disposeLogging();
    throw error;
  }
}

export function registerShutdownHandlers(options: RegisterShutdownHandlersOptions = {}): void {
  const disposeLogging = options.disposeLogging ?? dispose;
  const exitProcess = options.exitProcess ?? ((code) => process.exit(code));
  const onSignal = options.onSignal ?? ((signal, listener) => process.once(signal, listener));
  const stopServer = options.stopServer;
  let isShuttingDown = false;

  const handleShutdown = async (): Promise<void> => {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;

    try {
      // Stop accepting new connections and let in-flight requests drain before
      // logging is torn down, so final request/error logs still reach the sinks.
      await stopServer?.();
      await disposeLogging();
    } finally {
      exitProcess(0);
    }
  };

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    onSignal(signal, handleShutdown);
  }
}

function logDefaultServerStarted(event: { appName: string; port: number; url: string }): void {
  serverLogger.info("{appName} API listening on {serverUrl}", {
    event: "server.started",
    appName: event.appName,
    port: event.port,
    serverUrl: event.url,
  });
}

if (import.meta.main) {
  await runServerProcess();
}
