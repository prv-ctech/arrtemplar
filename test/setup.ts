import { beforeAll } from "bun:test";
import { TEST_DATABASE_URL } from "../apps/server/src/config/database-paths";
import { TEST_SERVER_PORT } from "../apps/server/src/config/runtime-defaults";

Bun.env.NODE_ENV = "test";
Bun.env.DATABASE_URL = TEST_DATABASE_URL;
Bun.env.SERVER_PORT = String(TEST_SERVER_PORT);

const { resetTestDatabase } = await import("./helpers/database");

beforeAll(async () => {
  await resetTestDatabase();
});
