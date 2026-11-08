// GET /api/summary: the public homepage data, one entry per data item. Shared by the worker and the client.
export type SummaryItem = {
	id: string;
	label: string;
	unit: "USD";
	month: string; // "YYYY-MM" of the latest snapshot
	value: number; // whole dollars, truncated toward zero to thousands: -123,456 → -123,000
	previous_month: string | null;
	change: number | null; // month-over-month, whole dollars rounded to the nearest thousand
};

export type Summary = { items: SummaryItem[]; generated_at: string };
