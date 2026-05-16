import { describe, expect, it } from "bun:test";
import { getApiErrorCode, getApiErrorMessage } from "./api-error";

describe("api error helpers", () => {
  it("reads Elysia error payloads wrapped by Eden", () => {
    const error = {
      status: 401,
      value: {
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Invalid email or password.",
        },
      },
    };

    expect(getApiErrorMessage(error, "Fallback")).toBe("Invalid email or password.");
    expect(getApiErrorCode(error)).toBe("INVALID_CREDENTIALS");
  });

  it("falls back for unknown errors", () => {
    expect(getApiErrorMessage(new Error("Network exploded"), "Unable to reach the API.")).toBe(
      "Unable to reach the API.",
    );
    expect(getApiErrorCode(null)).toBe("API_ERROR");
  });
});
