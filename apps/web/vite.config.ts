import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import {
  devServerAllowedHosts,
  devServerAllowedOrigins,
  devServerDenyFiles,
} from "./src/lib/vite-dev-server-security";

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
    build: {
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              {
                name: "react-vendor",
                test: /node_modules[\\/](react|react-dom)[\\/]/,
                priority: 30,
              },
              {
                name: "tanstack-vendor",
                test: /node_modules[\\/]@tanstack[\\/]/,
                priority: 20,
              },
              {
                name: "ui-vendor",
                test: /node_modules[\\/](radix-ui|@phosphor-icons|sonner)[\\/]/,
                priority: 10,
              },
            ],
          },
        },
      },
    },
    server: {
      // Required for VS Code dev containers and remote port forwarding; exposure is constrained below.
      host: "0.0.0.0",
      allowedHosts: devServerAllowedHosts,
      cors: {
        origin: devServerAllowedOrigins,
      },
      fs: {
        strict: true,
        deny: devServerDenyFiles,
      },
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
