import type { AuthSetupStatusResponse } from "@arrtemplar/shared";

export type AuthMode = "login" | "setup";

export function resolveAuthMode(
  setupStatus: AuthSetupStatusResponse | undefined,
  isCheckingSetup: boolean,
): AuthMode | null {
  if (setupStatus?.required === true) {
    return "setup";
  }

  if (isCheckingSetup) {
    return null;
  }

  return setupStatus?.required === false ? "login" : null;
}
