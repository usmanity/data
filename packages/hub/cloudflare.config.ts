import { bindings, defineConfig, triggers } from "cf/config";
import * as entrypoint from "./src/worker/index.ts" with { type: "cf-worker" };

export default defineConfig({
	worker: {
		name: "data-usmanity",
		compatibilityDate: "2026-10-06",
		entrypoint,
		// The Vite build of src/client becomes the static assets. /api/* skips the
		// asset lookup and goes straight to Hono; unknown paths fall back to the SPA.
		assets: {
			notFoundHandling: "single-page-application",
			runWorkerFirst: ["/api/*"],
		},
		env: {
			// Local-only placeholder id. Replace with the real id from `cf d1 create` before deploying.
			DB: bindings.d1({ name: "data-usmanity", id: "796bcaea-b4df-42d2-8332-ca3744108e3f" }),
		},
		triggers: [triggers.scheduled({ schedule: "*/30 * * * *" })],
	},
});
