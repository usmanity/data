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
