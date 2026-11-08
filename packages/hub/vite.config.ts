import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	// cf dev only forwards --mode to Vite, so the port lives here (bikes uses 8790).
	// smoke.sh sets PORT so it can run next to npm run dev.
	server: { port: Number(process.env.PORT ?? 8795), strictPort: true },
	// `npm run serve` (vite preview) runs the production build in workerd; abbey uses PORT=8083.
	preview: { port: Number(process.env.PORT ?? 8794), strictPort: true },
	plugins: [
		react(),
		// HUB_STATE_DIR moves local D1 out of .cloudflare/state, so the self-hosted
		// instance on abbey (see docs/self-hosting.md) keeps its data apart from dev and smoke.
		cloudflare({
			persistState: process.env.HUB_STATE_DIR ? { path: process.env.HUB_STATE_DIR } : true,
		}),
	],
});
