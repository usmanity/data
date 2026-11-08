import { env } from "cloudflare:workers";
import { Hono } from "hono";
import { apps } from "./apps.ts";
import { db } from "./db.ts";
import { edge } from "./edge.ts";
import { networth } from "./networth.ts";
import { summary } from "./summary.ts";

const app = new Hono().basePath("/api");

app.get("/health", async (c) => {
	// Touch D1 so a passing health check proves the binding and migrations work.
	const row = await db().prepare(
		"SELECT COUNT(*) AS migrations FROM d1_migrations",
	).first<{ migrations: number }>();
	return c.json({ ok: true, migrations: row?.migrations ?? 0 });
});

app.route("/apps", apps);
app.route("/networth", networth);
app.route("/summary", summary);

app.notFound((c) => c.json({ error: "not_found" }, 404));

// `cf deploy --mode edge` sets HUB_URL (see cloudflare.config.ts); the hub itself never has it.
const isEdge = "HUB_URL" in env;

export default {
	fetch: isEdge ? edge.fetch : app.fetch,
	async scheduled(controller) {
		// Fetchers (Last.fm first) get dispatched from here in Phase 1.
		console.log(`cron fired: ${controller.cron}`);
	},
} satisfies ExportedHandler;
