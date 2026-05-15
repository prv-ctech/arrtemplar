import type { App } from "@animehub/server";
import type { HealthResponse } from "@animehub/shared";
import { treaty } from "@elysia/eden";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

const api = treaty<App>(apiBaseUrl);

export async function getHealth(): Promise<HealthResponse> {
  const { data, error, status } = await api.health.get();

  if (error) {
    throw new Error(`Health request failed with status ${status}`);
  }

  return data;
}
