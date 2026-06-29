import { describe, expect, it } from "bun:test";
import { $ } from "bun";
import { createApp } from "../../../../apps/server/src/app";
import { resetAndOpenTestDatabase } from "../../../helpers/database";

describe("frontend build serving", () => {
  it("serves the built frontend shell for the app root and client-side routes", async () => {
    const database = await resetAndOpenTestDatabase();
    const frontendDistRoot = `/tmp/arrtemplar-frontend-${Bun.randomUUIDv7()}`;

    await Bun.write(
      `${frontendDistRoot}/index.html`,
      '<!doctype html><html><body><div id="root">Arrtemplar UI</div></body></html>',
      { createPath: true },
    );

    const app = createApp({ database, frontendDistRoot });

    try {
      const rootResponse = await app.handle(new Request("http://localhost/"));
      const routeResponse = await app.handle(new Request("http://localhost/settings/auth"));

      expect(rootResponse.status).toBe(200);
      expect(await rootResponse.text()).toContain("Arrtemplar UI");
      expect(routeResponse.status).toBe(200);
      expect(await routeResponse.text()).toContain("Arrtemplar UI");
    } finally {
      await $`rm -rf ${frontendDistRoot}`.quiet();
      database.close();
    }
  });

  it("serves built assets and keeps missing API and asset paths as 404s", async () => {
    const database = await resetAndOpenTestDatabase();
    const frontendDistRoot = `/tmp/arrtemplar-frontend-${Bun.randomUUIDv7()}`;

    await Bun.write(
      `${frontendDistRoot}/index.html`,
      '<!doctype html><html><body><div id="root">Arrtemplar UI</div></body></html>',
      { createPath: true },
    );
    await Bun.write(`${frontendDistRoot}/assets/app.js`, "console.log('frontend-asset');", {
      createPath: true,
    });

    const app = createApp({ database, frontendDistRoot });

    try {
      const assetResponse = await app.handle(new Request("http://localhost/assets/app.js"));
      const missingAssetResponse = await app.handle(
        new Request("http://localhost/assets/missing.js"),
      );
      const missingApiResponse = await app.handle(new Request("http://localhost/api/missing"));

      expect(assetResponse.status).toBe(200);
      expect(await assetResponse.text()).toContain("frontend-asset");
      expect(missingAssetResponse.status).toBe(404);
      expect(missingApiResponse.status).toBe(404);
    } finally {
      await $`rm -rf ${frontendDistRoot}`.quiet();
      database.close();
    }
  });
});
