import { describe, expect, it } from "bun:test";
import { APP_NAME, APP_VERSION } from "@arrweeb-anime/shared";
import { createApp } from "./app";
import { createDatabase } from "./db/client";

describe("GET /health", () => {
  it("returns service status", async () => {
    const database = createDatabase(":memory:");
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
