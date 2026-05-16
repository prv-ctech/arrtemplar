import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const workspaceRoot = path.resolve(__dirname, "../..");
const pollingContainerKeys = ["REMOTE_CONTAINERS", "CODESPACES", "DEVCONTAINER"] as const;

type ViteEnvironment = Record<string, string | undefined>;

function shouldUsePolling(environment: ViteEnvironment): boolean {
  const pollingOverride = environment.USE_POLLING?.toLowerCase();

  if (pollingOverride === "true") {
    return true;
  }

  if (pollingOverride === "false") {
    return false;
  }

  return pollingContainerKeys.some((key) => environment[key]?.toLowerCase() === "true");
}

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, workspaceRoot, "");
  const backendOrigin = environment.BACKEND_ORIGIN || "http://localhost:3000";
  const usePolling = shouldUsePolling(environment);

  return {
    envDir: workspaceRoot,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      host: "0.0.0.0",
      proxy: {
        "/health": {
          target: backendOrigin,
          changeOrigin: true,
        },
        "/api": {
          target: backendOrigin,
          changeOrigin: true,
        },
      },
      ...(usePolling ? { watch: { usePolling: true } } : {}),
    },
  };
});
