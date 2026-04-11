import path from "node:path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const envDir = path.resolve(__dirname, "../..");
  const env = loadEnv(mode, envDir, "");
  const port = Number(env.APP_PORT || 2002);

  return {
    plugins: [react()],
    envDir,
    server: {
      host: "0.0.0.0",
      port,
      strictPort: true
    },
    preview: {
      host: "0.0.0.0",
      port,
      strictPort: true
    }
  };
});
