import { describe, expect, it } from "bun:test";
import {
  registerShutdownHandlers,
  runServerProcess,
  startServer,
} from "../../../../apps/server/src/main";

describe("server startup", () => {
  it("configures logging before migrations, app creation, listening, and startup logging", async () => {
    const events: string[] = [];
    const app = {
      listen(port: number) {
        events.push(`listen:${port}`);
      },
    };

    await startServer({
      configureLogging: () => {
        events.push("configure-logging");
      },
      migrateDatabase: () => events.push("migrate"),
      createRuntimeApp: () => {
        events.push("create-app");
        return app;
      },
      serverPort: 4321,
      logServerStarted: () => events.push("log-started"),
    });

    expect(events).toEqual([
      "configure-logging",
      "migrate",
      "create-app",
      "listen:4321",
      "log-started",
    ]);
  });

  it("flushes logging once when a shutdown signal is handled", async () => {
    const listeners = new Map<string, () => void | Promise<void>>();
    const events: string[] = [];

    registerShutdownHandlers({
      stopServer: async () => {
        events.push("stop-server");
      },
      disposeLogging: async () => {
        events.push("dispose");
      },
      exitProcess: (code) => {
        events.push(`exit:${code}`);
      },
      onSignal: (signal, listener) => {
        listeners.set(signal, listener);
      },
    });

    await listeners.get("SIGINT")?.();
    await listeners.get("SIGTERM")?.();

    expect(Array.from(listeners.keys())).toEqual(["SIGINT", "SIGTERM"]);
    expect(events).toEqual(["stop-server", "dispose", "exit:0"]);
  });

  it("flushes logging when startup fails after logging is configured", async () => {
    const events: string[] = [];
    const startupError = new Error("migration failed");

    await expect(
      runServerProcess({
        configureLogging: () => {
          events.push("configure-logging");
        },
        migrateDatabase: () => {
          events.push("migrate");
          throw startupError;
        },
        createRuntimeApp: () => {
          events.push("create-app");
          return { listen: () => events.push("listen") };
        },
        disposeLogging: async () => {
          events.push("dispose");
        },
        registerShutdown: () => {
          events.push("register-shutdown");
        },
      }),
    ).rejects.toThrow(startupError);

    expect(events).toEqual(["configure-logging", "migrate", "dispose"]);
  });

  it("wires the runtime app's stop into the shutdown drain", async () => {
    let registeredStopServer: (() => unknown | Promise<unknown>) | undefined;
    const stopped: boolean[] = [];
    const app = {
      listen: () => undefined,
      stop: (closeActiveConnections?: boolean) => {
        stopped.push(closeActiveConnections ?? false);
      },
    };

    await runServerProcess({
      configureLogging: () => undefined,
      migrateDatabase: () => undefined,
      createRuntimeApp: () => app,
      logServerStarted: () => undefined,
      registerShutdown: (options: { stopServer?: () => unknown | Promise<unknown> }) => {
        registeredStopServer = options.stopServer;
      },
    });

    expect(typeof registeredStopServer).toBe("function");
    await registeredStopServer?.();
    // Graceful drain: stop() is called with no argument (defaults to false --
    // let in-flight requests finish rather than killing them abruptly).
    expect(stopped).toEqual([false]);
  });
});
