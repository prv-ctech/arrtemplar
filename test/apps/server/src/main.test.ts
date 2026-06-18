import { describe, expect, it } from "bun:test";
import { startServer } from "../../../../apps/server/src/main";

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
});
