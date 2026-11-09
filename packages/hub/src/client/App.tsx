import React, { useEffect, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
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

// Every card ends with when its data last changed in the database.
function Updated({ at }: { at: number | undefined }) {
	return at ? <p className="meta">Updated {dayLabel(at)}</p> : null;
}

function Item({ item }: { item: SummaryItem }) {
	return item.kind === "activity" ? <Activity item={item} /> : <Money item={item} />;
}

function Activity({ item }: { item: ActivityItem }) {
	return (
		<article className="item">
			<h2>{item.label}</h2>
			<p className="value">{item.title}</p>
			<dl className="stats">
				<div>
					<dt>last miles</dt>
					<dd>{item.detail}</dd>
				</div>
			</dl>
			<Updated at={item.updated_at} />
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

// The last year as a line (Recharts). Hovering, or arrow keys once focused, snaps a hairline to
// the nearest month and shows that month's net worth. Older cached summaries may not carry
// history, hence the guards.
function Sparkline({ points }: { points: { month: string; value: number }[] }) {
	if (points.length < 2) return null;
	const trend = directionOf(points.at(-1)!.value - points[0].value);
	const color = trend === "up" ? "var(--up)" : trend === "down" ? "var(--down)" : "var(--muted)";
	return (
		<div className="spark">
			<ResponsiveContainer width="100%" height="100%">
				<LineChart data={points} margin={{ top: 6, right: 6, bottom: 6, left: 6 }} accessibilityLayer>
					<XAxis dataKey="month" hide />
					<YAxis domain={["dataMin", "dataMax"]} hide />
					<Tooltip
						content={(props: TooltipContentProps<number, string>) => <SparkTooltip {...props} />}
						cursor={{ stroke: "var(--muted)", strokeWidth: 1 }}
						isAnimationActive={false}
						wrapperStyle={{ outline: "none" }}
					/>
					<Line
						type="linear"
						dataKey="value"
						stroke={color}
						strokeWidth={2}
						dot={false}
						activeDot={{ r: 4, fill: color, stroke: "var(--bg)", strokeWidth: 2 }}
						isAnimationActive={false}
					/>
				</LineChart>
			</ResponsiveContainer>
		</div>
	);
}

// Value first, month second: the reader already knows which line they're on.
function SparkTooltip({ active, payload }: TooltipContentProps<number, string>) {
	const point = payload?.[0]?.payload as { month: string; value: number } | undefined;
	if (!active || !point) return null;
	return (
		<div className="spark-tip">
			<strong>{thousands(point.value)}</strong>
			<span>{monthLabel(point.month)}</span>
		</div>
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
			<Updated at={item.updated_at} />
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
