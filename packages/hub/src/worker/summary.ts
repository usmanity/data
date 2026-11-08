import { db } from "./db.ts";
import { Hono } from "hono";
import type { Summary, SummaryItem } from "../shared/summary.ts";
import { latestBikeMileage } from "./bikes.ts";

// GET /api/summary: values are rounded to thousands so the exact figures never leave the hub.
// No token needed: this is exactly what data.usmanity.com shows publicly.
const toThousands = (cents: number, round: (n: number) => number) =>
	round(cents / 100_000) * 1000 || 0; // `|| 0` turns -0 into 0

export const summary = new Hono();

summary.get("/", async (c) => {
	// Oldest first. One row per month, so this stays small (~12 rows a year).
	const { results: rows } = await db().prepare(
		"SELECT month, net_worth_cents FROM networth_snapshots ORDER BY month",
	).all<{ month: string; net_worth_cents: number }>();
	const latest = rows.at(-1);
	const previous = rows.at(-2);
	const first = rows[0];

	const items: SummaryItem[] = [];
	if (latest && first) {
		// Average month-over-month change across the last n months (needs n+1 snapshots).
		const avgChange = (n: number) => {
			const start = rows.at(-1 - n);
			return start ? toThousands((latest.net_worth_cents - start.net_worth_cents) / n, Math.round) : null;
		};
		items.push({
			kind: "money",
			id: "networth",
			label: "Net worth",
			unit: "USD",
			month: latest.month,
			value: toThousands(latest.net_worth_cents, Math.trunc),
			previous_month: previous?.month ?? null,
			change: previous
				? toThousands(latest.net_worth_cents - previous.net_worth_cents, Math.round)
				: null,
			first_month: first.month,
			// Against the size of the starting figure, so a negative net worth moving toward zero reads
			// as a positive change. Whole percent, so it can't be worked back to exact figures.
			change_since_first_pct: first.net_worth_cents && latest !== first
				? Math.round(((latest.net_worth_cents - first.net_worth_cents) / Math.abs(first.net_worth_cents)) * 100)
				: null,
			avg_change_3m: avgChange(3),
			avg_change_6m: avgChange(6),
			history: rows.slice(-7).map((r) => ({ month: r.month, value: toThousands(r.net_worth_cents, Math.trunc) })),
		});
	}

	// The latest odometer reading. A missing or empty bikes database just leaves the card out.
	const bike = await latestBikeMileage().catch(() => null);
	if (bike) {
		items.push({
			kind: "activity",
			id: "bikes",
			label: "Bikes",
			title: bike.bike,
			detail: `${Math.round(bike.miles).toLocaleString("en-US")} mi`,
			updated_at: bike.updated_at,
		});
	}
	return c.json({ items, generated_at: new Date().toISOString() } satisfies Summary);
});
