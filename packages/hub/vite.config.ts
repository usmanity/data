import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	// cf dev only forwards --mode to Vite, so the port lives here (bikes uses 8790).
	// smoke.sh sets PORT so it can run next to npm run dev.
	server: { port: Number(process.env.PORT ?? 8795), strictPort: true },
	plugins: [react(), cloudflare()],
});
