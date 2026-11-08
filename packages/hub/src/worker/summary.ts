import { db } from "./db.ts";
import { Hono } from "hono";
import type { Summary, SummaryItem } from "../shared/summary.ts";
import { latestBikeUpdate, type BikeUpdate } from "./bikes.ts";

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
		});
	}

	// A missing or empty bikes database just leaves the card out.
	const bike = await latestBikeUpdate().catch(() => null);
	if (bike) {
		items.push({
			kind: "activity",
			id: "bikes",
			label: "Latest bike update",
			title: bike.bike,
			detail: describe(bike),
			updated_at: bike.updated_at,
		});
	}
	return c.json({ items, generated_at: new Date().toISOString() } satisfies Summary);
});

const miles = (n: number) => `${Math.round(n).toLocaleString("en-US")} mi`;

function describe(u: BikeUpdate): string {
	switch (u.kind) {
		case "mileage":
			return `Odometer ${miles(Number(u.what))}`;
		case "event":
			return u.what ?? "Event";
		case "component":
			return `New part: ${u.what}`;
		default:
			return u.miles === null ? "Details updated" : `Details updated · ${miles(u.miles)}`;
	}
}
