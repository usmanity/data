import { bindings, defineConfig, triggers } from "cf/config";
import * as entrypoint from "./src/worker/index.ts" with { type: "cf-worker" };

// Two shapes of the same Worker:
// - default: the hub itself (self-hosted on abbey for now), answering from its own D1.
// - `--mode edge`: data.usmanity.com on Cloudflare. No database; /api/* is forwarded to the
//   self-hosted hub (HUB_URL) with the HUB_TOKEN secret. See docs/self-hosting.md.
export default defineConfig(({ mode }) => {
	const edge = mode === "edge";
	return {
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
			env: edge
				? {
						HUB_URL: bindings.text("https://abbey.usmanity.com/data"),
						HUB_TOKEN: bindings.secret(),
					}
				: {
						// Local-only placeholder id. Replace with the real id from `cf d1 create` before
						// deploying the hub itself to Cloudflare. The local SQLite file name is derived
						// from this id, so changing it orphans the self-hosted data on abbey.
						DB: bindings.d1({ name: "data-usmanity", id: "796bcaea-b4df-42d2-8332-ca3744108e3f" }),
					},
			...(edge
				? { domains: ["data.usmanity.com"] }
				: { triggers: [triggers.scheduled({ schedule: "*/30 * * * *" })] }),
		},
	};
});
