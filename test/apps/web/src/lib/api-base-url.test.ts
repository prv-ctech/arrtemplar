import { describe, expect, it } from "bun:test";
import { resolveApiBaseUrl } from "../../../../../apps/web/src/lib/api-base-url";

describe("resolveApiBaseUrl", () => {
  it("defaults to the browser origin so Vite can proxy API calls in development", () => {
    expect(resolveApiBaseUrl(undefined, "http://localhost:5173")).toBe("http://localhost:5173");
    expect(resolveApiBaseUrl("", "http://localhost:5173")).toBe("http://localhost:5173");
  });

  it("uses an explicit API origin when one is configured", () => {
    expect(resolveApiBaseUrl(" http://localhost:3000 ")).toBe("http://localhost:3000");
  });
});
