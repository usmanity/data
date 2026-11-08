import { db } from "./db.ts";
import { Hono } from "hono";
import type { Summary, SummaryItem } from "../shared/summary.ts";

// GET /api/summary: values are rounded to thousands so the exact figures never leave the hub.
// No token needed: this is exactly what data.usmanity.com shows publicly.
const toThousands = (cents: number, round: (n: number) => number) =>
	round(cents / 100_000) * 1000 || 0; // `|| 0` turns -0 into 0

export const summary = new Hono();

summary.get("/", async (c) => {
	const { results } = await db().prepare(
		"SELECT month, net_worth_cents FROM networth_snapshots ORDER BY month DESC LIMIT 2",
	).all<{ month: string; net_worth_cents: number }>();
	const [latest, previous] = results;

	const items: SummaryItem[] = [];
	if (latest) {
		items.push({
			id: "networth",
			label: "Net worth",
			unit: "USD",
			month: latest.month,
			value: toThousands(latest.net_worth_cents, Math.trunc),
			previous_month: previous?.month ?? null,
			change: previous
				? toThousands(latest.net_worth_cents - previous.net_worth_cents, Math.round)
				: null,
		});
	}
	return c.json({ items, generated_at: new Date().toISOString() } satisfies Summary);
});
