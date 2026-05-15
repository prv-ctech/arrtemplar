import type { APP_NAME } from "../constants/app";

export type HealthStatus = "ok";

export type HealthResponse = {
  name: typeof APP_NAME;
  version: string;
  status: HealthStatus;
  timestamp: string;
};
