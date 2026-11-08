import { env } from "cloudflare:workers";
import { Hono } from "hono";
import { networth } from "./networth.ts";

const app = new Hono().basePath("/api");

app.get("/health", async (c) => {
	// Touch D1 so a passing health check proves the binding and migrations work.
	const row = await env.DB.prepare(
		"SELECT COUNT(*) AS migrations FROM d1_migrations",
	).first<{ migrations: number }>();
	return c.json({ ok: true, migrations: row?.migrations ?? 0 });
});

app.route("/networth", networth);

app.notFound((c) => c.json({ error: "not_found" }, 404));

export default {
	fetch: app.fetch,
	async scheduled(controller) {
		// Fetchers (Last.fm first) get dispatched from here in Phase 1.
		console.log(`cron fired: ${controller.cron}`);
	},
} satisfies ExportedHandler;
