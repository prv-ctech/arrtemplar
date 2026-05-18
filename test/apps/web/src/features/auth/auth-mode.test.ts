import { describe, expect, it } from "bun:test";
import { resolveAuthMode } from "../../../../../../apps/web/src/features/auth/auth-mode";

describe("resolveAuthMode", () => {
  it("withholds login mode while first-run setup status is still being checked", () => {
    expect(resolveAuthMode(undefined, true)).toBeNull();
    expect(resolveAuthMode({ required: false }, true)).toBeNull();
  });

  it("uses setup mode as soon as the API reports that setup is required", () => {
    expect(resolveAuthMode({ required: true }, true)).toBe("setup");
    expect(resolveAuthMode({ required: true }, false)).toBe("setup");
  });

  it("uses login mode only after setup is checked and not required", () => {
    expect(resolveAuthMode({ required: false }, false)).toBe("login");
  });
});
