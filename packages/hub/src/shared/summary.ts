// GET /api/summary: the public homepage data, one entry per data item. Shared by the worker and the client.
export type MoneyItem = {
	kind: "money";
	id: string;
	label: string;
	unit: "USD";
	month: string; // "YYYY-MM" of the latest snapshot
	value: number; // whole dollars, truncated toward zero to thousands: -123,456 → -123,000
	previous_month: string | null;
	change: number | null; // month-over-month, whole dollars rounded to the nearest thousand
	first_month: string; // when tracking began
	change_since_first_pct: number | null; // whole percent, measured against |first month's value|
	avg_change_3m: number | null; // average monthly change over the last 3 months, rounded to thousands
	avg_change_6m: number | null; // same over the last 6 months
	history: { month: string; value: number }[]; // last 7 snapshots (6 months of change), rounded to thousands
};

// The latest change to something (e.g. a bike): what it was and when.
export type ActivityItem = {
	kind: "activity";
	id: string;
	label: string;
	title: string; // e.g. the bike's name
	detail: string; // e.g. "Odometer 1,234 mi"
	updated_at: number; // unix seconds
};

export type SummaryItem = MoneyItem | ActivityItem;

export type Summary = { items: SummaryItem[]; generated_at: string };
