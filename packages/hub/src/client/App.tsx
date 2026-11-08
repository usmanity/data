import React, { useEffect, useState } from "react";
import type { ActivityItem, MoneyItem, Summary, SummaryItem } from "../shared/summary.ts";

// -123000 → "-123K"
function thousands(dollars: number): string {
	const k = Math.round(dollars / 1000);
	return `${k < 0 ? "-" : ""}${Math.abs(k).toLocaleString("en-US")}K`;
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

// 1794100000 → "Nov 7, 2026"
function dayLabel(seconds: number): string {
	return new Date(seconds * 1000).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

function Item({ item }: { item: SummaryItem }) {
	return item.kind === "activity" ? <Activity item={item} /> : <Money item={item} />;
}

function Activity({ item }: { item: ActivityItem }) {
	return (
		<article className="item">
			<h2>{item.label}</h2>
			<p className="value">{item.title}</p>
			<p className="meta">
				{item.detail} · {dayLabel(item.updated_at)}
			</p>
		</article>
	);
}

// -1000 → "−$1K", 2000 → "+$2K"
function signedDollars(dollars: number): string {
	const k = Math.round(dollars / 1000);
	if (k === 0) return "±$0K";
	return `${k > 0 ? "+" : "−"}$${Math.abs(k).toLocaleString("en-US")}K`;
}

const directionOf = (n: number | null | undefined) =>
	n === null || n === undefined ? "" : n > 0 ? "up" : n < 0 ? "down" : "";

// Last few months as a line. Older cached summaries may not carry the newer fields, hence the guards.
function Sparkline({ points }: { points: { month: string; value: number }[] }) {
	if (points.length < 2) return null;
	const w = 200;
	const h = 40;
	const values = points.map((p) => p.value);
	const min = Math.min(...values);
	const max = Math.max(...values);
	const span = max - min || 1;
	const xy = points.map((p, i) => [
		(i / (points.length - 1)) * w,
		h - 2 - ((p.value - min) / span) * (h - 4),
	]);
	const trend = directionOf(values.at(-1)! - values[0]);
	return (
		<svg className={`spark ${trend}`} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img"
			aria-label={`${monthLabel(points[0].month)} to ${monthLabel(points.at(-1)!.month)}: ${values.map(thousands).join(", ")}`}>
			<polyline points={xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")} />
		</svg>
	);
}

function Money({ item }: { item: MoneyItem }) {
	const perMonth = (n: number | null | undefined, months: number) =>
		n === null || n === undefined ? null : (
			<span className={`change ${directionOf(n)}`} key={months}>
				{signedDollars(n)}/mo <span className="window">({months} mo)</span>
			</span>
		);
	const trend = [perMonth(item.avg_change_3m, 3), perMonth(item.avg_change_6m, 6)].filter(Boolean);
	return (
		<article className="item">
			<h2>{item.label}</h2>
			<p className="value">{thousands(item.value)}</p>
			<dl className="stats">
				{item.change !== null && item.previous_month && (
					<div>
						<dt>vs {monthLabel(item.previous_month)}</dt>
						<dd className={`change ${directionOf(item.change)}`}>{signedDollars(item.change)}</dd>
					</div>
				)}
				{item.change_since_first_pct != null && item.first_month && (
					<div>
						<dt>since {monthLabel(item.first_month)}</dt>
						<dd className={`change ${directionOf(item.change_since_first_pct)}`}>
							{item.change_since_first_pct > 0 ? "+" : ""}
							{item.change_since_first_pct}%
						</dd>
					</div>
				)}
				{trend.length > 0 && (
					<div>
						<dt>trend</dt>
						<dd>{trend.reduce<React.ReactNode[]>((acc, el, i) => (i ? [...acc, " · ", el] : [el]), [])}</dd>
					</div>
				)}
			</dl>
			{item.history && <Sparkline points={item.history} />}
			<p className="meta">{monthLabel(item.month)}</p>
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
