import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const workspaceRoot = path.resolve(__dirname, "../..");

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, workspaceRoot, "");
  const backendOrigin = environment.BACKEND_ORIGIN || "http://localhost:3000";

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
      port: 5173,
      strictPort: true,
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
      ...(environment.USE_POLLING === "true" ? { watch: { usePolling: true } } : {}),
    },
  };
});
