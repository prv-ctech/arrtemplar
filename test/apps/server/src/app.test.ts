import { describe, expect, it } from "bun:test";
import { createApp } from "../../../../apps/server/src/app";
import { APP_NAME, APP_VERSION } from "../../../../packages/shared/src";
import { resetAndOpenTestDatabase } from "../../../helpers/database";

describe("GET /health", () => {
  it("returns service status", async () => {
    const database = await resetAndOpenTestDatabase();
    const app = createApp({ database });

    const response = await app.handle(new Request("http://localhost/health"));
    const body = await response.json();

    try {
      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        name: APP_NAME,
        version: APP_VERSION,
        status: "ok",
      });
      expect(new Date(body.timestamp).toString()).not.toBe("Invalid Date");
    } finally {
      database.close();
    }
  });
});
