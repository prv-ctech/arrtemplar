import type { App } from "@arrweeb-anime/server";
import type { HealthResponse } from "@arrweeb-anime/shared";
import { treaty } from "@elysia/eden";
import { resolveApiBaseUrl } from "./api-base-url";

const apiBaseUrl = resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL);

const api = treaty<App>(apiBaseUrl);

export async function getHealth(): Promise<HealthResponse> {
  const { data, error, status } = await api.health.get();

  if (error) {
    throw new Error(`Health request failed with status ${status}`);
  }

  return data;
}
