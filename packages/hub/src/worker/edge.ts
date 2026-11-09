import { env } from "cloudflare:workers";
import { Hono } from "hono";

// Edge mode (data.usmanity.com on Cloudflare): no database. Allowlisted GET routes are fetched
// from the self-hosted hub with the HUB_TOKEN secret, and everything the allowlist forwards is
// public. Responses are cached so the site keeps working, slightly stale, while the hub is down.
const FORWARDED = ["/api/summary"];
// Short, so a hub update shows up within a minute; the hub call is cheap. The 30-day copy is
// only the fallback for when the hub is down.
const FRESH_MS = 60 * 1000;
const STORE_SECONDS = 30 * 24 * 60 * 60;
const HUB_TIMEOUT_MS = 5000;

const hub = env as unknown as { HUB_URL: string; HUB_TOKEN?: string };

export const edge = new Hono().basePath("/api");

edge.get("/health", (c) => c.json({ ok: true, mode: "edge" }));

for (const path of FORWARDED) {
	edge.get(path.slice("/api".length), async (c) => {
		const cache = await caches.open("hub");
		const key = new Request(new URL(path, c.req.url).toString());
		const cached = await cache.match(key);
		const fetchedAt = Number(cached?.headers.get("x-hub-fetched-at") ?? 0);
		if (cached && Date.now() - fetchedAt < FRESH_MS) return withCacheState(cached, "fresh");

		try {
			const res = await fetch(hub.HUB_URL + path, {
				headers: { authorization: `Bearer ${hub.HUB_TOKEN ?? ""}` },
				signal: AbortSignal.timeout(HUB_TIMEOUT_MS),
			});
			if (!res.ok) throw new Error(`hub answered ${res.status}`);
			const body = await res.text();
			const stored = new Response(body, {
				headers: {
					"content-type": "application/json; charset=utf-8",
					"cache-control": `public, max-age=${STORE_SECONDS}`,
					"x-hub-fetched-at": String(Date.now()),
				},
			});
			c.executionCtx.waitUntil(cache.put(key, stored.clone()));
			return withCacheState(stored, "miss");
		} catch (err) {
			console.error(`hub fetch ${path} failed: ${(err as Error).message}`);
			if (cached) return withCacheState(cached, "stale");
			return c.json({ error: "hub_unavailable" }, 502);
		}
	});
}

edge.notFound((c) => c.json({ error: "not_found" }, 404));

// Browsers revalidate on every load so they never sit on old numbers; x-cache says where the
// answer came from.
function withCacheState(res: Response, state: "fresh" | "miss" | "stale"): Response {
	const out = new Response(res.body, res);
	out.headers.set("cache-control", "no-cache");
	out.headers.set("x-cache", state);
	out.headers.delete("x-hub-fetched-at");
	return out;
}
