import { describe, expect, it } from "bun:test";
import { startServer } from "../../../../apps/server/src/main";

describe("server startup", () => {
  it("runs database migrations before creating the app or listening for requests", () => {
    const events: string[] = [];
    const app = {
      listen(port: number) {
        events.push(`listen:${port}`);
      },
    };

    startServer({
      migrateDatabase: () => events.push("migrate"),
      createRuntimeApp: () => {
        events.push("create-app");
        return app;
      },
      serverPort: 4321,
      log: () => undefined,
    });

    expect(events).toEqual(["migrate", "create-app", "listen:4321"]);
  });
});
