import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: "file:../../data/db/arrtemplar-dev.sqlite",
  },
  verbose: true,
  strict: true,
});
