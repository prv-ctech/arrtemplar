export function resolveApiBaseUrl(
  value: string | undefined,
  origin = globalThis.location?.origin,
): string {
  const explicitValue = value?.trim();

  if (explicitValue) {
    return explicitValue;
  }

  return origin ?? "";
}
