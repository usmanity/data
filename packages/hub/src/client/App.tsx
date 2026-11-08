import { useEffect, useState } from "react";
import type { Summary, SummaryItem } from "../shared/summary.ts";

// -123000 → "-123K"
function thousands(dollars: number): string {
	const k = Math.round(dollars / 1000);
	return `${k < 0 ? "-" : ""}${Math.abs(k).toLocaleString("en-US")}K`;
}

function signedThousands(dollars: number): string {
	const k = Math.round(dollars / 1000);
	return k > 0 ? `+${thousands(dollars)}` : k === 0 ? "±0K" : thousands(dollars);
}

// "2026-11" → "Nov 2026"
function monthLabel(month: string): string {
	const [y, m] = month.split("-").map(Number);
	return new Date(Date.UTC(y, m - 1)).toLocaleString("en-US", {
		month: "short",
		year: "numeric",
		timeZone: "UTC",
	});
}

function Item({ item }: { item: SummaryItem }) {
	const direction = item.change === null ? "" : item.change > 0 ? "up" : item.change < 0 ? "down" : "";
	return (
		<article className="item">
			<h2>{item.label}</h2>
			<p className="value">{thousands(item.value)}</p>
			<p className="meta">
				{item.change !== null && item.previous_month && (
					<>
						<span className={`change ${direction}`}>{signedThousands(item.change)}</span> since{" "}
						{monthLabel(item.previous_month)} ·{" "}
					</>
				)}
				{monthLabel(item.month)}
			</p>
		</article>
	);
}

export function App() {
	const [summary, setSummary] = useState<Summary | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		fetch("/api/summary")
			.then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
			.then((body: Summary) => setSummary(body))
			.catch((err: Error) => setError(err.message));
	}, []);

	return (
		<main>
			<h1>data.usmanity.com</h1>
			{error && <p className="meta">Couldn't load the data ({error}).</p>}
			{!error && !summary && <p className="meta">Loading…</p>}
			{summary && summary.items.length === 0 && <p className="meta">Nothing here yet.</p>}
			{summary && summary.items.length > 0 && (
				<section className="items">
					{summary.items.map((item) => (
						<Item key={item.id} item={item} />
					))}
				</section>
			)}
		</main>
	);
}
