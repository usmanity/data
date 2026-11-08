import { env } from "cloudflare:workers";
import { Hono } from "hono";
import { requireScope } from "./auth.ts";

type Snapshot = {
	month: string;
	assets_cents: number;
	liabilities_cents: number;
	net_worth_cents: number;
	source: string;
	note: string | null;
};

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const COLUMNS = "month, assets_cents, liabilities_cents, net_worth_cents, source, note";

export const networth = new Hono();

// GET /api/networth?from=YYYY-MM&to=YYYY-MM → snapshots oldest first.
networth.get("/", requireScope("finances:read"), async (c) => {
	const { from, to } = c.req.query();
	if (from !== undefined && !MONTH.test(from)) return c.json({ error: "bad_from" }, 400);
	if (to !== undefined && !MONTH.test(to)) return c.json({ error: "bad_to" }, 400);

	const { results } = await env.DB.prepare(
		`SELECT ${COLUMNS} FROM networth_snapshots WHERE month BETWEEN ? AND ? ORDER BY month`,
	)
		.bind(from ?? "0000-01", to ?? "9999-12")
		.all<Snapshot>();
	return c.json({ currency: "USD", count: results.length, snapshots: results });
});

// GET /api/networth/latest → newest snapshot, plus change since the month before and since the first.
networth.get("/latest", requireScope("finances:read"), async (c) => {
	const { results } = await env.DB.prepare(
		`SELECT ${COLUMNS} FROM networth_snapshots ORDER BY month DESC LIMIT 2`,
	).all<Snapshot>();
	const [latest, previous] = results;
	if (!latest) return c.json({ error: "not_found" }, 404);

	const first = await env.DB.prepare(
		`SELECT ${COLUMNS} FROM networth_snapshots ORDER BY month LIMIT 1`,
	).first<Snapshot>();
	return c.json({
		currency: "USD",
		latest,
		change_from_previous_cents: previous ? latest.net_worth_cents - previous.net_worth_cents : null,
		change_since_first_cents: first ? latest.net_worth_cents - first.net_worth_cents : null,
		first_month: first?.month ?? null,
	});
});

// PUT /api/networth/YYYY-MM {assets_cents, liabilities_cents, note?, source?} → upsert one month.
networth.put("/:month", requireScope("finances:write"), async (c) => {
	const month = c.req.param("month");
	if (!MONTH.test(month)) return c.json({ error: "bad_month" }, 400);

	const body = await c.req.json<Record<string, unknown>>().catch(() => null);
	const assets = body?.assets_cents;
	const liabilities = body?.liabilities_cents;
	if (!Number.isSafeInteger(assets) || !Number.isSafeInteger(liabilities)) {
		return c.json({ error: "assets_cents and liabilities_cents must be integers" }, 400);
	}
	const source = typeof body?.source === "string" ? body.source : "manual";
	const note = typeof body?.note === "string" ? body.note : null;

	const row = await env.DB.prepare(
		`INSERT INTO networth_snapshots (month, assets_cents, liabilities_cents, source, note)
		 VALUES (?, ?, ?, ?, ?)
		 ON CONFLICT (month) DO UPDATE SET
		   assets_cents = excluded.assets_cents,
		   liabilities_cents = excluded.liabilities_cents,
		   source = excluded.source,
		   note = excluded.note,
		   updated_at = unixepoch()
		 RETURNING ${COLUMNS}`,
	)
		.bind(month, assets, liabilities, source, note)
		.first<Snapshot>();
	return c.json(row);
});
